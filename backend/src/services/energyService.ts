import prisma from '../lib/prisma'

/** Shape of the single aggregate row returned by the dashboard rollup query. */
interface DashboardAggregateRow {
  totalEnergy: number
  alerts: number
  currentPower: number
  hourly: { hour: string; energy: number }[] | null
  perAppliance: { applianceId: number; energy: number }[] | null
}

/** `now` is injectable so the rollup can be exercised against a known day. */
export const getDashboardData = async (now: Date = new Date()) => {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Hour bucketing used to run in Node via Date#getHours(), i.e. in the
  // server's local zone. Postgres stores these as UTC timestamps, so the same
  // zone has to be applied in SQL or the buckets would silently shift.
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  // This previously pulled every reading for the day into Node -- with the full
  // Appliance row joined onto each one -- and reduced them in JS. That grows
  // without bound over the day and dominates dashboard latency. All of it is
  // now aggregated in Postgres and returned as one row over one round trip,
  // which matters on Neon where each round trip is remote.
  const [aggregateRows, appliances, budget] = await Promise.all([
    prisma.$queryRaw<DashboardAggregateRow[]>`
      WITH day AS (
        SELECT "energyUsed", "power", "alert", "applianceId", "timestamp"
        FROM "EnergyReading"
        WHERE "timestamp" >= ${startOfDay}
      ),
      hourly AS (
        SELECT
          to_char(("timestamp" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}::text, 'HH24') || ':00' AS hour,
          SUM("energyUsed")::float8 AS energy
        FROM day
        GROUP BY 1
      ),
      per_appliance AS (
        SELECT "applianceId", SUM("energyUsed")::float8 AS energy
        FROM day
        GROUP BY 1
      ),
      latest AS (
        -- Mirrors the old "first row per appliance when ordered by timestamp
        -- desc" pass over the in-memory readings.
        SELECT DISTINCT ON ("applianceId") "applianceId", "power"::float8 AS power
        FROM day
        ORDER BY "applianceId", "timestamp" DESC
      )
      SELECT
        COALESCE((SELECT SUM("energyUsed") FROM day), 0)::float8 AS "totalEnergy",
        COALESCE((SELECT COUNT(*) FROM day WHERE "alert"), 0)::int AS "alerts",
        COALESCE((SELECT SUM(power) FROM latest), 0)::float8 AS "currentPower",
        (SELECT json_agg(json_build_object('hour', hour, 'energy', energy) ORDER BY hour) FROM hourly) AS "hourly",
        (SELECT json_agg(json_build_object('applianceId', "applianceId", 'energy', energy)) FROM per_appliance) AS "perAppliance"
    `,
    prisma.appliance.findMany(),
    prisma.budget.findFirst({
      where: { month: now.getMonth() + 1, year: now.getFullYear() },
    }),
  ])

  const aggregate = aggregateRows[0]
  const totalEnergy = aggregate?.totalEnergy ?? 0
  const currentPower = aggregate?.currentPower ?? 0
  const alerts = aggregate?.alerts ?? 0

  const activeAppliances = appliances.filter((a) => a.status).length

  const hourlyUsage = (aggregate?.hourly ?? []).map(({ hour, energy }) => ({
    hour,
    energy: Math.round(energy * 100) / 100,
  }))

  // Grouped by appliance *name*, not id, so appliances sharing a name collapse
  // into one slice exactly as they did before.
  const applianceNames = new Map(appliances.map((a) => [a.id, a.name]))
  const applianceMap = new Map<string, number>()
  for (const { applianceId, energy } of aggregate?.perAppliance ?? []) {
    const name = applianceNames.get(applianceId)
    if (name === undefined) continue
    applianceMap.set(name, (applianceMap.get(name) || 0) + energy)
  }

  const totalApplianceEnergy = Array.from(applianceMap.values()).reduce((s, v) => s + v, 0)
  const applianceBreakdown = Array.from(applianceMap.entries())
    .map(([name, energy]) => ({
      name,
      energy: Math.round(energy * 100) / 100,
      percentage: totalApplianceEnergy > 0 ? Math.round((energy / totalApplianceEnergy) * 100) : 0,
    }))
    .sort((a, b) => b.energy - a.energy)

  return {
    totalEnergy: Math.round(totalEnergy * 100) / 100,
    currentPower: Math.round(currentPower * 100) / 100,
    activeAppliances,
    totalAppliances: appliances.length,
    budgetUsage: budget?.currentUsage ?? 0,
    budgetMaximum: budget?.maximumEnergy ?? 1000,
    alerts,
    hourlyUsage,
    applianceBreakdown,
  }
}

export const createReading = async (data: {
  applianceId: number
  energyUsed: number
  voltage?: number
  current?: number
  power?: number
}) => {
  const { applianceId, energyUsed, voltage, current, power } = data

  const appliance = await prisma.appliance.findUnique({ where: { id: applianceId } })
  if (!appliance) throw new Error('Appliance not found')

  const now = new Date()
  const budget = await prisma.budget.findFirst({
    where: { month: now.getMonth() + 1, year: now.getFullYear() },
  })

  const budgetAfter = (budget?.currentUsage ?? 0) + energyUsed
  const budgetMax = budget?.maximumEnergy ?? 1000
  const remaining = Math.max(0, budgetMax - budgetAfter)
  const alert = budgetAfter > budgetMax * 0.9

  const reading = await prisma.energyReading.create({
    data: {
      applianceId,
      energyUsed,
      voltage: voltage ?? 120,
      current: current ?? 0,
      power: power ?? 0,
      budget: budgetMax,
      remaining,
      alert,
    },
    include: { appliance: true },
  })

  if (budget) {
    await prisma.budget.update({
      where: { id: budget.id },
      data: { currentUsage: budgetAfter, status: budgetAfter >= budgetMax ? 'exceeded' : 'active' },
    })
  }

  return reading
}

export const getReadings = async (
  applianceId?: number,
  from?: Date,
  to?: Date,
  limit = 100,
  offset = 0
) => {
  const where: Record<string, unknown> = {}
  if (applianceId) where.applianceId = applianceId
  if (from || to) {
    where.timestamp = {}
    if (from) (where.timestamp as Record<string, Date>).gte = from
    if (to) (where.timestamp as Record<string, Date>).lte = to
  }

  const [readings, total] = await Promise.all([
    prisma.energyReading.findMany({
      where,
      include: { appliance: true },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.energyReading.count({ where }),
  ])

  return { readings, total }
}

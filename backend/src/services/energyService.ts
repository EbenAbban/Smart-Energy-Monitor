import prisma from '../lib/prisma'

export const getDashboardData = async () => {
  const now = new Date()
  const past24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  let readings = await prisma.energyReading.findMany({
    where: { timestamp: { gte: past24Hours } },
    include: { appliance: true },
    orderBy: { timestamp: 'desc' },
  })

  // Fallback to latest 100 readings if no data in past 24 hours
  if (readings.length === 0) {
    readings = await prisma.energyReading.findMany({
      include: { appliance: true },
      orderBy: { timestamp: 'desc' },
      take: 100,
    })
  }

  const [appliances, budget] = await Promise.all([
    prisma.appliance.findMany(),
    prisma.budget.findFirst({
      where: { month: now.getMonth() + 1, year: now.getFullYear() },
    }).then(b => b ?? prisma.budget.findFirst({ orderBy: { updatedAt: 'desc' } })),
  ])

  // Use budget.currentUsage as the authoritative total energy.
  // The old firmware sent cumulative kWh per reading, which inflates a naive
  // sum of rows. The budget tracker is the only reliable source of truth.
  const totalEnergy = Math.round((budget?.currentUsage ?? 0) * 100) / 100

  // Current power: from the most recent reading's power field
  const latestReading = readings[0]
  const currentPower = latestReading ? Math.round(latestReading.power * 100) / 100 : 0

  const activeAppliances = appliances.filter((a) => a.status).length
  const alerts = readings.filter((r) => r.alert).length

  // Readings where energyUsed > 1.0 kWh are legacy cumulative rows.
  // Skip them in charts to avoid wildly distorted bars.
  const DELTA_THRESHOLD = 1.0
  const chartReadings = readings.filter((r) => r.energyUsed <= DELTA_THRESHOLD)

  const hourlyMap = new Map<string, number>()
  for (const r of chartReadings) {
    const hour = new Date(r.timestamp).getHours().toString().padStart(2, '0') + ':00'
    hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + r.energyUsed)
  }

  const hourlyUsage = Array.from(hourlyMap.entries())
    .map(([hour, energy]) => ({ hour, energy: Math.round(energy * 100) / 100 }))
    .sort((a, b) => a.hour.localeCompare(b.hour))

  const applianceMap = new Map<string, number>()
  for (const r of chartReadings) {
    const name = r.appliance.name
    applianceMap.set(name, (applianceMap.get(name) || 0) + r.energyUsed)
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
    totalEnergy,
    currentPower,
    activeAppliances,
    totalAppliances: appliances.length,
    budgetUsage: Math.round((budget?.currentUsage ?? 0) * 100) / 100,
    budgetMaximum: budget?.maximumEnergy ?? 1000,
    alerts,
    hourlyUsage,
    applianceBreakdown,
  }
}


export const createReading = async (data: {
  applianceId?: number
  energyUsed: number
  voltage?: number
  current?: number
  power?: number
  timestamp?: number | string | Date
  budget?: number
  remaining?: number
  alert?: boolean
}) => {
  let targetApplianceId = data.applianceId

  if (!targetApplianceId) {
    const defaultAppliance = await prisma.appliance.findFirst({ orderBy: { id: 'asc' } })
    if (defaultAppliance) {
      targetApplianceId = defaultAppliance.id
    } else {
      const newAppliance = await prisma.appliance.create({
        data: {
          name: 'Main System',
          powerRating: 2300,
          relayNumber: 1,
          icon: 'zap',
        },
      })
      targetApplianceId = newAppliance.id
    }
  } else {
    const appliance = await prisma.appliance.findUnique({ where: { id: targetApplianceId } })
    if (!appliance) throw new Error('Appliance not found')
  }

  const now = new Date()
  let readingTimestamp = now
  if (data.timestamp) {
    const parsed = new Date(data.timestamp)
    if (!isNaN(parsed.getTime())) {
      readingTimestamp = parsed
    }
  }

  const budget = await prisma.budget.findFirst({
    where: { month: now.getMonth() + 1, year: now.getFullYear() },
  })

  const budgetMax = budget?.maximumEnergy ?? data.budget ?? 1000
  const budgetAfter = (budget?.currentUsage ?? 0) + data.energyUsed
  const remaining = data.remaining !== undefined ? data.remaining : Math.max(0, budgetMax - budgetAfter)
  const isAlert = data.alert !== undefined ? data.alert : budgetAfter > budgetMax * 0.9

  const reading = await prisma.energyReading.create({
    data: {
      applianceId: targetApplianceId,
      energyUsed: data.energyUsed,
      voltage: data.voltage ?? 230,
      current: data.current ?? 0,
      power: data.power ?? 0,
      timestamp: readingTimestamp,
      budget: budgetMax,
      remaining,
      alert: isAlert,
    },
    include: { appliance: true },
  })

  if (budget) {
    await prisma.budget.update({
      where: { id: budget.id },
      data: { currentUsage: budgetAfter, status: budgetAfter >= budgetMax ? 'exceeded' : 'active' },
    })
  }

  return {
    ...reading,
    budgetMaxKWh: budgetMax,
  }
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

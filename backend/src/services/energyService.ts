// Optimized for Neon PostgreSQL with 20-connection pool limit
import prisma from '../lib/prisma'

// Automatic retry helper for transient DB connection drops
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (retries > 0) {
      console.warn(`[DB Retry] Reconnecting Prisma due to transient drop... (${retries} attempts left)`)
      try { await prisma.$connect() } catch {}
      await new Promise((r) => setTimeout(r, 500))
      return withRetry(fn, retries - 1)
    }
    throw err
  }
}

let cachedDashboardData: any = null

export const getDashboardData = async () => {
  try {
    const now = new Date()
    const past24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    let readings = await withRetry(() =>
      prisma.energyReading.findMany({
        where: { timestamp: { gte: past24Hours } },
        include: { appliance: true },
        orderBy: { timestamp: 'desc' },
      })
    )

    // Fallback to latest 100 readings if no data in past 24 hours
    if (readings.length === 0) {
      readings = await withRetry(() =>
        prisma.energyReading.findMany({
          include: { appliance: true },
          orderBy: { timestamp: 'desc' },
          take: 100,
        })
      )
    }

    const [appliances, budget] = await Promise.all([
      withRetry(() => prisma.appliance.findMany()),
      withRetry(() =>
        prisma.budget.findFirst({
          where: { month: now.getMonth() + 1, year: now.getFullYear() },
        })
      ).then(b => b ?? withRetry(() => prisma.budget.findFirst({ orderBy: { updatedAt: 'desc' } }))),
    ])

  const DELTA_THRESHOLD = 1.0
  const chartReadings = readings.filter((r) => r.energyUsed <= DELTA_THRESHOLD)

  // Use budget.currentUsage or sum of readings as authoritative total energy.
  const sumReadings = chartReadings.reduce((sum: number, r: { energyUsed: number }) => sum + r.energyUsed, 0)
  const budgetUsageVal = budget?.currentUsage ?? sumReadings
  const totalEnergy = Math.round(Math.max(budgetUsageVal, sumReadings) * 10000) / 10000

  // Current power: from the most recent reading's power field
  const latestReading = readings[0]
  const currentPower = latestReading ? Math.round(latestReading.power * 100) / 100 : 0

  const activeAppliances = appliances.filter((a) => a.status).length
  const alerts = readings.filter((r) => r.alert).length

  const hourlyMap = new Map<string, number>()
  for (const r of chartReadings) {
    const hour = new Date(r.timestamp).getHours().toString().padStart(2, '0') + ':00'
    hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + r.energyUsed)
  }

  const hourlyUsage = Array.from(hourlyMap.entries())
    .map(([hour, energy]) => ({ hour, energy: Math.round(energy * 10000) / 10000 }))
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
      energy: Math.round(energy * 10000) / 10000,
      percentage: totalApplianceEnergy > 0 ? Math.round((energy / totalApplianceEnergy) * 100) : 0,
    }))
    .sort((a, b) => b.energy - a.energy)

  const result = {
    totalEnergy,
    currentPower,
    activeAppliances,
    totalAppliances: appliances.length,
    budgetUsage: Math.round((budget?.currentUsage ?? totalEnergy) * 10000) / 10000,
    budgetMaximum: budget?.maximumEnergy ?? 1000,
    alerts,
    hourlyUsage,
    applianceBreakdown,
  }

  cachedDashboardData = result
  return result
} catch (err) {
  console.warn('[Dashboard Cache Fallback] Database query failed, serving cached metrics:', (err as any)?.message)
  if (cachedDashboardData) return cachedDashboardData
  return {
    totalEnergy: 0,
    currentPower: 0,
    activeAppliances: 0,
    totalAppliances: 0,
    budgetUsage: 0,
    budgetMaximum: 1000,
    alerts: 0,
    hourlyUsage: [],
    applianceBreakdown: [],
  }
}
}


export const createReading = async (data: {
  applianceId?: number
  energyUsed: number
  voltage?: number
  current?: number
  power?: number
  frequency?: number
  powerFactor?: number
  timestamp?: number | string | Date
  budget?: number
  remaining?: number
  alert?: boolean
}) => {
  let targetApplianceId = data.applianceId
  let applianceName = 'Main System'

  try {
    if (!targetApplianceId) {
      const defaultAppliance = await withRetry(() => prisma.appliance.findFirst({ orderBy: { id: 'asc' } }))
      if (defaultAppliance) {
        targetApplianceId = defaultAppliance.id
        applianceName = defaultAppliance.name
      } else {
        const newAppliance = await withRetry(() =>
          prisma.appliance.create({
            data: {
              name: 'Main System',
              powerRating: 2300,
              relayNumber: 1,
              icon: 'zap',
            },
          })
        )
        targetApplianceId = newAppliance.id
        applianceName = newAppliance.name
      }
    } else {
      const appliance = await withRetry(() => prisma.appliance.findUnique({ where: { id: targetApplianceId } }))
      if (appliance) {
        applianceName = appliance.name
      } else {
        targetApplianceId = 1
      }
    }
  } catch (err) {
    targetApplianceId = targetApplianceId ?? 1
  }

  const now = new Date()
  let readingTimestamp = now
  if (data.timestamp) {
    const parsed = new Date(data.timestamp)
    if (!isNaN(parsed.getTime())) {
      readingTimestamp = parsed
    }
  }

  let budgetMax = data.budget ?? 1000
  let budgetAfter = data.energyUsed
  let remaining = data.remaining !== undefined ? data.remaining : Math.max(0, budgetMax - budgetAfter)
  let isAlert = data.alert !== undefined ? data.alert : false

  try {
    const budget = await withRetry(() =>
      prisma.budget.findFirst({
        where: { month: now.getMonth() + 1, year: now.getFullYear() },
      })
    )

    budgetMax = budget?.maximumEnergy ?? data.budget ?? 1000
    const rawCumulative = (data as any).energy
    const baseUsage = (budget?.currentUsage ?? 0) + data.energyUsed
    budgetAfter = rawCumulative !== undefined && typeof rawCumulative === 'number' && rawCumulative > baseUsage ? rawCumulative : baseUsage
    remaining = data.remaining !== undefined ? data.remaining : Math.max(0, budgetMax - budgetAfter)
    isAlert = data.alert !== undefined ? data.alert : budgetAfter >= budgetMax * 0.9

    const isExceeded = budgetAfter >= budgetMax

    const reading = await withRetry(() =>
      prisma.energyReading.create({
        data: {
          applianceId: targetApplianceId!,
          energyUsed: data.energyUsed,
          voltage: data.voltage && data.voltage > 0 ? data.voltage : 230,
          current: data.current ?? 0,
          power: data.power !== undefined && data.power >= 0 ? data.power : ((data.current ?? 0) * (data.voltage ?? 230)),
          frequency: data.frequency ?? 50,
          powerFactor: data.powerFactor ?? 1.0,
          timestamp: readingTimestamp,
          budget: budgetMax,
          remaining,
          alert: isAlert || isExceeded,
        },
        include: { appliance: true },
      })
    )

    if (budget) {
      await withRetry(() =>
        prisma.budget.update({
          where: { id: budget.id },
          data: { currentUsage: budgetAfter, status: isExceeded ? 'exceeded' : 'active' },
        })
      )
    } else {
      await withRetry(() =>
        prisma.budget.create({
          data: {
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            maximumEnergy: budgetMax,
            currentUsage: budgetAfter,
            status: isExceeded ? 'exceeded' : 'active',
          },
        })
      )
    }

    // Auto-cut appliances in DB when budget is exceeded
    if (isExceeded) {
      await withRetry(() => prisma.appliance.updateMany({ data: { status: false } }))
    }

    return {
      ...reading,
      budgetMaxKWh: budgetMax,
    }
  } catch (err) {
    console.warn('[CreateReading Fallback] Transient DB error, returning memory reading:', (err as any)?.message)
    return {
      id: Date.now(),
      applianceId: targetApplianceId!,
      energyUsed: data.energyUsed,
      voltage: data.voltage ?? 230,
      current: data.current ?? 0,
      power: data.power ?? 0,
      frequency: data.frequency ?? 50,
      powerFactor: data.powerFactor ?? 1.0,
      timestamp: readingTimestamp,
      budget: budgetMax,
      remaining,
      alert: isAlert,
      budgetMaxKWh: budgetMax,
      appliance: {
        id: targetApplianceId!,
        name: applianceName,
        powerRating: 2300,
        relayNumber: 1,
        status: true,
        icon: 'zap',
        createdAt: now,
        updatedAt: now,
      },
    }
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

  try {
    const [readings, total] = await Promise.all([
      withRetry(() =>
        prisma.energyReading.findMany({
          where,
          include: { appliance: true },
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset,
        })
      ),
      withRetry(() => prisma.energyReading.count({ where })),
    ])

    return { readings, total }
  } catch (err) {
    console.warn('[GetReadings Fallback] Database query failed, returning empty readings array:', (err as any)?.message)
    return { readings: [], total: 0 }
  }
}

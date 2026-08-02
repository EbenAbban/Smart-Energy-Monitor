import prisma from '../lib/prisma'

export const getDashboardData = async () => {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [readings, appliances, budget] = await Promise.all([
    prisma.energyReading.findMany({
      where: { timestamp: { gte: startOfDay } },
      include: { appliance: true },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.appliance.findMany(),
    prisma.budget.findFirst({
      where: { month: now.getMonth() + 1, year: now.getFullYear() },
    }),
  ])

  const totalEnergy = readings.reduce((sum, r) => sum + r.energyUsed, 0)
  const latestReadings = new Map<number, number>()

  for (const r of readings) {
    if (!latestReadings.has(r.applianceId)) {
      latestReadings.set(r.applianceId, r.power)
    }
  }

  const currentPower = Array.from(latestReadings.values()).reduce((sum, p) => sum + p, 0)
  const activeAppliances = appliances.filter((a) => a.status).length
  const alerts = readings.filter((r) => r.alert).length

  const hourlyMap = new Map<string, number>()
  for (const r of readings) {
    const hour = new Date(r.timestamp).getHours().toString().padStart(2, '0') + ':00'
    hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + r.energyUsed)
  }

  const hourlyUsage = Array.from(hourlyMap.entries())
    .map(([hour, energy]) => ({ hour, energy: Math.round(energy * 100) / 100 }))
    .sort((a, b) => a.hour.localeCompare(b.hour))

  const applianceMap = new Map<string, number>()
  for (const r of readings) {
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

import prisma from '../lib/prisma'

let cachedAppliances: any[] = [
  { id: 1, name: 'Main Power Load', powerRating: 2300, status: true, relayNumber: 1, icon: 'zap' }
]

export const getAppliances = async () => {
  try {
    const appliances = await prisma.appliance.findMany({ orderBy: { id: 'asc' } })
    if (appliances.length > 0) cachedAppliances = appliances
    return appliances
  } catch (err: any) {
    console.warn('[Appliance Cache Fallback] Database query failed, returning cached appliances:', err?.message)
    return cachedAppliances
  }
}

export const getApplianceById = async (id: number) => {
  try {
    return await prisma.appliance.findUnique({ where: { id } })
  } catch (err: any) {
    console.warn('[Appliance Cache Fallback] getApplianceById failed:', err?.message)
    return cachedAppliances.find((a) => a.id === id) ?? cachedAppliances[0]
  }
}

export const updateApplianceStatus = async (id: number, status: boolean) => {
  try {
    const updated = await prisma.appliance.update({
      where: { id },
      data: { status },
    })
    cachedAppliances = cachedAppliances.map((a) => (a.id === id ? { ...a, status } : a))
    return updated
  } catch (err: any) {
    console.warn('[Appliance Status Fallback] Database update failed, updating cached memory status:', err?.message)
    cachedAppliances = cachedAppliances.map((a) => (a.id === id ? { ...a, status } : a))
    const item = cachedAppliances.find((a) => a.id === id) ?? cachedAppliances[0]
    return { ...item, status }
  }
}

export const updateApplianceStatusByRelay = async (relayNumber: number, status: boolean) => {
  try {
    const appliance = await prisma.appliance.findFirst({ where: { relayNumber } })
    if (!appliance) {
      // Create if missing
      const newApp = await prisma.appliance.create({
        data: { name: 'Main Power Load', powerRating: 2300, status, relayNumber, icon: 'zap' }
      })
      return newApp
    }
    const updated = await prisma.appliance.update({
      where: { id: appliance.id },
      data: { status },
    })
    cachedAppliances = cachedAppliances.map((a) => (a.relayNumber === relayNumber ? { ...a, status } : a))
    return updated
  } catch (err: any) {
    console.warn('[Relay Status Fallback] Database update failed, updating cached memory status:', err?.message)
    cachedAppliances = cachedAppliances.map((a) => (a.relayNumber === relayNumber ? { ...a, status } : a))
    const item = cachedAppliances.find((a) => a.relayNumber === relayNumber) ?? cachedAppliances[0]
    return { ...item, status }
  }
}

export const createAppliance = async (data: {
  name: string
  powerRating: number
  relayNumber: number
  icon?: string
}) => {
  try {
    const newApp = await prisma.appliance.create({
      data: {
        name: data.name,
        powerRating: data.powerRating,
        relayNumber: data.relayNumber,
        icon: data.icon ?? 'plug',
      },
    })
    cachedAppliances.push(newApp)
    return newApp
  } catch (err: any) {
    console.warn('[CreateAppliance Fallback] DB unavailable, creating memory item:', err?.message)
    const memoryItem = {
      id: Date.now(),
      name: data.name,
      powerRating: data.powerRating,
      relayNumber: data.relayNumber,
      icon: data.icon ?? 'plug',
      status: false,
    }
    cachedAppliances.push(memoryItem)
    return memoryItem
  }
}

export const deleteAppliance = async (id: number) => {
  try {
    await prisma.energyReading.deleteMany({ where: { applianceId: id } })
    await prisma.appliance.delete({ where: { id } })
  } catch (err: any) {
    console.warn('[DeleteAppliance Fallback] DB error:', err?.message)
  }
  cachedAppliances = cachedAppliances.filter((a) => a.id !== id)
}

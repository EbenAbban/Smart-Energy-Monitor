import prisma from '../lib/prisma'

export const getAppliances = async () => {
  return prisma.appliance.findMany({ orderBy: { id: 'asc' } })
}

export const getApplianceById = async (id: number) => {
  return prisma.appliance.findUnique({ where: { id } })
}

export const updateApplianceStatus = async (id: number, status: boolean) => {
  return prisma.appliance.update({
    where: { id },
    data: { status },
  })
}

export const updateApplianceStatusByRelay = async (relayNumber: number, status: boolean) => {
  const appliance = await prisma.appliance.findFirst({ where: { relayNumber } })
  if (!appliance) throw new Error(`Appliance with relayNumber ${relayNumber} not found`)
  return prisma.appliance.update({
    where: { id: appliance.id },
    data: { status },
  })
}


export const createAppliance = async (data: {
  name: string
  powerRating: number
  relayNumber: number
  icon?: string
}) => {
  return prisma.appliance.create({
    data: {
      name: data.name,
      powerRating: data.powerRating,
      relayNumber: data.relayNumber,
      icon: data.icon ?? 'plug',
    },
  })
}

export const deleteAppliance = async (id: number) => {
  await prisma.energyReading.deleteMany({ where: { applianceId: id } })
  return prisma.appliance.delete({ where: { id } })
}


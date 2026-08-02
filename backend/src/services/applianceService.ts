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

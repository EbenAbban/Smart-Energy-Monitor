import prisma from '../lib/prisma'

export const getCurrentBudget = async () => {
  const now = new Date()
  return prisma.budget.findFirst({
    where: { month: now.getMonth() + 1, year: now.getFullYear() },
  })
}

export const setBudget = async (maximumEnergy: number) => {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  return prisma.budget.upsert({
    where: { month_year: { month, year } },
    update: { maximumEnergy },
    create: { month, year, maximumEnergy },
  })
}

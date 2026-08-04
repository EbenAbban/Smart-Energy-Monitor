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

/**
 * Called once on server startup to guarantee a budget row exists for the
 * current month. If none exists, creates a sensible default (1000 kWh).
 * This prevents the ESP32 from receiving null/inconsistent budget values.
 */
export const ensureMonthlyBudget = async () => {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  await prisma.budget.upsert({
    where: { month_year: { month, year } },
    update: {},  // don't overwrite an existing budget
    create: { month, year, maximumEnergy: 1000, currentUsage: 0, status: 'active' },
  })
  console.log(`[Budget] Monthly budget for ${year}-${String(month).padStart(2,'0')} ensured.`)
}

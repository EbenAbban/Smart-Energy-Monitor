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

  // Read the current budget row so we can decide whether a carry-over is needed
  const existing = await prisma.budget.findFirst({ where: { month, year } })

  // Only carry over when the budget was previously exceeded (i.e. a recharge scenario).
  // A plain increase while still within limits must NOT touch currentUsage.
  let carryOver: number | undefined
  if (existing?.status === 'exceeded') {
    // Overflow = units consumed beyond the old limit (clamped to ≥ 0)
    carryOver = Math.max(0, (existing.currentUsage ?? 0) - (existing.maximumEnergy ?? 0))
  }

  const isRecharge = carryOver !== undefined

  return prisma.budget.upsert({
    where: { month_year: { month, year } },
    update: {
      maximumEnergy,
      ...(isRecharge
        ? {
            currentUsage: carryOver,
            // Re-exceed guard: if the overflow itself is already ≥ new max, stay exceeded
            status: (carryOver as number) < maximumEnergy ? 'active' : 'exceeded',
          }
        : {}),
    },
    create: { month, year, maximumEnergy, currentUsage: 0, status: 'active' },
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

// Quick one-shot script to reset the budget for the current month
// Run with: node reset-budget.js
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  const result = await prisma.budget.upsert({
    where:  { month_year: { month, year } },
    update: { maximumEnergy: 500, currentUsage: 0, status: 'active' },
    create: { month, year, maximumEnergy: 500, currentUsage: 0, status: 'active' },
  })

  console.log('[Budget] Reset result:', result)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })

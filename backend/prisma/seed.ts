import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding initial baseline database (No mock readings)...')

  // Clean existing sample readings to ensure 100% real hardware telemetry
  await prisma.energyReading.deleteMany({})

  const existingAppliances = await prisma.appliance.findMany()
  if (existingAppliances.length === 0) {
    await Promise.all([
      prisma.appliance.create({
        data: { name: 'Main Power Load', powerRating: 2300, status: true, relayNumber: 1, icon: 'zap' },
      }),
      prisma.appliance.create({
        data: { name: 'Air Conditioner (Virtual)', powerRating: 2000, status: false, relayNumber: 2, icon: 'air-conditioner' },
      }),
      prisma.appliance.create({
        data: { name: 'Washing Machine (Virtual)', powerRating: 500, status: false, relayNumber: 3, icon: 'washing-machine' },
      }),
      prisma.appliance.create({
        data: { name: 'Television (Virtual)', powerRating: 120, status: false, relayNumber: 4, icon: 'tv' },
      }),
    ])
  }

  const now = new Date()
  const existingBudget = await prisma.budget.findFirst({
    where: { month: now.getMonth() + 1, year: now.getFullYear() },
  })

  if (!existingBudget) {
    await prisma.budget.create({
      data: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        maximumEnergy: 500,
        currentUsage: 0,
        status: 'active',
      },
    })
  }

  console.log('✅ Base Database Initialized! Zero mock readings stored. Ready for live ESP32 telemetry.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

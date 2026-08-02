import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const appliances = await Promise.all([
    prisma.appliance.create({
      data: { name: 'Refrigerator', powerRating: 150, status: true, relayNumber: 1, icon: 'refrigerator' },
    }),
    prisma.appliance.create({
      data: { name: 'Air Conditioner', powerRating: 2000, status: true, relayNumber: 2, icon: 'air-conditioner' },
    }),
    prisma.appliance.create({
      data: { name: 'Washing Machine', powerRating: 500, status: false, relayNumber: 3, icon: 'washing-machine' },
    }),
    prisma.appliance.create({
      data: { name: 'Television', powerRating: 120, status: true, relayNumber: 4, icon: 'tv' },
    }),
    prisma.appliance.create({
      data: { name: 'Microwave', powerRating: 1000, status: false, relayNumber: 5, icon: 'microwave' },
    }),
    prisma.appliance.create({
      data: { name: 'Water Heater', powerRating: 3000, status: false, relayNumber: 6, icon: 'water-heater' },
    }),
  ])

  await prisma.budget.create({
    data: {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      maximumEnergy: 500,
      currentUsage: 0,
      status: 'active',
    },
  })

  const now = new Date()
  const readings = []
  for (let hour = 0; hour < 24; hour++) {
    for (const appliance of appliances) {
      if (appliance.status) {
        const baseEnergy = (appliance.powerRating / 1000) * (Math.random() * 0.5 + 0.5)
        readings.push({
          applianceId: appliance.id,
          energyUsed: Math.round(baseEnergy * 100) / 100,
          voltage: 120,
          current: Math.round((baseEnergy * 1000) / 120 * 100) / 100,
          power: Math.round(baseEnergy * 1000 * 100) / 100,
          timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, Math.floor(Math.random() * 60)),
          budget: 500,
          remaining: 500,
          alert: false,
        })
      }
    }
  }

  for (const r of readings) {
    await prisma.energyReading.create({ data: r })
  }

  console.log(`Seeded ${appliances.length} appliances and ${readings.length} readings`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

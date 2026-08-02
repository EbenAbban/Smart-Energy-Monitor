import { PrismaClient } from '@prisma/client'

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

const COLD_START_RETRIES = 3
const COLD_START_BASE_DELAY_MS = 400

function isColdStartError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("Can't reach database server")
}

// Neon (free tier) suspends its compute after a period of inactivity. The first
// query after a suspend fails while the compute wakes back up, even though the
// database is otherwise healthy. Retry transparently instead of surfacing that
// as a real outage to every route.
const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ args, query }) {
      let attempt = 0
      for (;;) {
        try {
          return await query(args)
        } catch (err) {
          if (!isColdStartError(err) || attempt >= COLD_START_RETRIES) throw err
          attempt += 1
          await new Promise((resolve) => setTimeout(resolve, COLD_START_BASE_DELAY_MS * attempt))
        }
      }
    },
  },
})

export default prisma

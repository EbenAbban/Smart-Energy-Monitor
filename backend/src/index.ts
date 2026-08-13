import express, { Request, Response, NextFunction } from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'
import prisma from './lib/prisma'
import readingsRouter from './routes/readings'
import appliancesRouter from './routes/appliances'
import budgetRouter from './routes/budget'
import dashboardRouter from './routes/dashboard'

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT'] },
})

app.use(cors())
app.use(express.json())
app.set('io', io)

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  socket.on('subscribe', (room: string) => {
    socket.join(room)
  })

  socket.on('unsubscribe', (room: string) => {
    socket.leave(room)
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

app.use('/api/readings', readingsRouter)
app.use('/api/appliances', appliancesRouter)
app.use('/api/budget', budgetRouter)
app.use('/api/dashboard', dashboardRouter)

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'degraded', database: 'disconnected', timestamp: new Date().toISOString() })
  }
})

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' })
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT || 4000
server.listen(PORT, () => {
  console.log(`Smart Energy Monitor backend running on http://localhost:${PORT}`)
})

// Neon suspends its compute after a few minutes of inactivity, and the first
// query after that pays a multi-second cold-start cost. Pinging on an interval
// shorter than the suspend timeout keeps the compute warm for as long as this
// process runs. Fired once immediately too, since setInterval only fires
// after the first delay elapses -- without this, a fresh backend start left
// idle (e.g. while waiting on something else) can still hit a cold start.
const KEEP_ALIVE_INTERVAL_MS = 60 * 1000
const RETRY_DELAY_MS = 5 * 1000

// A ping can land mid-wake and fail outright rather than just being slow.
// One retry a few seconds later closes that gap instead of leaving the
// connection cold for the rest of the interval.
const pingDatabase = (isRetry = false) => {
  prisma.$queryRaw`SELECT 1`.catch((err) => {
    console.error(`Keep-alive ping failed${isRetry ? ' (retry)' : ''}:`, err)
    if (!isRetry) setTimeout(() => pingDatabase(true), RETRY_DELAY_MS)
  })
}
pingDatabase()
setInterval(() => pingDatabase(), KEEP_ALIVE_INTERVAL_MS)

process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  server.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  server.close()
  process.exit(0)
})

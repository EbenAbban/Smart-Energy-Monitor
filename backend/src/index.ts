import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

import express, { Request, Response, NextFunction } from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'
import prisma from './lib/prisma'
import readingsRouter from './routes/readings'
import appliancesRouter from './routes/appliances'
import budgetRouter from './routes/budget'
import dashboardRouter from './routes/dashboard'
import { ensureMonthlyBudget } from './services/budgetService'

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

import os from 'os'

const PORT = Number(process.env.PORT) || 4000
const HOST = '0.0.0.0'

server.listen(PORT, HOST, () => {
  console.log(`\nSmart Energy Monitor backend running on http://localhost:${PORT}`)
  console.log('📡 Available LAN IP addresses for ESP32 SERVER_HOST:')
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`   -> http://${iface.address}:${PORT}`)
      }
    }
  }
  console.log('')

  // Ensure a budget row exists for the current month
  ensureMonthlyBudget().catch((err) => console.error('[Budget] Startup seed failed:', err))
})

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

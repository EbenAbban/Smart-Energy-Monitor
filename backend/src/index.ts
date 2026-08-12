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
app.use(express.json());
// Request logger for debugging POST payloads
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.originalUrl}`, req.body);
  next();
});
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

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' })
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

import os from 'os'
import dgram from 'dgram'

const PORT = Number(process.env.PORT) || 4000
const HOST = '0.0.0.0'

server.listen(PORT, HOST, () => {
  console.log(`\nSmart Energy Monitor backend running on http://localhost:${PORT}`)
  console.log('📡 Available LAN IP addresses for ESP32 SERVER_HOST:')
  const lanIps: string[] = []
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        lanIps.push(iface.address)
        console.log(`   -> http://${iface.address}:${PORT}`)
      }
    }
  }
  console.log('')
  
  // Start UDP Discovery Broadcaster for ESP32 on port 4001
  if (lanIps.length > 0) {
    const udpSocket = dgram.createSocket('udp4')
    udpSocket.bind(() => {
      udpSocket.setBroadcast(true)
      setInterval(() => {
        for (const ip of lanIps) {
          const message = Buffer.from(`SMART_ENERGY_MONITOR_BACKEND:http://${ip}:${PORT}`)
          udpSocket.send(message, 0, message.length, 4001, '255.255.255.255', (err) => {
            if (err && (err as any).code !== 'ERR_SOCKET_BAD_PORT') {
              // ignore minor socket errors
            }
          })
        }
      }, 3000)
      console.log('📡 UDP Auto-Discovery Broadcaster active on port 4001')
    })
  }

  // Set a generous request timeout to accommodate Neon cold‑start
  server.timeout = 30000; // 30 seconds
  // Ensure a budget row exists for the current month
  ensureMonthlyBudget().catch((err) => console.error('[Budget] Startup seed failed:', err));
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

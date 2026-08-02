'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/services/api'
import { connectSocket } from '@/services/socket'
import { Card, CardContent, CardHeader, CardTitle, MotionCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CardSkeleton } from '@/components/ui/skeleton'
import { AnimatedPage, FadeUp, HoverScale, CountUp } from '@/components/animations'
import { GaugeChart } from '@/components/ui/gauge'
import { Zap, Activity, Gauge, Wifi, WifiOff } from 'lucide-react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts'
import type { EnergyReading } from '@/types'
import { formatEnergy, formatPower } from '@/lib/utils'

export default function LivePage() {
  const [readings, setReadings] = useState<EnergyReading[]>([])
  const [latest, setLatest] = useState<EnergyReading | null>(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const readingsEndRef = useRef<HTMLDivElement>(null)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    api.getReadings({ limit: 50 })
      .then((res) => {
        setReadings(res.readings.reverse())
        if (res.readings.length > 0) setLatest(res.readings[0])
      })
      .catch(console.error)
      .finally(() => setLoading(false))

    const socket = connectSocket()
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('reading', (data: EnergyReading) => {
      setLatest(data)
      setPulse(true)
      setTimeout(() => setPulse(false), 300)
      setReadings((prev) => {
        const next = [...prev, data]
        return next.length > 100 ? next.slice(-100) : next
      })
    })

    return () => { socket.off('reading') }
  }, [])

  useEffect(() => {
    readingsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [readings])

  return (
    <AnimatedPage>
      <FadeUp className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white light:text-gray-900">Live Monitoring</h1>
          <p className="text-sm text-gray-400 light:text-gray-500">Real-time energy readings from ESP32</p>
        </div>
        <motion.div
          animate={{ scale: connected ? 1 : 1 }}
          transition={{ duration: 0.3 }}
        >
          <Badge variant={connected ? 'success' : 'danger'} className="gap-1">
            {connected ? (
              <Wifi className="h-3 w-3 animate-pulse" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {connected ? 'Connected' : 'Disconnected'}
          </Badge>
        </motion.div>
      </FadeUp>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4 mb-6">{[1,2,3,4].map(i => <CardSkeleton key={i} />)}</div>
      ) : (
        <>
          <motion.div layout className="grid gap-4 md:grid-cols-4 mb-6">
            <HoverScale>
              <MotionCard animate={{ scale: pulse ? 1.01 : 1 }} transition={{ duration: 0.2 }}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400 light:text-gray-500">Latest Reading</CardTitle>
                  <Zap className={`h-4 w-4 text-emerald-500 ${pulse ? 'animate-ping' : ''}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white light:text-gray-900">
                    {latest ? <CountUp value={latest.energyUsed} suffix=" kWh" /> : '--'}
                  </div>
                  <p className="text-xs text-gray-500">{latest?.appliance?.name ?? 'N/A'}</p>
                </CardContent>
              </MotionCard>
            </HoverScale>

            <HoverScale>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400 light:text-gray-500">Power</CardTitle>
                  <Activity className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white light:text-gray-900">
                    {latest ? <CountUp value={latest.power} decimals={1} suffix=" W" /> : '--'}
                  </div>
                  <p className="text-xs text-gray-500">{latest?.voltage ?? '--'}V / {latest?.current ?? '--'}A</p>
                </CardContent>
              </Card>
            </HoverScale>

            <HoverScale>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400 light:text-gray-500">Budget Usage</CardTitle>
                  <Gauge className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  {latest ? (
                    <GaugeChart
                      value={latest.budget - latest.remaining}
                      max={latest.budget}
                      label="Used this month"
                      unit=" kWh"
                      size={160}
                    />
                  ) : (
                    <div className="flex h-20 items-center justify-center text-gray-500">--</div>
                  )}
                </CardContent>
              </Card>
            </HoverScale>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-500 animate-float" />
                  Live Stream
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={readings.slice(-30)}>
                      <defs>
                        <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" className="light:opacity-30" />
                      <XAxis
                        dataKey="timestamp" stroke="#6b7280" fontSize={12}
                        tickFormatter={(v) => new Date(v).toLocaleTimeString()}
                      />
                      <YAxis stroke="#6b7280" fontSize={12} unit=" kWh" />
                      <Tooltip
                        contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }}
                        labelFormatter={(v) => new Date(String(v)).toLocaleString()}
                      />
                      <Area type="monotone" dataKey="energyUsed" stroke="#10b981" strokeWidth={2} fill="url(#colorEnergy)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Recent Readings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  <AnimatePresence>
                    {readings.slice().reverse().map((r) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        layout
                        className="flex items-center justify-between rounded-lg border border-gray-800 light:border-gray-200 px-4 py-3 text-sm hover:bg-gray-900/50 light:hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <motion.span
                            className={`h-2 w-2 rounded-full ${r.alert ? 'bg-red-500' : 'bg-emerald-500'}`}
                            animate={{ scale: r.alert ? [1, 1.3, 1] : 1 }}
                            transition={{ repeat: r.alert ? Infinity : 0, duration: 1.5 }}
                          />
                          <span className="text-gray-300 light:text-gray-700">{r.appliance?.name ?? `Appliance #${r.applianceId}`}</span>
                        </div>
                        <div className="flex items-center gap-4 text-gray-400 light:text-gray-500">
                          <span>{formatEnergy(r.energyUsed)}</span>
                          <span>{formatPower(r.power)}</span>
                          <span className="text-xs">{new Date(r.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <div ref={readingsEndRef} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatedPage>
  )
}

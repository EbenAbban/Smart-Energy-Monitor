'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSkeleton } from '@/components/ui/skeleton'
import { AnimatedPage, FadeUp } from '@/components/animations'
import { downloadCSV } from '@/lib/export'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Download, ChevronLeft, ChevronRight, Search, History as HistoryIcon } from 'lucide-react'
import type { Appliance, ReadingsResponse, EnergyReading } from '@/types'
import { formatEnergy, formatPower } from '@/lib/utils'

export default function HistoryPage() {
  const [data, setData] = useState<ReadingsResponse | null>(null)
  const [appliances, setAppliances] = useState<Appliance[]>([])
  const [applianceId, setApplianceId] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const limit = 20

  useEffect(() => {
    api.getAppliances().then(setAppliances).catch(console.error)
  }, [])

  useEffect(() => {
    const params: { limit: number; offset: number; applianceId?: number } = { limit, offset: page * limit }
    if (applianceId !== 'all') params.applianceId = Number(applianceId)
    Promise.resolve()
      .then(() => setLoading(true))
      .then(() => api.getReadings(params))
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [applianceId, page])

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  const handleExport = async () => {
    setExporting(true)
    try {
      const allData = await api.getReadings({ limit: data?.total ?? 1000 })
      const rows = allData.readings.map((r: EnergyReading) => ({
        Timestamp: new Date(r.timestamp).toISOString(),
        Appliance: r.appliance?.name ?? `Appliance #${r.applianceId}`,
        'Energy (kWh)': r.energyUsed.toFixed(4),
        'Power (W)': r.power.toFixed(1),
        'Voltage (V)': r.voltage.toFixed(1),
        'Current (A)': r.current.toFixed(3),
        Budget: r.budget.toFixed(1),
        Remaining: r.remaining.toFixed(1),
        Alert: r.alert ? 'Yes' : 'No',
      }))
      downloadCSV(rows, `energy-monitor-readings-${new Date().toISOString().split('T')[0]}`)
    } catch (err) {
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <AnimatedPage>
      <FadeUp className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white light:text-gray-900">History</h1>
          <p className="text-sm text-gray-400 light:text-gray-500">Past energy consumption records</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={applianceId} onValueChange={(v) => { setApplianceId(v); setPage(0) }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Appliances" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Appliances</SelectItem>
              {appliances.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={handleExport}
              disabled={exporting || !data?.readings.length}
            >
              <Download className={`h-4 w-4 ${exporting ? 'animate-spin' : ''}`} />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </motion.div>
        </div>
      </FadeUp>

      <motion.div layout>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4 text-emerald-500" />
              Energy Readings
              {data && <span className="text-sm font-normal text-gray-500">({data.total} total)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton rows={limit} />
            ) : data?.readings.length === 0 ? (
              <EmptyState
                icon={<HistoryIcon className="h-8 w-8" />}
                title="No readings found"
                description="Try changing the filter or waiting for new data from your ESP32."
              />
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {data?.readings.map((r) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between rounded-lg border border-gray-800 light:border-gray-200 px-4 py-3 hover:bg-gray-900/50 light:hover:bg-gray-50 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white light:text-gray-900">
                            {r.appliance?.name ?? `Appliance #${r.applianceId}`}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(r.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm text-gray-300 light:text-gray-700">{formatEnergy(r.energyUsed)}</p>
                          <p className="text-xs text-gray-500">{formatPower(r.power)}</p>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <p>{r.voltage}V</p>
                          <p>{r.current.toFixed(2)}A</p>
                        </div>
                        {r.alert && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring' }}
                          >
                            <Badge variant="danger">Alert</Badge>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {totalPages > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 flex items-center justify-between border-t border-gray-800 light:border-gray-200 pt-4"
              >
                <p className="text-sm text-gray-500">
                  Page {page + 1} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatedPage>
  )
}

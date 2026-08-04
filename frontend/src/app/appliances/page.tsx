'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/services/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { CardSkeleton } from '@/components/ui/skeleton'
import { AnimatedPage, FadeUp, HoverScale, StaggerGrid } from '@/components/animations'
import {
  Power, PowerOff, Refrigerator, Tv, AirVent, WashingMachine, Microwave, Waves, Plus, Trash2, Zap
} from 'lucide-react'
import type { Appliance } from '@/types'
import { formatPower } from '@/lib/utils'

const iconMap: Record<string, React.ReactNode> = {
  refrigerator: <Refrigerator className="h-8 w-8" />,
  'air-conditioner': <AirVent className="h-8 w-8" />,
  'washing-machine': <WashingMachine className="h-8 w-8" />,
  tv: <Tv className="h-8 w-8" />,
  microwave: <Microwave className="h-8 w-8" />,
  'water-heater': <Waves className="h-8 w-8" />,
}

export default function AppliancesPage() {
  const [appliances, setAppliances] = useState<Appliance[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form state for creating a new appliance
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newAppliance, setNewAppliance] = useState({
    name: '',
    powerRating: 100,
    relayNumber: 1,
    icon: 'refrigerator',
  })

  const confirmAppliance = confirmId ? appliances.find((a) => a.id === confirmId) : null
  const deleteTarget = deleteId ? appliances.find((a) => a.id === deleteId) : null

  useEffect(() => {
    api.getAppliances()
      .then(setAppliances)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const toggleStatus = useCallback(async (appliance: Appliance) => {
    setToggling(appliance.id)
    setConfirmId(null)
    try {
      const updated = await api.updateApplianceStatus(appliance.id, !appliance.status)
      setAppliances((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    } catch (err) {
      console.error(err)
    } finally {
      setToggling(null)
    }
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAppliance.name.trim()) return
    setIsSubmitting(true)
    try {
      const created = await api.createAppliance(newAppliance)
      setAppliances((prev) => [...prev, created])
      setIsAddOpen(false)
      setNewAppliance({ name: '', powerRating: 100, relayNumber: 1, icon: 'refrigerator' })
    } catch (err) {
      console.error('Failed to create appliance:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.deleteAppliance(deleteId)
      setAppliances((prev) => prev.filter((a) => a.id !== deleteId))
      setDeleteId(null)
    } catch (err) {
      console.error('Failed to delete appliance:', err)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <AnimatedPage>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <CardSkeleton key={i} />)}
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage>
      <FadeUp className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white light:text-gray-900">Appliances</h1>
          <p className="text-sm text-gray-400 light:text-gray-500">Monitor and manage connected appliances</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
          <Plus className="h-4 w-4" />
          Install Appliance
        </Button>
      </FadeUp>

      <StaggerGrid className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {appliances.map((appliance) => (
          <HoverScale key={appliance.id}>
            <Card className={appliance.status ? 'border-emerald-800/50 light:border-emerald-300' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: appliance.status ? [0, -5, 5, 0] : 0 }}
                      transition={{ duration: 0.4 }}
                      className={`rounded-lg p-2 ${
                        appliance.status
                          ? 'bg-emerald-500/20 light:bg-emerald-100 text-emerald-400 light:text-emerald-600'
                          : 'bg-gray-800 light:bg-gray-100 text-gray-500 light:text-gray-400'
                      }`}
                    >
                      {iconMap[appliance.icon] ?? <Zap className="h-8 w-8" />}
                    </motion.div>
                    <div>
                      <h3 className="font-semibold text-white light:text-gray-900">{appliance.name}</h3>
                      <p className="text-sm text-gray-400 light:text-gray-500">{formatPower(appliance.powerRating)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={appliance.status ? 'success' : 'default'}>
                      {appliance.status ? 'ON' : 'OFF'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(appliance.id)}
                      className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 p-1.5 h-auto"
                      title="Uninstall / Remove appliance"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-gray-500 light:text-gray-400">
                  <span>Relay #{appliance.relayNumber}</span>
                  <Button
                    variant={appliance.status ? 'destructive' : 'secondary'}
                    size="sm"
                    onClick={() => setConfirmId(appliance.id)}
                    disabled={toggling === appliance.id}
                    className="gap-1 transition-all"
                  >
                    {toggling === appliance.id ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        className="h-4 w-4 rounded-full border-2 border-white border-t-transparent inline-block"
                      />
                    ) : appliance.status ? (
                      <PowerOff className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                    {appliance.status ? 'Turn Off' : 'Turn On'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </HoverScale>
        ))}
      </StaggerGrid>

      {/* Toggle Status Confirmation Dialog */}
      <Dialog
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        title={confirmAppliance?.status ? 'Turn Off Appliance' : 'Turn On Appliance'}
        description={`Are you sure you want to ${confirmAppliance?.status ? 'turn off' : 'turn on'} ${confirmAppliance?.name ?? 'this appliance'}?`}
        actions={
          <>
            <Button variant="outline" onClick={() => setConfirmId(null)}>Cancel</Button>
            <Button
              variant={confirmAppliance?.status ? 'destructive' : 'default'}
              onClick={() => confirmAppliance && toggleStatus(confirmAppliance)}
              className="gap-1"
            >
              {confirmAppliance?.status ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
              Yes, {confirmAppliance?.status ? 'Turn Off' : 'Turn On'}
            </Button>
          </>
        }
      />

      {/* Delete Appliance Confirmation Dialog */}
      <Dialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Remove Appliance"
        description={`Are you sure you want to remove "${deleteTarget?.name}" from monitoring? This action cannot be undone.`}
        actions={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1 bg-red-600 hover:bg-red-500"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Removing...' : 'Remove Appliance'}
            </Button>
          </>
        }
      />

      {/* Install / Add Appliance Modal Dialog */}
      <Dialog
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Install New Appliance"
        description="Configure a new appliance to monitor power consumption and relay state."
        actions={null}
      >
        <form onSubmit={handleCreate} className="space-y-4 mt-2">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Appliance Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Microwave, Air Conditioner"
              value={newAppliance.name}
              onChange={(e) => setNewAppliance({ ...newAppliance, name: e.target.value })}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Power Rating (Watts)</label>
              <input
                type="number"
                required
                min="1"
                placeholder="1000"
                value={newAppliance.powerRating}
                onChange={(e) => setNewAppliance({ ...newAppliance, powerRating: Number(e.target.value) })}
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Relay # (1 to 6)</label>
              <input
                type="number"
                required
                min="1"
                max="6"
                value={newAppliance.relayNumber}
                onChange={(e) => setNewAppliance({ ...newAppliance, relayNumber: Number(e.target.value) })}
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">Appliance Type / Icon</label>
            <select
              value={newAppliance.icon}
              onChange={(e) => setNewAppliance({ ...newAppliance, icon: e.target.value })}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="refrigerator">Refrigerator</option>
              <option value="air-conditioner">Air Conditioner</option>
              <option value="washing-machine">Washing Machine</option>
              <option value="tv">Television</option>
              <option value="microwave">Microwave</option>
              <option value="water-heater">Water Heater</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              {isSubmitting ? 'Installing...' : 'Save Appliance'}
            </Button>
          </div>
        </form>
      </Dialog>
    </AnimatedPage>
  )
}

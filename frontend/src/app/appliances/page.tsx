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
import { Power, PowerOff, Refrigerator, Tv, AirVent, WashingMachine, Microwave, Waves } from 'lucide-react'
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
  const confirmAppliance = confirmId ? appliances.find((a) => a.id === confirmId) : null

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
      <FadeUp className="mb-6">
        <h1 className="text-2xl font-bold text-white light:text-gray-900">Appliances</h1>
        <p className="text-sm text-gray-400 light:text-gray-500">Monitor and control connected appliances</p>
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
                      {iconMap[appliance.icon] ?? <Power className="h-8 w-8" />}
                    </motion.div>
                    <div>
                      <h3 className="font-semibold text-white light:text-gray-900">{appliance.name}</h3>
                      <p className="text-sm text-gray-400 light:text-gray-500">{formatPower(appliance.powerRating)}</p>
                    </div>
                  </div>
                  <motion.div
                    animate={{ scale: appliance.status ? [1, 1.2, 1] : 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Badge variant={appliance.status ? 'success' : 'default'}>
                      {appliance.status ? 'ON' : 'OFF'}
                    </Badge>
                  </motion.div>
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
    </AnimatedPage>
  )
}

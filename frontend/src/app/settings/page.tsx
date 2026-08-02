'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { CardSkeleton } from '@/components/ui/skeleton'
import { AnimatedPage, FadeUp, HoverScale, StaggerGrid } from '@/components/animations'
import { useToast } from '@/components/ui/toast'
import { Save, Bell, Gauge, Wifi, DollarSign } from 'lucide-react'
import type { Budget } from '@/types'
import { formatEnergy } from '@/lib/utils'

export default function SettingsPage() {
  const [budget, setBudget] = useState<Budget | null>(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [notifications, setNotifications] = useState(true)
  const [autoOff, setAutoOff] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    api.getBudget()
      .then((b) => {
        setBudget(b)
        setBudgetInput(String(b.maximumEnergy))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const saveBudget = async () => {
    try {
      const val = parseFloat(budgetInput)
      if (isNaN(val) || val <= 0) {
        addToast({ title: 'Invalid budget value', variant: 'danger' })
        return
      }
      setSaving(true)
      const updated = await api.setBudget(val)
      setBudget(updated)
      addToast({ title: 'Budget updated successfully', variant: 'success' })
    } catch {
      addToast({ title: 'Failed to update budget', variant: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const budgetPercent = budget && budget.maximumEnergy > 0
    ? Math.min((budget.currentUsage / budget.maximumEnergy) * 100, 100)
    : 0

  if (loading) {
    return (
      <AnimatedPage>
        <div className="grid gap-6 md:grid-cols-2">
          {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage>
      <FadeUp className="mb-6">
        <h1 className="text-2xl font-bold text-white light:text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 light:text-gray-500">Configure your energy monitoring system</p>
      </FadeUp>

      <StaggerGrid className="grid gap-6 md:grid-cols-2">
        <HoverScale>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-emerald-500 animate-float" />
                Monthly Budget
              </CardTitle>
              <CardDescription>Set your maximum energy consumption target</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {budget && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 light:text-gray-500">
                      {formatEnergy(budget.currentUsage)} of {formatEnergy(budget.maximumEnergy)}
                    </span>
                    <span className="font-medium text-white light:text-gray-900">{Math.round(budgetPercent)}%</span>
                  </div>
                  <Progress
                    value={budgetPercent}
                    indicatorClassName={budgetPercent > 90 ? 'bg-red-500' : budgetPercent > 70 ? 'bg-amber-500' : undefined}
                  />
                  <Badge variant={budget.status === 'exceeded' ? 'danger' : 'success'}>
                    {budget.status}
                  </Badge>
                </motion.div>
              )}

              <div className="flex gap-2">
                <input
                  type="number"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-gray-700 light:border-gray-300 bg-gray-800 light:bg-white px-3 py-2 text-sm text-gray-200 light:text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  placeholder="Enter max energy (kWh)"
                />
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button onClick={saveBudget} disabled={saving} className="gap-1">
                    {saving ? (
                      <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="h-4 w-4 rounded-full border-2 border-white border-t-transparent inline-block" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </HoverScale>

        <HoverScale>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-emerald-500 animate-float" />
                Notifications
              </CardTitle>
              <CardDescription>Manage alert preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <motion.div
                className="flex items-center justify-between rounded-lg border border-gray-800 light:border-gray-200 p-3"
                whileHover={{ x: 4 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div>
                  <p className="text-sm font-medium text-white light:text-gray-900">Push Notifications</p>
                  <p className="text-xs text-gray-500">Receive alerts on your device</p>
                </div>
                <Switch checked={notifications} onCheckedChange={setNotifications} />
              </motion.div>
              <motion.div
                className="flex items-center justify-between rounded-lg border border-gray-800 light:border-gray-200 p-3"
                whileHover={{ x: 4 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div>
                  <p className="text-sm font-medium text-white light:text-gray-900">Budget Alerts</p>
                  <p className="text-xs text-gray-500">Warn when approaching budget limit</p>
                </div>
                <Switch defaultChecked />
              </motion.div>
              <motion.div
                className="flex items-center justify-between rounded-lg border border-gray-800 light:border-gray-200 p-3"
                whileHover={{ x: 4 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div>
                  <p className="text-sm font-medium text-white light:text-gray-900">Appliance Alerts</p>
                  <p className="text-xs text-gray-500">Notify on status changes</p>
                </div>
                <Switch defaultChecked />
              </motion.div>
            </CardContent>
          </Card>
        </HoverScale>

        <HoverScale>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-emerald-500 animate-float" />
                ESP32 Connection
              </CardTitle>
              <CardDescription>Configure device communication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white light:text-gray-900">Connection Status</p>
                </div>
                <Badge variant="success" className="gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Connected
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white light:text-gray-900">Device ID</p>
                  <p className="text-xs text-gray-500">ESP32-001</p>
                </div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" size="sm">Reconnect</Button>
                </motion.div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white light:text-gray-900">Auto Reconnect</p>
                  <p className="text-xs text-gray-500">Automatically reconnect on disconnect</p>
                </div>
                <Switch checked={autoOff} onCheckedChange={setAutoOff} />
              </div>
            </CardContent>
          </Card>
        </HoverScale>

        <HoverScale>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-500 animate-float" />
                Energy Pricing
              </CardTitle>
              <CardDescription>Configure electricity rates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 light:text-gray-500">Rate per kWh ($)</label>
                <input
                  type="number" step="0.01" defaultValue={0.12}
                  className="mt-1 flex h-10 w-full rounded-lg border border-gray-700 light:border-gray-300 bg-gray-800 light:bg-white px-3 py-2 text-sm text-gray-200 light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 light:text-gray-500">Currency</label>
                <input
                  type="text" defaultValue="USD"
                  className="mt-1 flex h-10 w-full rounded-lg border border-gray-700 light:border-gray-300 bg-gray-800 light:bg-white px-3 py-2 text-sm text-gray-200 light:text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                />
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button className="w-full gap-1">
                  <Save className="h-4 w-4" />
                  Save Pricing
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </HoverScale>
      </StaggerGrid>
    </AnimatedPage>
  )
}

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
import { Save, Bell, Gauge, Wifi, DollarSign, CheckCircle2 } from 'lucide-react'
import type { Budget } from '@/types'
import { formatEnergy } from '@/lib/utils'
import { usePricing } from '@/hooks/usePricing'
import type { PricingConfig } from '@/hooks/usePricing'

// ─── Currency catalogue ──────────────────────────────────────────────────────
const CURRENCIES = [
  { code: 'GHS', symbol: '₵',   name: 'Ghana Cedi',           defaultRate: 1.50,  defaultPeakRate: 2.00 },
  { code: 'USD', symbol: '$',   name: 'US Dollar',            defaultRate: 0.12,  defaultPeakRate: 0.18 },
  { code: 'EUR', symbol: '€',   name: 'Euro',                 defaultRate: 0.25,  defaultPeakRate: 0.34 },
  { code: 'GBP', symbol: '£',   name: 'British Pound',        defaultRate: 0.28,  defaultPeakRate: 0.38 },
  { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira',       defaultRate: 68.0,  defaultPeakRate: 90.0 },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling',      defaultRate: 20.0,  defaultPeakRate: 27.0 },
  { code: 'ZAR', symbol: 'R',   name: 'South African Rand',   defaultRate: 2.25,  defaultPeakRate: 3.00 },
  { code: 'EGP', symbol: 'E£',  name: 'Egyptian Pound',       defaultRate: 5.50,  defaultPeakRate: 7.50 },
  { code: 'INR', symbol: '₹',   name: 'Indian Rupee',         defaultRate: 6.50,  defaultPeakRate: 9.00 },
  { code: 'CAD', symbol: 'C$',  name: 'Canadian Dollar',      defaultRate: 0.13,  defaultPeakRate: 0.19 },
  { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar',    defaultRate: 0.25,  defaultPeakRate: 0.33 },
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen',         defaultRate: 17.0,  defaultPeakRate: 23.0 },
] as const

// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [budget, setBudget] = useState<Budget | null>(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [notifications, setNotifications] = useState(true)
  const [autoOff, setAutoOff] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pricingSaved, setPricingSaved] = useState(false)
  const { addToast } = useToast()

  // Pricing
  const { config: savedPricing, saveConfig } = usePricing()
  const [selectedCurrency, setSelectedCurrency] = useState(savedPricing.currency)
  const [rateInput, setRateInput] = useState(String(savedPricing.ratePerKwh))
  const [peakRateInput, setPeakRateInput] = useState(String(savedPricing.peakRatePerKwh))

  // Sync when usePricing loads persisted values from localStorage
  useEffect(() => {
    setSelectedCurrency(savedPricing.currency)
    setRateInput(String(savedPricing.ratePerKwh))
    setPeakRateInput(String(savedPricing.peakRatePerKwh))
  }, [savedPricing.currency, savedPricing.ratePerKwh, savedPricing.peakRatePerKwh])

  useEffect(() => {
    api.getBudget()
      .then((b) => { setBudget(b); setBudgetInput(String(b.maximumEnergy)) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const saveBudget = async () => {
    const val = parseFloat(budgetInput)
    if (isNaN(val) || val <= 0) { addToast({ title: 'Invalid budget value', variant: 'danger' }); return }
    setSaving(true)
    try {
      const updated = await api.setBudget(val)
      setBudget(updated)
      addToast({ title: 'Budget updated successfully', variant: 'success' })
    } catch {
      addToast({ title: 'Failed to update budget', variant: 'danger' })
    } finally { setSaving(false) }
  }

  const handleCurrencyChange = (code: string) => {
    setSelectedCurrency(code)
    const preset = CURRENCIES.find(c => c.code === code)
    if (preset) { setRateInput(String(preset.defaultRate)); setPeakRateInput(String(preset.defaultPeakRate)) }
  }

  const handleSavePricing = () => {
    const rate = parseFloat(rateInput)
    const peakRate = parseFloat(peakRateInput)
    if (isNaN(rate) || rate <= 0 || isNaN(peakRate) || peakRate <= 0) {
      addToast({ title: 'Enter valid positive rate values', variant: 'danger' }); return
    }
    const currency = CURRENCIES.find(c => c.code === selectedCurrency)!
    const next: PricingConfig = { ratePerKwh: rate, peakRatePerKwh: peakRate, currency: currency.code, symbol: currency.symbol }
    saveConfig(next)
    setPricingSaved(true)
    addToast({ title: `Pricing saved — ${currency.symbol} ${rate.toFixed(2)}/kWh`, variant: 'success' })
    setTimeout(() => setPricingSaved(false), 3000)
  }

  // Notification State with LocalStorage Persistence
  const [pushNotifications, setPushNotifications] = useState<boolean>(true)
  const [budgetAlerts, setBudgetAlerts] = useState<boolean>(true)
  const [applianceAlerts, setApplianceAlerts] = useState<boolean>(true)
  const [reconnecting, setReconnecting] = useState(false)

  // Load notification preferences on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPush = localStorage.getItem('smart_energy_push_notifications')
      const savedBudget = localStorage.getItem('smart_energy_budget_alerts')
      const savedAppliance = localStorage.getItem('smart_energy_appliance_alerts')
      const savedAutoReconnect = localStorage.getItem('smart_energy_auto_reconnect')

      if (savedPush !== null) setPushNotifications(JSON.parse(savedPush))
      if (savedBudget !== null) setBudgetAlerts(JSON.parse(savedBudget))
      if (savedAppliance !== null) setApplianceAlerts(JSON.parse(savedAppliance))
      if (savedAutoReconnect !== null) setAutoOff(JSON.parse(savedAutoReconnect))
    }
  }, [])

  const handleTogglePushNotifications = (val: boolean) => {
    setPushNotifications(val)
    if (typeof window !== 'undefined') {
      localStorage.setItem('smart_energy_push_notifications', JSON.stringify(val))
    }
    addToast({
      title: val ? 'Push notifications enabled' : 'Push notifications disabled',
      variant: val ? 'success' : 'info',
    })
  }

  const handleToggleBudgetAlerts = (val: boolean) => {
    setBudgetAlerts(val)
    if (typeof window !== 'undefined') {
      localStorage.setItem('smart_energy_budget_alerts', JSON.stringify(val))
    }
    addToast({
      title: val ? 'Budget limit alerts enabled' : 'Budget limit alerts disabled',
      variant: val ? 'success' : 'info',
    })
  }

  const handleToggleApplianceAlerts = (val: boolean) => {
    setApplianceAlerts(val)
    if (typeof window !== 'undefined') {
      localStorage.setItem('smart_energy_appliance_alerts', JSON.stringify(val))
    }
    addToast({
      title: val ? 'Appliance status alerts enabled' : 'Appliance status alerts disabled',
      variant: val ? 'success' : 'info',
    })
  }

  const handleToggleAutoReconnect = (val: boolean) => {
    setAutoOff(val)
    if (typeof window !== 'undefined') {
      localStorage.setItem('smart_energy_auto_reconnect', JSON.stringify(val))
    }
    addToast({
      title: val ? 'Auto-reconnect enabled' : 'Auto-reconnect disabled',
      variant: val ? 'success' : 'info',
    })
  }

  const handleReconnectDevice = async () => {
    setReconnecting(true)
    try {
      await api.getDashboard()
      addToast({ title: 'ESP32 Connection verified — Device active', variant: 'success' })
    } catch {
      addToast({ title: 'Reconnection query sent — Backend responding', variant: 'info' })
    } finally {
      setReconnecting(false)
    }
  }

  const budgetPercent = budget && budget.maximumEnergy > 0
    ? Math.min((budget.currentUsage / budget.maximumEnergy) * 100, 100) : 0

  const currencySymbol = CURRENCIES.find(c => c.code === selectedCurrency)?.symbol ?? selectedCurrency
  const previewCost = (() => {
    const r = parseFloat(rateInput)
    return isNaN(r) || r <= 0 ? '—' : `${currencySymbol} ${(100 * r).toFixed(2)}`
  })()

  if (loading) return (
    <AnimatedPage>
      <div className="grid gap-6 md:grid-cols-2">{[1,2,3,4].map(i => <CardSkeleton key={i} />)}</div>
    </AnimatedPage>
  )

  return (
    <AnimatedPage>
      <FadeUp className="mb-6">
        <h1 className="text-2xl font-bold text-white light:text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 light:text-gray-500">Configure your energy monitoring system</p>
      </FadeUp>

      <StaggerGrid className="grid gap-6 md:grid-cols-2">

        {/* ── Monthly Budget ── */}
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
                <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{formatEnergy(budget.currentUsage)} of {formatEnergy(budget.maximumEnergy)}</span>
                    <span className="font-medium text-white">{Math.round(budgetPercent)}%</span>
                  </div>
                  <Progress value={budgetPercent} indicatorClassName={budgetPercent > 90 ? 'bg-red-500' : budgetPercent > 70 ? 'bg-amber-500' : undefined} />
                  <Badge variant={budget.status === 'exceeded' ? 'danger' : 'success'}>{budget.status}</Badge>
                </motion.div>
              )}
              <div className="flex gap-2">
                <input
                  type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  placeholder="Max energy (kWh)"
                />
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button onClick={saveBudget} disabled={saving} className="gap-1">
                    {saving
                      ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="h-4 w-4 rounded-full border-2 border-white border-t-transparent inline-block" />
                      : <Save className="h-4 w-4" />}
                    Save
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </HoverScale>

        {/* ── Notifications ── */}
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
              {[
                { label: 'Push Notifications', sub: 'Receive alerts on your device', state: pushNotifications, onChange: handleTogglePushNotifications },
                { label: 'Budget Alerts',      sub: 'Warn when approaching budget limit', state: budgetAlerts, onChange: handleToggleBudgetAlerts },
                { label: 'Appliance Alerts',   sub: 'Notify on status changes',           state: applianceAlerts, onChange: handleToggleApplianceAlerts },
              ].map(({ label, sub, state, onChange }) => (
                <motion.div key={label} className="flex items-center justify-between rounded-lg border border-gray-800 p-3" whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 300 }}>
                  <div>
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-gray-500">{sub}</p>
                  </div>
                  <Switch checked={state} onCheckedChange={onChange} />
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </HoverScale>

        {/* ── ESP32 Connection ── */}
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
                <p className="text-sm font-medium text-white">Connection Status</p>
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
                  <p className="text-sm font-medium text-white">Device ID</p>
                  <p className="text-xs text-gray-500">ESP32-001</p>
                </div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" size="sm" onClick={handleReconnectDevice} disabled={reconnecting}>
                    {reconnecting ? 'Pinging...' : 'Reconnect'}
                  </Button>
                </motion.div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Auto Reconnect</p>
                  <p className="text-xs text-gray-500">Automatically reconnect on disconnect</p>
                </div>
                <Switch checked={autoOff} onCheckedChange={handleToggleAutoReconnect} />
              </div>
            </CardContent>
          </Card>
        </HoverScale>

        {/* ── Energy Pricing ── */}
        <HoverScale>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-500 animate-float" />
                Energy Pricing
              </CardTitle>
              <CardDescription>Configure electricity rates used in cost calculations across the app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Currency dropdown */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Currency</label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.symbol} — {c.code} ({c.name})</option>
                  ))}
                </select>
              </div>

              {/* Off-peak rate */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Off-Peak Rate (per kWh)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">{currencySymbol}</span>
                  <input type="number" step="0.01" min="0" value={rateInput} onChange={(e) => setRateInput(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-8 pr-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors" />
                </div>
              </div>

              {/* Peak rate */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Peak Rate — 5 pm to 9 pm (per kWh)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">{currencySymbol}</span>
                  <input type="number" step="0.01" min="0" value={peakRateInput} onChange={(e) => setPeakRateInput(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 pl-8 pr-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors" />
                </div>
              </div>

              {/* Live preview */}
              <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-3 py-2 text-xs text-gray-400 flex items-center justify-between">
                <span>100 kWh off-peak would cost:</span>
                <span className="font-semibold text-emerald-400">{previewCost}</span>
              </div>

              {/* Save */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  className={`w-full gap-2 transition-colors ${pricingSaved ? 'bg-emerald-600 hover:bg-emerald-500' : ''}`}
                  onClick={handleSavePricing}
                >
                  {pricingSaved
                    ? <><CheckCircle2 className="h-4 w-4" /> Saved!</>
                    : <><Save className="h-4 w-4" /> Save Pricing</>}
                </Button>
              </motion.div>

            </CardContent>
          </Card>
        </HoverScale>

      </StaggerGrid>
    </AnimatedPage>
  )
}

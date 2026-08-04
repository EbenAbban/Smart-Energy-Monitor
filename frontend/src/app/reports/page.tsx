'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AnimatedPage, FadeUp, StaggerGrid, HoverScale } from '@/components/animations'
import { Download, Printer, BarChart3, PieChart, Table, Sparkles, Loader2 } from 'lucide-react'
import { api } from '@/services/api'
import { usePricing } from '@/hooks/usePricing'
import type { PricingConfig } from '@/hooks/usePricing'

// ─── Helpers ────────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const lines = [headers.map(escape).join(',')]
  for (const row of rows) lines.push(row.map(escape).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function openPrintWindow(title: string, htmlBody: string) {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111;padding:32px}
        h1{font-size:22px;margin-bottom:4px;color:#059669}
        .subtitle{font-size:13px;color:#555;margin-bottom:24px;border-bottom:2px solid #059669;padding-bottom:12px}
        table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
        th{background:#059669;color:#fff;padding:8px 12px;text-align:left;font-weight:600}
        td{padding:7px 12px;border-bottom:1px solid #e5e7eb}
        tr:nth-child(even) td{background:#f0fdf4}
        .summary{display:flex;gap:24px;margin-bottom:20px;flex-wrap:wrap}
        .summary-card{background:#f0fdf4;border:1px solid #d1fae5;border-radius:8px;padding:12px 20px;min-width:140px}
        .summary-card .val{font-size:20px;font-weight:700;color:#059669}
        .summary-card .lbl{font-size:11px;color:#6b7280;margin-top:2px}
        .footer{margin-top:24px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px}
        @media print{body{padding:16px}}
      </style>
    </head>
    <body>
      <h1>Smart Energy Monitor</h1>
      <div class="subtitle">${title} &mdash; Generated ${new Date().toLocaleString()}</div>
      ${htmlBody}
      <div class="footer">Smart Energy Monitor &bull; Auto-generated report</div>
      <script>window.onload = () => { window.print() }</script>
    </body>
    </html>
  `)
  win.document.close()
}

// ─── Report Generators ───────────────────────────────────────────────────────

async function generateDailySummary(action: 'download' | 'print', pricing: PricingConfig) {
  const { readings } = await api.getReadings({ limit: 500 })
  const today = new Date().toDateString()
  const todays = readings.filter(r => new Date(r.timestamp).toDateString() === today)

  if (action === 'download') {
    const rows = todays.map(r => [
      new Date(r.timestamp).toLocaleTimeString(),
      r.appliance?.name ?? 'Unknown',
      r.power.toFixed(2),
      r.current.toFixed(4),
      r.voltage.toFixed(1),
      r.energyUsed.toFixed(6),
      r.alert ? 'Yes' : 'No',
    ])
    downloadCSV('daily-energy-summary.csv', rows,
      ['Time', 'Appliance', 'Power (W)', 'Current (A)', 'Voltage (V)', 'Energy (kWh)', 'Alert'])
  } else {
    const totalW = todays.reduce((s, r) => s + r.energyUsed, 0)
    const alerts = todays.filter(r => r.alert).length
    const rows = todays.map(r => `
      <tr><td>${new Date(r.timestamp).toLocaleTimeString()}</td>
      <td>${r.appliance?.name ?? 'Unknown'}</td>
      <td>${r.power.toFixed(1)} W</td>
      <td>${r.energyUsed.toFixed(6)} kWh</td>
      <td>${r.alert ? '⚠️ Yes' : 'No'}</td></tr>`)
    openPrintWindow('Daily Energy Summary', `
      <div class="summary">
        <div class="summary-card"><div class="val">${todays.length}</div><div class="lbl">Readings Today</div></div>
        <div class="summary-card"><div class="val">${totalW.toFixed(4)} kWh</div><div class="lbl">Total Energy</div></div>
        <div class="summary-card"><div class="val">${alerts}</div><div class="lbl">Alerts</div></div>
      </div>
      <table><thead><tr><th>Time</th><th>Appliance</th><th>Power</th><th>Energy</th><th>Alert</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table>`)
  }
}

async function generateWeeklySummary(action: 'download' | 'print', pricing: PricingConfig) {
  const { readings } = await api.getReadings({ limit: 1000 })
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)
  const week = readings.filter(r => new Date(r.timestamp) >= sevenDaysAgo)

  // Aggregate by day
  const byDay = new Map<string, number>()
  for (const r of week) {
    const day = new Date(r.timestamp).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })
    byDay.set(day, (byDay.get(day) ?? 0) + r.energyUsed)
  }

  if (action === 'download') {
    const rows = Array.from(byDay.entries()).map(([day, energy]) => [day, energy.toFixed(6)])
    downloadCSV('weekly-consumption-report.csv', rows, ['Day', 'Total Energy (kWh)'])
  } else {
    const tableRows = Array.from(byDay.entries()).map(([day, e]) =>
      `<tr><td>${day}</td><td>${e.toFixed(4)} kWh</td><td>${pricing.symbol}${(e * pricing.ratePerKwh).toFixed(2)}</td></tr>`)
    openPrintWindow('Weekly Consumption Report', `
      <div class="summary">
        <div class="summary-card"><div class="val">${week.length}</div><div class="lbl">Total Readings</div></div>
        <div class="summary-card"><div class="val">${Array.from(byDay.values()).reduce((a,b)=>a+b,0).toFixed(3)} kWh</div><div class="lbl">Weekly Total</div></div>
        <div class="summary-card"><div class="val">${byDay.size}</div><div class="lbl">Days with Data</div></div>
      </div>
      <table><thead><tr><th>Day</th><th>Energy (kWh)</th><th>Est. Cost (${pricing.currency})</th></tr></thead>
      <tbody>${tableRows.join('')}</tbody></table>`)
  }
}

async function generateMonthlyBudget(action: 'download' | 'print', pricing: PricingConfig) {
  const [budget, { readings }] = await Promise.all([
    api.getBudget(),
    api.getReadings({ limit: 2000 }),
  ])

  const now = new Date()
  const monthly = readings.filter(r => {
    const d = new Date(r.timestamp)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const used = budget.currentUsage
  const max = budget.maximumEnergy
  const pct = max > 0 ? ((used / max) * 100).toFixed(1) : '0'
  const remaining = Math.max(0, max - used)

  if (action === 'download') {
    const rows = [
      ['Budget Maximum (kWh)', max.toString()],
      ['Current Usage (kWh)', used.toFixed(4)],
      ['Remaining (kWh)', remaining.toFixed(4)],
      ['Usage %', pct + '%'],
      ['Status', budget.status],
      ['Month', `${now.getMonth() + 1}/${now.getFullYear()}`],
    ]
    downloadCSV('monthly-budget-analysis.csv', rows, ['Metric', 'Value'])
  } else {
    openPrintWindow('Monthly Budget Analysis', `
      <div class="summary">
        <div class="summary-card"><div class="val">${used.toFixed(2)} kWh</div><div class="lbl">Used</div></div>
        <div class="summary-card"><div class="val">${max} kWh</div><div class="lbl">Budget</div></div>
        <div class="summary-card"><div class="val">${pct}%</div><div class="lbl">Utilization</div></div>
        <div class="summary-card"><div class="val">${remaining.toFixed(2)} kWh</div><div class="lbl">Remaining</div></div>
      </div>
      <table><thead><tr><th>Metric</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Budget Maximum</td><td>${max} kWh</td></tr>
        <tr><td>Current Usage</td><td>${used.toFixed(4)} kWh</td></tr>
        <tr><td>Remaining</td><td>${remaining.toFixed(4)} kWh</td></tr>
        <tr><td>Utilization</td><td>${pct}%</td></tr>
        <tr><td>Status</td><td>${budget.status.toUpperCase()}</td></tr>
        <tr><td>Month</td><td>${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}</td></tr>
      </tbody></table>`)
  }
}

async function generateApplianceEfficiency(action: 'download' | 'print', pricing: PricingConfig) {
  const [appliances, { readings }] = await Promise.all([
    api.getAppliances(),
    api.getReadings({ limit: 2000 }),
  ])

  const energyByAppliance = new Map<number, number>()
  for (const r of readings) {
    if (r.applianceId) {
      energyByAppliance.set(r.applianceId, (energyByAppliance.get(r.applianceId) ?? 0) + r.energyUsed)
    }
  }

  const data = appliances.map(a => ({
    name: a.name,
    rating: a.powerRating,
    status: a.status ? 'ON' : 'OFF',
    relay: a.relayNumber,
    energy: (energyByAppliance.get(a.id) ?? 0),
  }))

  if (action === 'download') {
    const rows = data.map(d => [d.name, d.rating.toString(), d.status, d.relay.toString(), d.energy.toFixed(6)])
    downloadCSV('appliance-efficiency-report.csv', rows,
      ['Appliance', 'Power Rating (W)', 'Status', 'Relay #', 'Energy Used (kWh)'])
  } else {
    const rows = data.map(d =>
      `<tr><td>${d.name}</td><td>${d.rating} W</td><td>${d.status}</td><td>R${d.relay}</td><td>${d.energy.toFixed(4)} kWh</td><td>${pricing.symbol}${(d.energy * pricing.ratePerKwh).toFixed(2)}</td></tr>`)
    openPrintWindow('Appliance Efficiency Report', `
      <table><thead><tr><th>Appliance</th><th>Rating</th><th>Status</th><th>Relay</th><th>Energy</th><th>Est. Cost (${pricing.currency})</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table>`)
  }
}

async function generatePeakUsage(action: 'download' | 'print', pricing: PricingConfig) {
  const { readings } = await api.getReadings({ limit: 2000 })
  const byHour = new Map<string, { total: number; peak: number; count: number }>()

  for (const r of readings) {
    const h = new Date(r.timestamp).getHours().toString().padStart(2, '0') + ':00'
    const entry = byHour.get(h) ?? { total: 0, peak: 0, count: 0 }
    entry.total += r.energyUsed
    entry.peak = Math.max(entry.peak, r.power)
    entry.count++
    byHour.set(h, entry)
  }

  const sorted = Array.from(byHour.entries()).sort((a, b) => b[1].total - a[1].total)

  if (action === 'download') {
    const rows = sorted.map(([h, d]) => [h, d.total.toFixed(6), d.peak.toFixed(2), d.count.toString()])
    downloadCSV('peak-usage-analysis.csv', rows, ['Hour', 'Total Energy (kWh)', 'Peak Power (W)', 'Readings'])
  } else {
    const tableRows = sorted.map(([h, d]) =>
      `<tr><td>${h}</td><td>${d.total.toFixed(4)} kWh</td><td>${d.peak.toFixed(1)} W</td><td>${d.count}</td></tr>`)
    openPrintWindow('Peak Usage Analysis', `
      <table><thead><tr><th>Hour</th><th>Total Energy</th><th>Peak Power</th><th>Readings</th></tr></thead>
      <tbody>${tableRows.join('')}</tbody></table>`)
  }
}

async function generateCostEstimation(action: 'download' | 'print', pricing: PricingConfig) {
  const [budget, { readings }] = await Promise.all([
    api.getBudget(),
    api.getReadings({ limit: 2000 }),
  ])

  const RATE = pricing.ratePerKwh
  const PEAK_RATE = pricing.peakRatePerKwh

  const now = new Date()
  const monthly = readings.filter(r => {
    const d = new Date(r.timestamp)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  let offPeakEnergy = 0
  let peakEnergy = 0
  for (const r of monthly) {
    const h = new Date(r.timestamp).getHours()
    if (h >= 17 && h < 21) peakEnergy += r.energyUsed
    else offPeakEnergy += r.energyUsed
  }

  const offPeakCost = offPeakEnergy * RATE
  const peakCost = peakEnergy * PEAK_RATE
  const totalCost = offPeakCost + peakCost
  const projectedDays = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const projected = projectedDays > 0 ? (totalCost / projectedDays) * daysInMonth : 0

  if (action === 'download') {
    const rows = [
      ['Off-Peak Energy (kWh)', offPeakEnergy.toFixed(4)],
      [`Off-Peak Cost (${pricing.currency})`, offPeakCost.toFixed(2)],
      ['Peak Energy (kWh)', peakEnergy.toFixed(4)],
      [`Peak Cost (${pricing.currency})`, peakCost.toFixed(2)],
      [`Total Cost This Month (${pricing.currency})`, totalCost.toFixed(2)],
      [`Projected Full Month (${pricing.currency})`, projected.toFixed(2)],
      ['Budget Usage (kWh)', budget.currentUsage.toFixed(4)],
    ]
    downloadCSV('cost-estimation-report.csv', rows, ['Metric', 'Value'])
  } else {
    openPrintWindow('Cost Estimation Report', `
      <div class="summary">
        <div class="summary-card"><div class="val">${pricing.symbol} ${totalCost.toFixed(2)}</div><div class="lbl">Month to Date</div></div>
        <div class="summary-card"><div class="val">${pricing.symbol} ${projected.toFixed(2)}</div><div class="lbl">Projected Full Month</div></div>
        <div class="summary-card"><div class="val">${pricing.symbol} ${peakCost.toFixed(2)}</div><div class="lbl">Peak Hours Cost</div></div>
      </div>
      <table><thead><tr><th>Metric</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Off-Peak Energy</td><td>${offPeakEnergy.toFixed(4)} kWh @ ${pricing.symbol} ${RATE.toFixed(2)}/kWh</td></tr>
        <tr><td>Off-Peak Cost</td><td>${pricing.symbol} ${offPeakCost.toFixed(2)}</td></tr>
        <tr><td>Peak Energy (5–9 pm)</td><td>${peakEnergy.toFixed(4)} kWh @ ${pricing.symbol} ${PEAK_RATE.toFixed(2)}/kWh</td></tr>
        <tr><td>Peak Cost</td><td>${pricing.symbol} ${peakCost.toFixed(2)}</td></tr>
        <tr><td><strong>Total This Month</strong></td><td><strong>${pricing.symbol} ${totalCost.toFixed(2)}</strong></td></tr>
        <tr><td>Projected Full Month</td><td>${pricing.symbol} ${projected.toFixed(2)}</td></tr>
      </tbody></table>`)
  }
}

// ─── Report Definitions ──────────────────────────────────────────────────────

type ReportKey = 'daily' | 'weekly' | 'monthly' | 'appliance' | 'peak' | 'cost'

const reports: { key: ReportKey; title: string; description: string; icon: React.ElementType; date: string; type: string; fn: (action: 'download' | 'print', pricing: PricingConfig) => Promise<void> }[] = [
  { key: 'daily',     title: 'Daily Energy Summary',       description: "Complete overview of today's energy consumption by appliance",  icon: BarChart3, date: 'Today',        type: 'Daily',   fn: generateDailySummary },
  { key: 'weekly',    title: 'Weekly Consumption Report',   description: '7-day energy usage trends and comparison',                       icon: PieChart,  date: 'This Week',   type: 'Weekly',  fn: generateWeeklySummary },
  { key: 'monthly',   title: 'Monthly Budget Analysis',     description: 'Budget vs actual usage for the current month',                   icon: Table,     date: 'This Month',  type: 'Monthly', fn: generateMonthlyBudget },
  { key: 'appliance', title: 'Appliance Efficiency Report', description: 'Performance metrics for all connected appliances',               icon: BarChart3, date: 'This Month',  type: 'Monthly', fn: generateApplianceEfficiency },
  { key: 'peak',      title: 'Peak Usage Analysis',         description: 'Identify peak consumption periods and patterns',                 icon: PieChart,  date: 'Last 30 Days',type: 'Custom',  fn: generatePeakUsage },
  { key: 'cost',      title: 'Cost Estimation Report',      description: 'Estimated energy costs based on current usage',                  icon: Table,     date: 'This Month',  type: 'Monthly', fn: generateCostEstimation },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [loading, setLoading] = useState<Record<string, 'download' | 'print' | null>>({})
  const [generating, setGenerating] = useState(false)
  const { config: pricing } = usePricing()

  const handle = async (key: ReportKey, action: 'download' | 'print', fn: (a: 'download' | 'print', p: PricingConfig) => Promise<void>) => {
    setLoading(prev => ({ ...prev, [`${key}-${action}`]: action }))
    try {
      await fn(action, pricing)
    } catch (err) {
      console.error(`Failed to generate report [${key}/${action}]:`, err)
      alert('Failed to generate report. Please check your connection and try again.')
    } finally {
      setLoading(prev => ({ ...prev, [`${key}-${action}`]: null }))
    }
  }

  const handleGenerateAll = async () => {
    setGenerating(true)
    try {
      // Download a combined CSV of all readings
      const { readings } = await api.getReadings({ limit: 2000 })
      const budget = await api.getBudget()
      const rows = readings.map(r => [
        new Date(r.timestamp).toLocaleString(),
        r.appliance?.name ?? 'Unknown',
        r.power.toFixed(2),
        r.current.toFixed(4),
        r.voltage.toFixed(1),
        r.energyUsed.toFixed(6),
        r.budget.toString(),
        r.remaining.toFixed(4),
        r.alert ? 'Yes' : 'No',
      ])
      downloadCSV(`smart-energy-full-report-${new Date().toISOString().split('T')[0]}.csv`, rows,
        ['Timestamp', 'Appliance', 'Power (W)', 'Current (A)', 'Voltage (V)', 'Energy (kWh)', 'Budget (kWh)', 'Remaining (kWh)', 'Alert'])
    } catch (err) {
      console.error('Generate all failed:', err)
      alert('Failed to generate full report.')
    } finally {
      setGenerating(false)
    }
  }

  const isLoading = (key: ReportKey, action: 'download' | 'print') =>
    loading[`${key}-${action}`] !== undefined && loading[`${key}-${action}`] !== null

  return (
    <AnimatedPage>
      <FadeUp className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white light:text-gray-900">Reports</h1>
          <p className="text-sm text-gray-400 light:text-gray-500">Generate and export energy reports from live data</p>
        </div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={handleGenerateAll}
            disabled={generating}
          >
            {generating
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Sparkles className="h-4 w-4" />}
            {generating ? 'Generating…' : 'Export Full Report'}
          </Button>
        </motion.div>
      </FadeUp>

      <StaggerGrid className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report, i) => (
          <HoverScale key={report.key}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className="group hover:border-emerald-800/50 light:hover:border-emerald-300 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <motion.div
                      whileHover={{ rotate: [0, -10, 10, 0] }}
                      className="rounded-lg bg-emerald-500/20 light:bg-emerald-100 p-2 text-emerald-400 light:text-emerald-600"
                    >
                      <report.icon className="h-6 w-6" />
                    </motion.div>
                    <Badge variant="info">{report.type}</Badge>
                  </div>
                  <h3 className="mt-4 font-semibold text-white light:text-gray-900 group-hover:text-emerald-400 light:group-hover:text-emerald-600 transition-colors">
                    {report.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-400 light:text-gray-500">{report.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{report.date}</span>
                    <div className="flex gap-1">
                      {/* Download CSV */}
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                          title="Download CSV"
                          disabled={isLoading(report.key, 'download')}
                          onClick={() => handle(report.key, 'download', report.fn)}
                        >
                          {isLoading(report.key, 'download')
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Download className="h-4 w-4" />}
                        </Button>
                      </motion.div>
                      {/* Print Report */}
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10"
                          title="Print Report"
                          disabled={isLoading(report.key, 'print')}
                          onClick={() => handle(report.key, 'print', report.fn)}
                        >
                          {isLoading(report.key, 'print')
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Printer className="h-4 w-4" />}
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </HoverScale>
        ))}
      </StaggerGrid>
    </AnimatedPage>
  )
}

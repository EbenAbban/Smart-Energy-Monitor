'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/services/api'
import { useSocket } from '@/hooks/useSocket'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CardSkeleton, ChartSkeleton } from '@/components/ui/skeleton'
import { GaugeChart } from '@/components/ui/gauge'
import { AnimatedPage, FadeUp, StaggerGrid, HoverScale, CountUp } from '@/components/animations'
import { estimateCost } from '@/lib/export'
import { usePricing } from '@/hooks/usePricing'
import {
  Zap, Activity, Gauge, AlertTriangle, TrendingUp, DollarSign, Leaf,
} from 'lucide-react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Area, AreaChart,
} from 'recharts'
import type { TooltipValueType } from 'recharts'
import type { DashboardData } from '@/types'
import { formatEnergy } from '@/lib/utils'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
const PEAK_HOURS = [17, 18, 19, 20] // 5-9pm peak

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { config: pricing } = usePricing()

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useSocket('reading', () => {
    api.getDashboard().then(setData).catch(console.error)
  })

  const budgetPercent = data && data.budgetMaximum > 0
    ? Math.min((data.budgetUsage / data.budgetMaximum) * 100, 100)
    : 0

  const costBreakdown = useMemo(() => {
    if (!data) return { estimated: 0, peak: 0, offPeak: 0, co2: 0 };
    const hourly = data.hourlyUsage ?? [];
    const peakKwh = hourly
      .filter((h) => PEAK_HOURS.includes(parseInt(h.hour)))
      .reduce((s, h) => s + h.energy, 0);
    const offPeakKwh = data.totalEnergy - peakKwh;
    return {
      estimated: estimateCost(data.totalEnergy, pricing.ratePerKwh),
      peak: estimateCost(peakKwh, pricing.peakRatePerKwh, pricing.peakRatePerKwh, true),
      offPeak: estimateCost(offPeakKwh, pricing.ratePerKwh),
      co2: data.totalEnergy * 0.92,
    };
  }, [data, pricing]);

  const hourlyWithPeak = useMemo(() => {
    if (!data) return []
    return (data.hourlyUsage ?? []).map((h) => ({
      ...h,
      isPeak: PEAK_HOURS.includes(parseInt(h.hour)),
    }))
  }, [data])

  return (
    <AnimatedPage>
      <FadeUp className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white light:text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 light:text-gray-500">Real-time energy monitoring overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="gap-1 animate-slide-up">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </Badge>
        </div>
      </FadeUp>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
          <ChartSkeleton />
        </div>
      ) : data ? (
        <>
          <StaggerGrid className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
            <HoverScale>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400 light:text-gray-500">Total Energy</CardTitle>
                  <Zap className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white light:text-gray-900">
                    <CountUp value={data.totalEnergy} suffix=" kWh" />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Today</p>
                </CardContent>
              </Card>
            </HoverScale>

            <HoverScale>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400 light:text-gray-500">Current Power</CardTitle>
                  <Activity className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white light:text-gray-900">
                    <CountUp value={data.currentPower} decimals={1} suffix=" W" />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Instantaneous draw</p>
                </CardContent>
              </Card>
            </HoverScale>

            <HoverScale>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400 light:text-gray-500">Est. Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white light:text-gray-900">
                    {pricing.symbol}<CountUp value={costBreakdown.estimated} decimals={2} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Today at {pricing.symbol}{pricing.ratePerKwh}/kWh</p>
                </CardContent>
              </Card>
            </HoverScale>

            <HoverScale>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400 light:text-gray-500">CO₂ Footprint</CardTitle>
                  <Leaf className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white light:text-gray-900">
                    <CountUp value={costBreakdown.co2} decimals={1} suffix=" lbs" />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Estimated today</p>
                </CardContent>
              </Card>
            </HoverScale>

            <HoverScale>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400 light:text-gray-500">Alerts</CardTitle>
                  <AlertTriangle className={`h-4 w-4 ${data.alerts > 0 ? 'text-red-500 animate-glow-pulse' : 'text-gray-500'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${data.alerts > 0 ? 'text-red-400' : 'text-white light:text-gray-900'}`}>
                    <CountUp value={data.alerts} decimals={0} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Active warnings</p>
                </CardContent>
              </Card>
            </HoverScale>
          </StaggerGrid>

          <div className="grid gap-4 md:grid-cols-7 mb-6">
            <div className="md:col-span-4">
              <FadeUp>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-emerald-500 animate-float" />
                      Hourly Usage
                      <Badge variant="warning" className="ml-2 text-[10px]">Peak 5-9pm</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={hourlyWithPeak}>
                          <defs>
                            <linearGradient id="peakGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="offpeakGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" className="light:opacity-30" />
                          <XAxis dataKey="hour" stroke="#6b7280" fontSize={12} />
                          <YAxis stroke="#6b7280" fontSize={12} unit=" kWh" />
                          <Tooltip
                            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }}
                            formatter={(value: TooltipValueType | undefined) => [Number(value).toFixed(2) + ' kWh', 'Energy']}
                          />
                          <Area
                            type="monotone"
                            dataKey="energy"
                            stroke="#10b981"
                            strokeWidth={2}
                            fill="url(#offpeakGrad)"
                            dot={false}
                          />
                          {(data.hourlyUsage ?? [])
                            .filter((h) => PEAK_HOURS.includes(parseInt(h.hour)))
                            .map((h) => (
                              <Area
                                key={h.hour}
                                data={[h]}
                                type="monotone"
                                dataKey="energy"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                fill="url(#peakGrad)"
                                dot={{ fill: '#f59e0b', r: 3 }}
                              />
                            ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </FadeUp>
            </div>

            <div className="md:col-span-3 space-y-4">
              <FadeUp delay={0.1}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Gauge className="h-4 w-4 text-emerald-500" />
                      Budget Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <GaugeChart
                      value={data.budgetUsage}
                      max={data.budgetMaximum}
                      label="Monthly Budget"
                      unit=" kWh"
                      size={160}
                    />
                  </CardContent>
                </Card>
              </FadeUp>

              <FadeUp delay={0.15}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-emerald-500" />
                      Cost Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span className="text-sm text-gray-400">Off-Peak</span>
                        </div>
                        <span className="text-sm font-medium text-white light:text-gray-900">${costBreakdown.offPeak.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          <span className="text-sm text-gray-400">Peak (5-9pm)</span>
                        </div>
                        <span className="text-sm font-medium text-white light:text-gray-900">${costBreakdown.peak.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-gray-800 light:border-gray-200 pt-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-white light:text-gray-900">Total</span>
                        <span className="text-sm font-bold text-emerald-400">${costBreakdown.estimated.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </FadeUp>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FadeUp delay={0.2}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-500 animate-float" />
                    Monthly Budget
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400 light:text-gray-500">
                        <CountUp value={data.budgetUsage} suffix=" kWh" /> of{' '}
                        <CountUp value={data.budgetMaximum} suffix=" kWh" />
                      </span>
                      <span className="font-medium text-white light:text-gray-900">{Math.round(budgetPercent)}%</span>
                    </div>
                    <Progress value={budgetPercent} indicatorClassName={budgetPercent > 90 ? 'bg-red-500' : budgetPercent > 70 ? 'bg-amber-500' : undefined} />
                    {budgetPercent > 90 && (
                      <motion.p
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-1 text-xs text-red-400"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Budget nearly exceeded
                      </motion.p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </FadeUp>

            <FadeUp delay={0.25}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-emerald-500 animate-float" />
                    Appliance Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.applianceBreakdown ?? []}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={80}
                          paddingAngle={3}
                          dataKey="energy" nameKey="name"
                        >
                          {(data.applianceBreakdown ?? []).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }}
                          formatter={(value: TooltipValueType | undefined) => [formatEnergy(Number(value)), 'Energy']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </FadeUp>
          </div>
        </>
      ) : null}
    </AnimatedPage>
  )
}

function PieChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  )
}

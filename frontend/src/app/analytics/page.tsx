'use client'

import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartSkeleton } from '@/components/ui/skeleton'
import { AnimatedPage, FadeUp, ScaleIn, HoverScale } from '@/components/animations'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import type { TooltipValueType } from 'recharts'
import { TrendingUp, BarChart3, PieChart as PieChartIcon } from 'lucide-react'
import type { DashboardData } from '@/types'
import { formatEnergy } from '@/lib/utils'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export default function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <AnimatedPage>
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2,3].map(i => <ChartSkeleton key={i} />)}
        </div>
      </AnimatedPage>
    )
  }

  if (!data) return null

  return (
    <AnimatedPage>
      <FadeUp className="mb-6">
        <h1 className="text-2xl font-bold text-white light:text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-400 light:text-gray-500">Detailed energy consumption analysis</p>
      </FadeUp>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <HoverScale>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500 animate-float" />
                Hourly Consumption
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.hourlyUsage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" className="light:opacity-30" />
                    <XAxis dataKey="hour" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }}
                      formatter={(value: TooltipValueType | undefined) => [formatEnergy(Number(value)), 'Energy']}
                    />
                    <Bar dataKey="energy" radius={[4, 4, 0, 0]}>
                      {data.hourlyUsage.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </HoverScale>

        <HoverScale>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-emerald-500 animate-float" />
                Appliance Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.applianceBreakdown}
                      cx="50%" cy="50%"
                      outerRadius={100}
                      dataKey="energy" nameKey="name"
                      label={({ name, payload }: { name?: string; payload?: { percentage?: number } }) => `${name} ${payload?.percentage ?? 0}%`}
                    >
                      {data.applianceBreakdown.map((_, i) => (
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
        </HoverScale>
      </div>

      <ScaleIn>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-500 animate-float" />
              Appliance Comparison (kWh)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.applianceBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" className="light:opacity-30" />
                  <XAxis type="number" stroke="#6b7280" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="#6b7280" fontSize={12} width={120} />
                  <Tooltip
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }}
                    formatter={(value: TooltipValueType | undefined) => [formatEnergy(Number(value)), 'Energy']}
                  />
                  <Bar dataKey="energy" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </ScaleIn>
    </AnimatedPage>
  )
}

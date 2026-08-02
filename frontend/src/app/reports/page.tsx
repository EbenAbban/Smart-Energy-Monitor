'use client'

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AnimatedPage, FadeUp, StaggerGrid, HoverScale } from '@/components/animations'
import { Download, Printer, BarChart3, PieChart, Table, Sparkles } from 'lucide-react'

const reports = [
  { title: 'Daily Energy Summary', description: 'Complete overview of today\'s energy consumption by appliance', icon: BarChart3, date: 'Today', type: 'Daily' },
  { title: 'Weekly Consumption Report', description: '7-day energy usage trends and comparison', icon: PieChart, date: 'This Week', type: 'Weekly' },
  { title: 'Monthly Budget Analysis', description: 'Budget vs actual usage for the current month', icon: Table, date: 'This Month', type: 'Monthly' },
  { title: 'Appliance Efficiency Report', description: 'Performance metrics for all connected appliances', icon: BarChart3, date: 'This Month', type: 'Monthly' },
  { title: 'Peak Usage Analysis', description: 'Identify peak consumption periods and patterns', icon: PieChart, date: 'Last 30 Days', type: 'Custom' },
  { title: 'Cost Estimation Report', description: 'Estimated energy costs based on current usage', icon: Table, date: 'This Month', type: 'Monthly' },
]

export default function ReportsPage() {
  return (
    <AnimatedPage>
      <FadeUp className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white light:text-gray-900">Reports</h1>
          <p className="text-sm text-gray-400 light:text-gray-500">Generate and export energy reports</p>
        </div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate Report
          </Button>
        </motion.div>
      </FadeUp>

      <StaggerGrid className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report, i) => (
          <HoverScale key={report.title}>
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
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Printer className="h-4 w-4" />
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

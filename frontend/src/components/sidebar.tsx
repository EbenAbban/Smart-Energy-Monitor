'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/theme-provider'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Activity,
  Zap,
  BarChart3,
  History,
  FileText,
  Settings,
  Gauge,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/live', label: 'Live Monitoring', icon: Activity },
  { href: '/appliances', label: 'Appliances', icon: Zap },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/history', label: 'History', icon: History },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { resolved, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-gray-800 light:border-gray-200 px-6">
        <div className="rounded-lg bg-emerald-500/20 p-1.5">
          <Gauge className="h-5 w-5 text-emerald-500 animate-float" />
        </div>
        <span className="text-base font-bold leading-tight text-white light:text-gray-900">
          Smart Energy<br />Monitor
        </span>
      </div>

      <nav className="flex flex-col gap-1 p-4 flex-1">
        {navItems.map((item, i) => (
          <motion.div
            key={item.href}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                pathname === item.href
                  ? 'bg-emerald-600/20 text-emerald-400 light:bg-emerald-100 light:text-emerald-700'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 light:text-gray-500 light:hover:bg-gray-100 light:hover:text-gray-700'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          </motion.div>
        ))}
      </nav>

      <div className="p-4 space-y-3">
        <div className="rounded-lg border border-gray-800 light:border-gray-200 bg-gray-900/80 light:bg-white/80 p-3 backdrop-blur-sm">
          <p className="text-xs text-gray-500 light:text-gray-400">System Status</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-sm text-emerald-400 light:text-emerald-600">Connected</span>
          </div>
        </div>

        <button
          onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-all light:text-gray-500 light:hover:bg-gray-100 light:hover:text-gray-700"
        >
          {resolved === 'dark' ? (
            <Sun className="h-5 w-5 text-amber-400" />
          ) : (
            <Moon className="h-5 w-5 text-gray-600" />
          )}
          {resolved === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>
    </>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 light:bg-white border border-gray-800 light:border-gray-200 text-white light:text-gray-900 md:hidden"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-gray-800 light:border-gray-200 bg-gray-950 light:bg-white md:flex">
        {sidebarContent}
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-gray-800 bg-gray-950 md:hidden"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}

'use client'

import { useTheme } from '@/components/theme-provider'
import { AnimatePresence, motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const { resolved, setTheme } = useTheme()
  const isDark = resolved === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-gray-800 bg-gray-900/80 text-white shadow-lg shadow-black/20 backdrop-blur-sm transition-colors hover:bg-gray-800 light:border-gray-200 light:bg-white/80 light:text-gray-900 light:shadow-gray-300/40 light:hover:bg-gray-100"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="sun"
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-center"
          >
            <Sun className="h-5 w-5 text-amber-400" />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-center"
          >
            <Moon className="h-5 w-5 text-gray-600" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

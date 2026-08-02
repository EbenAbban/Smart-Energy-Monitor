'use client'

import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-800 light:border-gray-300 bg-gray-900/30 light:bg-gray-50/50 p-12 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="mb-4 rounded-full bg-gray-800 light:bg-gray-100 p-4 text-gray-500"
      >
        {icon ?? <Inbox className="h-8 w-8" />}
      </motion.div>
      <h3 className="text-lg font-semibold text-white light:text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gray-400 light:text-gray-500">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  )
}

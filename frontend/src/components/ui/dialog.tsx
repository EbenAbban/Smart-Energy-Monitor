'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: React.ReactNode
  actions?: React.ReactNode
}

export function Dialog({ open, onClose, title, description, children, actions }: DialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md rounded-xl border border-gray-800 light:border-gray-200 bg-gray-950 light:bg-white p-6 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1 text-gray-500 hover:bg-gray-800 light:hover:bg-gray-100 hover:text-gray-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-semibold text-white light:text-gray-900">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-gray-400 light:text-gray-500">{description}</p>
            )}
            {children && <div className="mt-4">{children}</div>}
            {actions && <div className="mt-6 flex justify-end gap-3">{actions}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

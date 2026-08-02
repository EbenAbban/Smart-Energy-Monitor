'use client'

import { useState, useCallback, createContext, useContext } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success' | 'danger'
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { ...toast, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm ${
                toast.variant === 'success'
                  ? 'border-emerald-800 bg-emerald-900/90 light:bg-emerald-50 light:border-emerald-300 text-emerald-200 light:text-emerald-800'
                  : toast.variant === 'danger'
                  ? 'border-red-800 bg-red-900/90 light:bg-red-50 light:border-red-300 text-red-200 light:text-red-800'
                  : 'border-gray-700 bg-gray-800/90 light:bg-white light:border-gray-200 text-gray-200 light:text-gray-800'
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{toast.title}</p>
                {toast.description && (
                  <p className="mt-1 text-xs opacity-80">{toast.description}</p>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => removeToast(toast.id)}
                className="opacity-60 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

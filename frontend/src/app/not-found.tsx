'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Home } from 'lucide-react'
import FuzzyText from '@/components/react-bits/FuzzyText'

export default function NotFound() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <FuzzyText fontSize="clamp(4rem, 15vw, 10rem)" color="#10b981" baseIntensity={0.15} hoverIntensity={0.4} enableHover>
          404
        </FuzzyText>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-2 text-center"
      >
        <h2 className="text-2xl font-bold text-white light:text-gray-900">Page not found</h2>
        <p className="text-gray-400 light:text-gray-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-colors"
        >
          <Home className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </motion.div>
    </div>
  )
}

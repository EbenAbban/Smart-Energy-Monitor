'use client'

import { motion, type Variants } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' },
  }),
}

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
}

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: 'easeOut' } },
}

const slideLeft: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export function AnimatedPage({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeIn}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function FadeUp({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div custom={delay} initial="hidden" animate="visible" variants={fadeUp} className={className}>
      {children}
    </motion.div>
  )
}

export function ScaleIn({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      custom={delay}
      initial="hidden"
      animate="visible"
      variants={scaleIn}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function SlideLeft({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      custom={delay}
      initial="hidden"
      animate="visible"
      variants={slideLeft}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerGrid({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function HoverScale({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function CountUp({
  value,
  suffix = '',
  decimals = 1,
  duration = 1.5,
}: {
  value: number
  suffix?: string
  decimals?: number
  duration?: number
}) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<number>(0)
  const startTime = useRef<number>(0)

  useEffect(() => {
    ref.current = 0
    startTime.current = 0
    const step = (ts: number) => {
      if (!startTime.current) startTime.current = ts
      const elapsed = (ts - startTime.current) / 1000
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(value * eased)
      if (progress < 1) requestAnimationFrame(step)
      else setDisplay(value)
    }
    requestAnimationFrame(step)
  }, [value, duration])

  return <span>{display.toFixed(decimals)}{suffix}</span>
}

export function AnimatedLine({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={`h-0.5 rounded-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent ${className}`}
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
      style={{ transformOrigin: 'left' }}
    />
  )
}

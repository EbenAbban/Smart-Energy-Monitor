'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface GaugeProps {
  value: number
  max: number
  label: string
  unit?: string
  size?: number
  thresholds?: { warn: number; danger: number }
}

export function GaugeChart({
  value,
  max,
  label,
  unit = '',
  size = 200,
  thresholds = { warn: 70, danger: 90 },
}: GaugeProps) {
  const [animatedValue, setAnimatedValue] = useState(0)

  useEffect(() => {
    const duration = 1000
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedValue(value * eased)
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [value])

  const percent = Math.min((animatedValue / max) * 100, 100)
  const angle = (percent / 100) * 270
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.35

  const color =
    percent > thresholds.danger
      ? '#ef4444'
      : percent > thresholds.warn
      ? '#f59e0b'
      : '#10b981'

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size * 0.55} viewBox={`0 0 ${size} ${size * 0.55}`}>
        <path
          d={describeArc(cx, cy, r, 135, 405)}
          fill="none"
          stroke="currentColor"
          className="text-gray-800 light:text-gray-200"
          strokeWidth={12}
          strokeLinecap="round"
        />
        <motion.path
          d={describeArc(cx, cy, r, 135, 135 + angle)}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: percent / 100 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
        <motion.text
          x={cx}
          y={cy + 20}
          textAnchor="middle"
          className="fill-white light:fill-gray-900 text-xl font-bold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {animatedValue.toFixed(1)}
          {unit && <tspan className="fill-gray-500 text-sm">{unit}</tspan>}
        </motion.text>
        <text
          x={cx}
          y={cy + 38}
          textAnchor="middle"
          className="fill-gray-500 text-xs"
        >
          of {max}{unit}
        </text>
      </svg>
      <span className="text-sm font-medium text-gray-400 light:text-gray-500">{label}</span>
    </div>
  )
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}

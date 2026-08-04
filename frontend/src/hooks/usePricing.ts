/**
 * usePricing — persists electricity pricing settings in localStorage
 * so they are shared across the Dashboard and Settings page.
 *
 * Pricing format: { ratePerKwh: number (in selected currency), currency: string, symbol: string }
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

export interface PricingConfig {
  ratePerKwh: number   // off-peak rate
  peakRatePerKwh: number  // peak rate (5–9 pm)
  currency: string     // ISO code, e.g. "GHS"
  symbol: string       // e.g. "₵"
}

const STORAGE_KEY = 'sem_pricing_config'

const DEFAULT: PricingConfig = {
  ratePerKwh: 1.50,
  peakRatePerKwh: 2.00,
  currency: 'GHS',
  symbol: '₵',
}

function loadConfig(): PricingConfig {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT
}

export function usePricing() {
  const [config, setConfigState] = useState<PricingConfig>(DEFAULT)

  useEffect(() => {
    setConfigState(loadConfig())
  }, [])

  const saveConfig = useCallback((next: PricingConfig) => {
    setConfigState(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    // Fire a storage event so other tabs/windows pick it up
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(next) }))
  }, [])

  // React to changes from other components in the same tab
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { setConfigState({ ...DEFAULT, ...JSON.parse(e.newValue) }) } catch { /* ignore */ }
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return { config, saveConfig }
}

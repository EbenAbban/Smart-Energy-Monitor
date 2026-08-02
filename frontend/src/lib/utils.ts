import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEnergy(kwh: number): string {
  return `${kwh.toFixed(2)} kWh`
}

export function formatPower(watts: number): string {
  if (watts >= 1000) return `${(watts / 1000).toFixed(2)} kW`
  return `${watts.toFixed(0)} W`
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

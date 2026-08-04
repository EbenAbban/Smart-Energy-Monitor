export interface Appliance {
  id: number
  name: string
  powerRating: number
  status: boolean
  relayNumber: number
  icon: string
  createdAt: string
  updatedAt: string
}

export interface EnergyReading {
  id: number
  timestamp: string
  energyUsed: number
  voltage: number
  current: number
  power: number
  applianceId?: number
  appliance: Appliance
  budget: number
  remaining: number
  alert: boolean
  budgetMaxKWh?: number
}

export interface Budget {
  id: number
  maximumEnergy: number
  currentUsage: number
  status: string
  month: number
  year: number
}

export interface DashboardData {
  totalEnergy: number
  currentPower: number
  activeAppliances: number
  totalAppliances: number
  budgetUsage: number
  budgetMaximum: number
  alerts: number
  hourlyUsage: { hour: string; energy: number }[]
  applianceBreakdown: { name: string; energy: number; percentage: number }[]
}

export interface ReadingsResponse {
  readings: EnergyReading[]
  total: number
}

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
  /** Present only on PUT /budget responses — true when an exceeded budget was recharged */
  wasRecharged?: boolean
  /** Units carried over from the overage when wasRecharged is true */
  carryOver?: number
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

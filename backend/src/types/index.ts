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

export interface EnergyReadingPayload {
  applianceId: number
  energyUsed: number
  voltage?: number
  current?: number
  power?: number
}

export interface ServerToClientEvents {
  reading: (data: EnergyReadingPayload) => void
  applianceStatus: (data: { applianceId: number; status: boolean }) => void
  alert: (data: { message: string; level: string }) => void
  budgetUpdate: (data: { used: number; maximum: number }) => void
}

export interface ClientToServerEvents {
  subscribe: (room: string) => void
  unsubscribe: (room: string) => void
}

import type { Appliance, Budget, DashboardData, EnergyReading, ReadingsResponse } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'API request failed')
  }
  return res.json()
}

export const api = {
  getDashboard: () => fetchJSON<DashboardData>('/dashboard'),

  getReadings: (params?: { applianceId?: number; from?: string; to?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams()
    if (params?.applianceId) query.set('applianceId', String(params.applianceId))
    if (params?.from) query.set('from', params.from)
    if (params?.to) query.set('to', params.to)
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))
    return fetchJSON<ReadingsResponse>(`/readings?${query}`)
  },

  sendReading: (data: { applianceId: number; energyUsed: number; voltage?: number; current?: number; power?: number }) =>
    fetchJSON<EnergyReading>('/readings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAppliances: () => fetchJSON<Appliance[]>('/appliances'),

  getAppliance: (id: number) => fetchJSON<Appliance>(`/appliances/${id}`),

  updateApplianceStatus: (id: number, status: boolean) =>
    fetchJSON<Appliance>(`/appliances/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  createAppliance: (data: { name: string; powerRating: number; relayNumber: number; icon?: string }) =>
    fetchJSON<Appliance>('/appliances', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getBudget: () => fetchJSON<Budget>('/budget'),

  setBudget: (maximumEnergy: number) =>
    fetchJSON<Budget>('/budget', {
      method: 'PUT',
      body: JSON.stringify({ maximumEnergy }),
    }),
}

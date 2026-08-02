'use client'

import { useEffect } from 'react'
import { connectSocket } from '@/services/socket'
import { useToast } from '@/components/ui/toast'

export function SocketAlertListener() {
  const { addToast } = useToast()

  useEffect(() => {
    const socket = connectSocket()

    socket.on('alert', (data: { message: string; level: string }) => {
      addToast({
        title: data.level === 'danger' ? 'Alert' : 'Warning',
        description: data.message,
        variant: data.level === 'danger' ? 'danger' : 'default',
      })
    })

    socket.on('budgetUpdate', (data: { used: number; maximum: number }) => {
      const pct = Math.round((data.used / data.maximum) * 100)
      if (pct > 90) {
        addToast({
          title: 'Budget Alert',
          description: `You've used ${pct}% of your monthly budget`,
          variant: 'danger',
        })
      }
    })

    socket.on('applianceStatus', (data: { applianceId: number; status: boolean }) => {
      addToast({
        title: data.status ? 'Appliance Turned On' : 'Appliance Turned Off',
        description: `Appliance #${data.applianceId} is now ${data.status ? 'ON' : 'OFF'}`,
        variant: 'default',
      })
    })

    return () => {
      socket.off('alert')
      socket.off('budgetUpdate')
      socket.off('applianceStatus')
    }
  }, [addToast])

  return null
}

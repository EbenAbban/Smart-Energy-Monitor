'use client'

import { useEffect, useRef, useCallback } from 'react'
import { connectSocket } from '@/services/socket'
import type { Socket } from 'socket.io-client'

export function useSocket<T = unknown>(
  event?: string,
  handler?: (data: T) => void
) {
  const socketRef = useRef<Socket | null>(null)
  const handlerRef = useRef(handler)

  // Keep handlerRef current without re-running the socket effect
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  // Fix #5: Merged socket connect + listener registration into a single effect.
  // Previously two separate effects ran independently — effect #1 stored the socket
  // in socketRef, effect #2 read socketRef.current. On first render effect #2 could
  // execute before effect #1 assigned the value, so the listener was attached to null
  // and real-time applianceStatus events never fired (requiring a manual page refresh).
  // Now the socket is guaranteed to be live before the listener is registered.
  useEffect(() => {
    const s = connectSocket()
    socketRef.current = s

    if (!event) return

    const callback = (data: T) => {
      handlerRef.current?.(data)
    }

    s.on(event, callback)
    return () => {
      s.off(event, callback)
    }
  }, [event])

  const emit = useCallback((eventName: string, data?: unknown) => {
    socketRef.current?.emit(eventName, data)
  }, [])

  return { emit }
}

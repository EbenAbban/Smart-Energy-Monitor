'use client'

import { useEffect, useRef, useCallback } from 'react'
import { connectSocket, disconnectSocket } from '@/services/socket'
import type { Socket } from 'socket.io-client'

export function useSocket<T = unknown>(
  event?: string,
  handler?: (data: T) => void
) {
  const socketRef = useRef<Socket | null>(null)
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    socketRef.current = connectSocket()
    return () => {
      disconnectSocket()
    }
  }, [])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !event) return

    const callback = (data: T) => {
      handlerRef.current?.(data)
    }

    socket.on(event, callback)
    return () => {
      socket.off(event, callback)
    }
  }, [event])

  const emit = useCallback((eventName: string, data?: unknown) => {
    socketRef.current?.emit(eventName, data)
  }, [])

  return { emit }
}

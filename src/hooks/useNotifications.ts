'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface Notification {
  id: string
  type: 'alert' | 'info' | 'success' | 'warning'
  title: string
  message?: string
  timestamp: string
  read: boolean
}

const HEARTBEAT_INTERVAL = 25_000 // 25s — under Cloudflare's 100s idle timeout
const MAX_RECONNECT_DELAY = 30_000
const BASE_RECONNECT_DELAY = 2_000

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectAttempt = useRef(0)
  const tokenRef = useRef<string | null>(null)
  const unmountedRef = useRef(false)

  const unreadCount = notifications.filter((n) => !n.read).length

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null }
  }, [])

  const startHeartbeat = useCallback((ws: WebSocket) => {
    stopHeartbeat()
    heartbeatRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, HEARTBEAT_INTERVAL)
  }, [stopHeartbeat])

  const connect = useCallback((token: string | null) => {
    if (!token || typeof window === 'undefined') return
    tokenRef.current = token

    // Close existing connection cleanly
    if (wsRef.current) {
      wsRef.current.onclose = null // prevent reconnect loop
      wsRef.current.close()
    }
    stopHeartbeat()

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/notifications/ws?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      reconnectAttempt.current = 0
      startHeartbeat(ws)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'pong') return // heartbeat response
        if (data.type === 'notification') {
          setNotifications((prev) => [
            { ...data.payload, id: data.payload.id || crypto.randomUUID(), read: false },
            ...prev,
          ].slice(0, 50))
        }
      } catch {
        // ignore non-JSON messages
      }
    }

    ws.onclose = () => {
      setConnected(false)
      stopHeartbeat()
      if (unmountedRef.current) return
      // Exponential backoff reconnect
      const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempt.current), MAX_RECONNECT_DELAY)
      reconnectAttempt.current++
      setTimeout(() => {
        if (!unmountedRef.current && tokenRef.current) connect(tokenRef.current)
      }, delay)
    }

    ws.onerror = () => ws.close()
  }, [startHeartbeat, stopHeartbeat])

  const reconnect = useCallback(() => {
    reconnectAttempt.current = 0
    if (tokenRef.current) connect(tokenRef.current)
  }, [connect])

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      stopHeartbeat()
      wsRef.current?.close()
    }
  }, [stopHeartbeat])

  return { notifications, unreadCount, connected, connect, reconnect, markRead, markAllRead, dismiss }
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { getApiBaseUrl } from '../services/config'
import { getAccessToken as vaultGetAccessToken } from '../services/tokenVault'

type EventCallback = (data: unknown) => void
export type WsStatus = 'connected' | 'reconnecting' | 'disconnected'

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const listenersRef = useRef<Map<string, Set<EventCallback>>>(new Map())
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const reconnectDelayRef = useRef(1000)
  const onlineListenerRef = useRef<(() => void) | null>(null)
  const [status, setStatus] = useState<WsStatus>('disconnected')

  const connect = useCallback(async () => {
    const apiUrl = getApiBaseUrl()
    let token: string | null = null
    try { token = await vaultGetAccessToken() } catch { token = null }
    if (!token) return

    // SECURITY: never place the bearer token in the WebSocket URL — query
    // strings land in proxy/access logs. Mint a 30s single-use ticket over
    // an authenticated HTTPS request, then hand only the ticket to the
    // socket handshake.
    const httpBase = apiUrl ? apiUrl.replace(/\/$/, '') : ''
    let ticket: string
    try {
      const res = await fetch(`${httpBase}/api/v1/ws/ticket`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`ticket mint failed: ${res.status}`)
      const body = (await res.json()) as { ticket?: string }
      if (!body.ticket) throw new Error('ticket missing in response')
      ticket = body.ticket
    } catch {
      // Backend unreachable or older backend without ticket support —
      // schedule a retry through the normal reconnect path.
      setStatus('reconnecting')
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000)
        connect()
      }, reconnectDelayRef.current)
      return
    }

    let wsUrl: string
    if (apiUrl) {
      // Full URL provided (prod/Electron) — convert to ws:// protocol
      wsUrl = apiUrl
        .replace(/^https:/, 'wss:')
        .replace(/^http:/, 'ws:')
        .replace(/\/$/, '')
    } else {
      // No base URL (dev proxy mode) — use current host
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      wsUrl = `${proto}//${window.location.host}`
    }

    const ws = new WebSocket(`${wsUrl}/api/v1/ws?ticket=${encodeURIComponent(ticket)}`)

    ws.onopen = () => {
      reconnectDelayRef.current = 1000
      setStatus('connected')
    }

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)
        const eventType = parsed.type as string
        const listeners = listenersRef.current.get(eventType)
        if (listeners) {
          for (const cb of listeners) {
            cb(parsed.data)
          }
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      wsRef.current = null
      setStatus('reconnecting')

      const attemptReconnect = () => {
        // If offline, wait for online event instead of polling
        if (!navigator.onLine) {
          setStatus('disconnected')
          const handleOnline = () => {
            window.removeEventListener('online', handleOnline)
            onlineListenerRef.current = null
            reconnectDelayRef.current = 1000
            connect()
          }
          window.addEventListener('online', handleOnline)
          onlineListenerRef.current = handleOnline
          return
        }

        // Exponential backoff reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000)
          connect()
        }, reconnectDelayRef.current)
      }

      attemptReconnect()
    }

    ws.onerror = () => {
      ws.close()
    }

    wsRef.current = ws
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (onlineListenerRef.current) {
        window.removeEventListener('online', onlineListenerRef.current)
        onlineListenerRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setStatus('disconnected')
    }
  }, [connect])

  const subscribe = useCallback((eventType: string, callback: EventCallback) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set())
    }
    listenersRef.current.get(eventType)!.add(callback)

    return () => {
      listenersRef.current.get(eventType)?.delete(callback)
    }
  }, [])

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    reconnectDelayRef.current = 1000
    connect()
  }, [connect])

  return { subscribe, status, reconnect }
}

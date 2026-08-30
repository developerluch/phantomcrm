import { createContext, useContext } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'

type EventCallback = (data: unknown) => void

interface WebSocketContextValue {
  subscribe: (eventType: string, callback: EventCallback) => () => void
  status: 'connected' | 'reconnecting' | 'disconnected'
  reconnect: () => void
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const ws = useWebSocket()

  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocketContext() {
  const ctx = useContext(WebSocketContext)
  if (!ctx) throw new Error('useWebSocketContext must be used within WebSocketProvider')
  return ctx
}

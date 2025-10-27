import React, { createContext, useCallback, useEffect, useRef, useState } from 'react'
import type { PriceMessage } from '../hooks/useWebSocket'

type WSState = {
  connecting: boolean
  connected: boolean
  lastMessage: PriceMessage | null
}

type WSContextValue = WSState

export const WebSocketContext = createContext<WSContextValue | undefined>(undefined)

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<PriceMessage | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number>(1000)
  const closedRef = useRef(false)

  const connect = useCallback(() => {
    if (closedRef.current) return
    setConnecting(true)
    // In dev, connect directly to backend to avoid Vite proxy startup races.
    // In production, use the same origin path so static hosting works.
    // Vite exposes import.meta.env.DEV when running dev server.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const isDev = typeof import.meta !== 'undefined' && !!import.meta.env && import.meta.env.DEV
    const origin = window.location.origin.replace(/^http/, 'ws')
    const url = isDev ? 'ws://localhost:8080/ws' : origin + '/ws'
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnecting(false)
      setConnected(true)
      reconnectRef.current = 1000
      // console.info('WebSocketProvider connected', url)
    }

    ws.onmessage = (ev) => {
      try {
        const obj = JSON.parse(ev.data) as PriceMessage
        setLastMessage(obj)
      } catch (err) {
        // ignore parse errors for now
      }
    }

    ws.onclose = () => {
      setConnected(false)
      setConnecting(false)
      if (closedRef.current) return
      // jittered exponential backoff
      const base = reconnectRef.current
      const jitter = Math.floor(Math.random() * 1000)
      const wait = Math.min(60000, base + jitter)
      reconnectRef.current = Math.min(60000, base * 2)
      setTimeout(() => connect(), wait)
    }

    ws.onerror = () => {
      // Avoid force-closing the socket here — calling close() before
      // the connection is established causes the browser console message
      // "WebSocket is closed before the connection is established".
      // Let onclose handle retries via the backoff logic.
      // We keep this handler minimal to avoid noisy logs in dev.
      // Optionally, we could set a local error state here for diagnostics.
      // console.debug('WebSocket error', ev)
    }
  }, [])

  useEffect(() => {
    closedRef.current = false
    connect()
    return () => {
      closedRef.current = true
      try {
        const ws = wsRef.current
        if (ws) {
          // Only explicitly close if the socket is already OPEN. If it's still CONNECTING,
          // calling close() can produce the "closed before the connection is established"
          // console message in the browser during dev (React StrictMode/HMR). Instead,
          // remove handlers so the in-progress socket won't attempt to update state after
          // unmount; onclose will fire naturally and we avoid the noisy message.
          if (ws.readyState === WebSocket.OPEN) {
            ws.close()
          } else {
            ws.onopen = null
            ws.onmessage = null
            ws.onclose = null
            ws.onerror = null
          }
        }
      } catch (err) {
        // ignore
      }
    }
  }, [connect])

  const value: WSContextValue = {
    connecting,
    connected,
    lastMessage
  }

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}

export default WebSocketProvider

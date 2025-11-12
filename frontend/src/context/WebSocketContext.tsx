import React, { createContext, useCallback, useEffect, useRef, useState } from 'react'
import type { PriceMessage } from '../hooks/useWebSocket'
import { useAppDispatch } from '../store'
import { updateCurrentPrice } from '../store/slices/priceSlice'
import { addToast } from '../store/slices/uiSlice'
import { createDeposit } from '../store/slices/transactionSlice'
import { fetchAccounts } from '../store/slices/accountSlice'

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

  const dispatch = useAppDispatch()

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number>(1000)
  const closedRef = useRef(false)

  const connect = useCallback(() => {
    if (closedRef.current) return
    setConnecting(true)
    // In dev, connect directly to local backend
    // In production, connect to Fly.io backend
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const isDev = typeof import.meta !== 'undefined' && !!import.meta.env && import.meta.env.DEV
    // Dynamically detect protocol based on current page (wss:// for HTTPS, ws:// for HTTP)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = isDev ? 'localhost:8080' : 'brokerageproject.fly.dev'
    const url = `${protocol}//${host}/ws`
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
        const obj = JSON.parse(ev.data) as {
          type?: string;
          payload?: {
            accountId: string;
            amount: string;
            currency: string;
            paymentIntentId: string;
            method?: string;
          };
        }

        // Handle crypto deposit completion messages from Coinbase webhook
        if (obj.type === 'DEPOSIT_COMPLETED') {
          const payload = obj.payload
          if (!payload) return;

          const accountId = payload.accountId
          const amount = parseFloat(payload.amount)
          const currency = payload.currency
          const paymentIntentId = payload.paymentIntentId

          // Dispatch createDeposit thunk to create the deposit transaction
          dispatch(createDeposit({
            accountId,
            amount,
            currency,
            paymentIntentId,
            metadata: payload.method ? { cardBrand: payload.method } : undefined
          }))
            .unwrap()
            .then(() => {
              dispatch(addToast({
                type: 'success',
                message: `Crypto deposit of ${amount} ${currency} completed!`,
                duration: 5000
              }))

              // Refresh accounts to get updated balances
              dispatch(fetchAccounts())

              // Clear pending deposit from localStorage
              localStorage.removeItem('pending_crypto_deposit')
            })
            .catch((error) => {
              console.error('Failed to process crypto deposit:', error)
              dispatch(addToast({
                type: 'error',
                message: 'Failed to process crypto deposit',
                duration: 5000
              }))
            })

          return // Don't process as price message
        }

        // Update price store for price messages (real-time price updates)
        const priceMsg = obj as PriceMessage
        if (priceMsg.symbol && priceMsg.price) {
          const price = typeof priceMsg.price === 'string' ? parseFloat(priceMsg.price) : priceMsg.price
          if (!isNaN(price)) {
            // Dispatch price update to Redux
            dispatch(updateCurrentPrice({
              symbol: priceMsg.symbol,
              price,
              timestamp: Date.now()
            }))

            // Note: Pending order processing is handled automatically by the backend's order processor
            // No need to process orders on the frontend
          }
        }

        // Keep lastMessage for components that need raw WebSocket data
        // (ChartComponent for klines, OrderBookPanel for depth/trades)
        setLastMessage(priceMsg)
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
  }, [dispatch])

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

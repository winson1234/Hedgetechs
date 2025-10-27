import React, { useEffect, useState, useContext } from 'react'
import { WebSocketContext } from '../context/WebSocketContext'
import type { PriceMessage } from '../hooks/useWebSocket'

export default function LivePriceDisplay() {
  const ws = useContext(WebSocketContext)
  const lastMessage = ws?.lastMessage ?? null
  const [price, setPrice] = useState<number | null>(null)
  const [prev, setPrev] = useState<number | null>(null)
  const priceRef = React.useRef<number | null>(null)

  useEffect(() => {
    if (!lastMessage) return
    const msg: PriceMessage = lastMessage
    const p = parseFloat(String(msg.price))
    // store previous value from ref, then update
    setPrev(priceRef.current)
    setPrice(p)
    priceRef.current = p
  }, [lastMessage])

  const color = price == null || prev == null ? 'text-slate-200' : price >= prev ? 'text-green-500' : 'text-red-500'

  return (
    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg ring-1 ring-inset ring-slate-700 shadow-sm">
      <div className="text-sm text-slate-400">BTC/USDT (live)</div>
      <div className={`text-3xl md:text-4xl font-mono ${color}`}>{price != null ? price.toFixed(2) : '—'}</div>
      <div className="text-xs text-slate-400">Real-time updates via WebSocket</div>
    </div>
  )
}

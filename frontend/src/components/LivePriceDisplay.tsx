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

  const color = price == null || prev == null ? 'text-gray-700' : price >= prev ? 'text-green-600' : 'text-red-600'

  return (
    <div className="p-4 bg-white rounded shadow">
      <div className="text-sm text-gray-500">BTC/USDT (live)</div>
      <div className={`text-3xl font-mono ${color}`}>{price != null ? price.toFixed(2) : '—'}</div>
      <div className="text-xs text-gray-400">Real-time updates via WebSocket</div>
    </div>
  )
}

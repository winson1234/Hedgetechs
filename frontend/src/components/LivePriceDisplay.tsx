import React, { useEffect, useState, useContext } from 'react'
import { WebSocketContext } from '../context/WebSocketContext'
import type { PriceMessage } from '../hooks/useWebSocket'

type LivePriceDisplayProps = {
  symbol: string
}

export default function LivePriceDisplay({ symbol }: LivePriceDisplayProps) {
  const ws = useContext(WebSocketContext)
  const lastMessage = ws?.lastMessage ?? null
  const [price, setPrice] = useState<number | null>(null)
  const [prev, setPrev] = useState<number | null>(null)
  const priceRef = React.useRef<number | null>(null)

  useEffect(() => {
    if (!lastMessage) return
    
    // CRITICAL: Check if this is a trade message (has 'price' field, not order book)
    if (!('price' in lastMessage)) {
      return // Ignore order book messages
    }
    
    const msg: PriceMessage = lastMessage as PriceMessage
    
    // Only process WebSocket messages that match the current symbol
    if (msg.symbol !== symbol) {
      return // Ignore messages from other symbols
    }
    
    const p = parseFloat(String(msg.price))
    if (isNaN(p)) return // Skip invalid prices
    
    // store previous value from ref, then update
    setPrev(priceRef.current)
    setPrice(p)
    priceRef.current = p
  }, [lastMessage, symbol])

  const color = price == null || prev == null ? 'text-slate-200 dark:text-slate-300' : price >= prev ? 'text-green-500' : 'text-red-500'
  
  // Format symbol for display (e.g., BTCUSDT -> BTC/USDT)
  const displaySymbol = symbol.replace(/USDT?$/, match => `/${match}`)

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
      <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">{displaySymbol} (live)</div>
      <div className={`text-5xl font-mono font-bold ${color}`}>
        {price != null ? price.toFixed(2) : '—'}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">Real-time updates via WebSocket</div>
    </div>
  )
}

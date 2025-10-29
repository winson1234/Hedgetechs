import React, { useEffect, useState, useContext } from 'react'
import { WebSocketContext } from '../context/WebSocketContext'
import type { PriceMessage } from '../hooks/useWebSocket'

type LivePriceDisplayProps = {
  symbol: string
}

const symbolIcons: Record<string, { iconUrl: string; baseCurrency: string }> = {
  'BTCUSDT': { iconUrl: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png', baseCurrency: 'BTC' },
  'ETHUSDT': { iconUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png', baseCurrency: 'ETH' },
  'SOLUSDT': { iconUrl: 'https://assets.coingecko.com/coins/images/4128/small/solana.png', baseCurrency: 'SOL' },
  'EURUSDT': { iconUrl: '', baseCurrency: '€' }
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
  
  // Get icon info for current symbol
  const iconInfo = symbolIcons[symbol] || { iconUrl: '', baseCurrency: symbol.substring(0, 3) }

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
      <div className="flex items-center gap-2 mb-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          {iconInfo.iconUrl ? (
            <img 
              src={iconInfo.iconUrl} 
              alt={iconInfo.baseCurrency}
              className="w-6 h-6 object-cover"
              onError={(e) => {
                // Fallback to text badge if image fails to load
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                const parent = target.parentElement
                if (parent) {
                  parent.innerHTML = `<span class="text-base font-bold text-slate-600 dark:text-slate-400">${iconInfo.baseCurrency}</span>`
                }
              }}
            />
          ) : (
            <span className="text-base font-bold text-slate-600 dark:text-slate-400">{iconInfo.baseCurrency}</span>
          )}
        </div>
        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">{displaySymbol} (live)</div>
      </div>
      <div className={`text-5xl font-mono font-bold ${color}`}>
        {price != null ? price.toFixed(2) : '—'}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">Real-time updates via WebSocket</div>
    </div>
  )
}

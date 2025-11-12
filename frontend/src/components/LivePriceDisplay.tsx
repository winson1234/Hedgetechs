import React, { useEffect, useState, useMemo } from 'react'
import { useAppSelector } from '../store'
import { useInstruments } from '../hooks/useInstruments'
import { formatPrice } from '../utils/priceUtils'

type LivePriceDisplayProps = {
  symbol: string
}

export default function LivePriceDisplay({ symbol }: LivePriceDisplayProps) {
  // Get instruments from backend API
  const { instruments } = useInstruments()

  // Create a lookup map for icon info
  const symbolIcons = useMemo(() => {
    const map: Record<string, { iconUrl: string; baseCurrency: string }> = {}
    instruments.forEach(inst => {
      map[inst.symbol] = {
        iconUrl: inst.iconUrl,
        baseCurrency: inst.baseCurrency
      }
    })
    return map
  }, [instruments])

  // Get current price from Redux store (updated by WebSocket middleware)
  const currentPrice = useAppSelector(state => state.price.currentPrices[symbol])
  const [price, setPrice] = useState<number | null>(null)
  const [prev, setPrev] = useState<number | null>(null)
  const priceRef = React.useRef<number | null>(null)

  useEffect(() => {
    if (!currentPrice) return

    const p = currentPrice.price
    if (isNaN(p)) return // Skip invalid prices

    // store previous value from ref, then update
    setPrev(priceRef.current)
    setPrice(p)
    priceRef.current = p
  }, [currentPrice])

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
        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">{displaySymbol}</div>
      </div>
      <div className={`text-5xl font-mono font-bold ${color}`}>
        {price != null ? formatPrice(price) : '—'}
      </div>
    </div>
  )
}

import React, { useEffect, useState } from 'react'

type InstrumentsPanelProps = {
  activeInstrument: string
  onInstrumentChange: (symbol: string) => void
}

type Instrument = {
  symbol: string
  displayName: string
  price: string
  change: string
}

type TickerData = {
  symbol: string
  lastPrice: string
  priceChangePercent: string
}

const instrumentSymbols = [
  { symbol: 'BTCUSDT', displayName: 'BTC/USD' },
  { symbol: 'ETHUSDT', displayName: 'ETH/USD' },
  { symbol: 'SOLUSDT', displayName: 'SOL/USD' },
  { symbol: 'EURUSDT', displayName: 'EUR/USD' }
]

export default function InstrumentsPanel({ activeInstrument, onInstrumentChange }: InstrumentsPanelProps) {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const symbols = instrumentSymbols.map(i => i.symbol).join(',')
        const response = await fetch(`/api/v1/ticker?symbols=${symbols}`)
        const data: TickerData[] = await response.json()
        
        // Combine ticker data with display names
        const combined = instrumentSymbols.map(inst => {
          const ticker = data.find((t) => t.symbol === inst.symbol)
          return {
            symbol: inst.symbol,
            displayName: inst.displayName,
            price: ticker?.lastPrice || '0.00',
            change: ticker?.priceChangePercent || '0.00'
          }
        })
        
        setInstruments(combined)
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch ticker data:', error)
        setLoading(false)
      }
    }

    fetchTickers()
    // Refresh every 10 seconds
    const interval = setInterval(fetchTickers, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      <div className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Instruments</div>
      {loading ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Loading...</div>
      ) : (
        <ul className="space-y-1">
          {instruments.map((item) => {
            const isActive = activeInstrument === item.symbol
            const changeNum = parseFloat(item.change)
            const isPositive = changeNum >= 0
            
            return (
              <li 
                key={item.symbol}
                onClick={() => onInstrumentChange(item.symbol)}
                className={`py-3 px-3 rounded-lg cursor-pointer transition-all ${
                  isActive 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800' 
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${
                    isActive ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {item.displayName}
                  </span>
                  <span className={`text-xs font-bold ${
                    isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
                  }`}>
                    {isPositive ? '+' : ''}{changeNum.toFixed(2)}%
                  </span>
                </div>
                <div className={`text-xs mt-1 ${
                  isActive ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
                }`}>
                  ${parseFloat(item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

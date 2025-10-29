import React, { useEffect, useState } from 'react'

type InstrumentsPanelProps = {
  activeInstrument: string
  onInstrumentChange: (symbol: string) => void
}

type Instrument = {
  symbol: string
  displayName: string
  baseCurrency: string
  price: string
  change: string
  iconUrl: string
}

type TickerData = {
  symbol: string
  lastPrice: string
  priceChangePercent: string
}

const instrumentSymbols = [
  { symbol: 'BTCUSDT', displayName: 'BTC/USD', baseCurrency: 'BTC', iconUrl: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  { symbol: 'ETHUSDT', displayName: 'ETH/USD', baseCurrency: 'ETH', iconUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  { symbol: 'SOLUSDT', displayName: 'SOL/USD', baseCurrency: 'SOL', iconUrl: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  { symbol: 'EURUSDT', displayName: 'EUR/USD', baseCurrency: '€', iconUrl: '' }
]

export default function InstrumentsPanel({ activeInstrument, onInstrumentChange }: InstrumentsPanelProps) {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('favoriteInstruments')
      if (saved) {
        setFavorites(new Set(JSON.parse(saved)))
      }
    } catch (e) {
      // ignore errors reading favorites
    }
  }, [])

  // Save favorites to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('favoriteInstruments', JSON.stringify(Array.from(favorites)))
    } catch (e) {
      // ignore write errors
    }
  }, [favorites])

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev)
      if (newFavorites.has(symbol)) {
        newFavorites.delete(symbol)
      } else {
        newFavorites.add(symbol)
      }
      return newFavorites
    })
  }

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
            baseCurrency: inst.baseCurrency,
            iconUrl: inst.iconUrl,
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

  // Filter instruments based on search and favorites
  const filteredInstruments = instruments.filter(item => {
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const matchesSearch = 
        item.symbol.toLowerCase().includes(query) ||
        item.displayName.toLowerCase().includes(query) ||
        item.baseCurrency.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }
    
    // Filter by favorites
    if (showFavoritesOnly) {
      return favorites.has(item.symbol)
    }
    
    return true
  })

  return (
    <div>
      {/* Header with title and favorite filter */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xl font-bold text-slate-900 dark:text-slate-100">Instruments</div>
        
        {/* Favorite filter toggle */}
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`p-1.5 rounded transition-colors ${
            showFavoritesOnly
              ? 'bg-amber-500 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={showFavoritesOnly ? 'Show all instruments' : 'Show favorites only'}
        >
          <svg className="w-4 h-4" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search instruments..."
          className="w-full px-3 py-2 pl-9 pr-9 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition"
        />
        {/* Search Icon */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {/* Clear Button */}
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {loading ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Loading...</div>
      ) : filteredInstruments.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
          {searchQuery ? `No results found for "${searchQuery}"` : 'No favorite instruments'}
        </div>
      ) : (
        <ul className="space-y-1">
          {filteredInstruments.map((item) => {
            const isActive = activeInstrument === item.symbol
            const changeNum = parseFloat(item.change)
            const isPositive = changeNum >= 0
            const isFavorite = favorites.has(item.symbol)
            
            return (
              <li 
                key={item.symbol}
                className={`relative py-3 px-3 rounded-lg cursor-pointer transition-all ${
                  isActive 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800' 
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3" onClick={() => onInstrumentChange(item.symbol)}>
                  {/* Icon */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {item.iconUrl ? (
                      <img 
                        src={item.iconUrl} 
                        alt={item.baseCurrency}
                        className="w-6 h-6 object-cover"
                        onError={(e) => {
                          // Fallback to text badge if image fails to load
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            parent.innerHTML = `<span class="text-base font-bold text-slate-600 dark:text-slate-400">${item.baseCurrency}</span>`
                          }
                        }}
                      />
                    ) : (
                      <span className="text-base font-bold text-slate-600 dark:text-slate-400">{item.baseCurrency}</span>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
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
                  </div>
                  
                  {/* Favorite Star Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(item.symbol)
                    }}
                    className="flex-shrink-0 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <svg 
                      className="w-4 h-4" 
                      fill={isFavorite ? '#f59e0b' : 'none'} 
                      stroke={isFavorite ? '#f59e0b' : 'currentColor'}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

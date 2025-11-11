import React, { useEffect, useState, useMemo } from 'react'
import { useAssetPrices } from '../hooks/useAssetPrices'
import { useAppDispatch, useAppSelector } from '../store'
import { setActiveInstrument } from '../store/slices/uiSlice'
import { formatPrice, formatPercentChange } from '../utils/priceUtils'

type InstrumentCategory = 'major' | 'defi' | 'altcoin'

interface InstrumentSymbol {
  symbol: string
  displayName: string
  baseCurrency: string
  iconUrl: string
  category: InstrumentCategory
}

const instrumentSymbols: InstrumentSymbol[] = [
  // Major (7)
  { symbol: 'BTCUSDT', displayName: 'BTC/USD', baseCurrency: 'BTC', category: 'major', iconUrl: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  { symbol: 'ETHUSDT', displayName: 'ETH/USD', baseCurrency: 'ETH', category: 'major', iconUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  { symbol: 'BNBUSDT', displayName: 'BNB/USD', baseCurrency: 'BNB', category: 'major', iconUrl: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png' },
  { symbol: 'SOLUSDT', displayName: 'SOL/USD', baseCurrency: 'SOL', category: 'major', iconUrl: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  { symbol: 'XRPUSDT', displayName: 'XRP/USD', baseCurrency: 'XRP', category: 'major', iconUrl: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png' },
  { symbol: 'ADAUSDT', displayName: 'ADA/USD', baseCurrency: 'ADA', category: 'major', iconUrl: 'https://assets.coingecko.com/coins/images/975/small/cardano.png' },
  { symbol: 'AVAXUSDT', displayName: 'AVAX/USD', baseCurrency: 'AVAX', category: 'major', iconUrl: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png' },

  // DeFi/Layer2 (8)
  { symbol: 'MATICUSDT', displayName: 'MATIC/USD', baseCurrency: 'MATIC', category: 'defi', iconUrl: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png' },
  { symbol: 'LINKUSDT', displayName: 'LINK/USD', baseCurrency: 'LINK', category: 'defi', iconUrl: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png' },
  { symbol: 'UNIUSDT', displayName: 'UNI/USD', baseCurrency: 'UNI', category: 'defi', iconUrl: 'https://assets.coingecko.com/coins/images/12504/small/uni.jpg' },
  { symbol: 'ATOMUSDT', displayName: 'ATOM/USD', baseCurrency: 'ATOM', category: 'defi', iconUrl: 'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png' },
  { symbol: 'DOTUSDT', displayName: 'DOT/USD', baseCurrency: 'DOT', category: 'defi', iconUrl: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png' },
  { symbol: 'ARBUSDT', displayName: 'ARB/USD', baseCurrency: 'ARB', category: 'defi', iconUrl: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg' },
  { symbol: 'OPUSDT', displayName: 'OP/USD', baseCurrency: 'OP', category: 'defi', iconUrl: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png' },
  { symbol: 'APTUSDT', displayName: 'APT/USD', baseCurrency: 'APT', category: 'defi', iconUrl: 'https://assets.coingecko.com/coins/images/26455/small/aptos_round.png' },

  // Altcoin (9)
  { symbol: 'DOGEUSDT', displayName: 'DOGE/USD', baseCurrency: 'DOGE', category: 'altcoin', iconUrl: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png' },
  { symbol: 'LTCUSDT', displayName: 'LTC/USD', baseCurrency: 'LTC', category: 'altcoin', iconUrl: 'https://assets.coingecko.com/coins/images/2/small/litecoin.png' },
  { symbol: 'SHIBUSDT', displayName: 'SHIB/USD', baseCurrency: 'SHIB', category: 'altcoin', iconUrl: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png' },
  { symbol: 'NEARUSDT', displayName: 'NEAR/USD', baseCurrency: 'NEAR', category: 'altcoin', iconUrl: 'https://assets.coingecko.com/coins/images/10365/small/near.jpg' },
  { symbol: 'ICPUSDT', displayName: 'ICP/USD', baseCurrency: 'ICP', category: 'altcoin', iconUrl: 'https://assets.coingecko.com/coins/images/14495/small/Internet_Computer_logo.png' },
  { symbol: 'FILUSDT', displayName: 'FIL/USD', baseCurrency: 'FIL', category: 'altcoin', iconUrl: 'https://assets.coingecko.com/coins/images/12817/small/filecoin.png' },
  { symbol: 'SUIUSDT', displayName: 'SUI/USD', baseCurrency: 'SUI', category: 'altcoin', iconUrl: 'https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg' },
  { symbol: 'STXUSDT', displayName: 'STX/USD', baseCurrency: 'STX', category: 'altcoin', iconUrl: 'https://assets.coingecko.com/coins/images/2069/small/Stacks_logo_full.png' },
  { symbol: 'TONUSDT', displayName: 'TON/USD', baseCurrency: 'TON', category: 'altcoin', iconUrl: 'https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png' },
]

type CategoryFilter = 'all' | InstrumentCategory

export default function InstrumentsPanel() {
  const dispatch = useAppDispatch();
  // Access Redux state
  const activeInstrument = useAppSelector(state => state.ui.activeInstrument);
  const priceData = useAppSelector(state => state.price.currentPrices);

  // Get asset prices
  const { prices: assetPrices, loading: pricesLoading } = useAssetPrices();
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  // Load favorites and category filter from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('favoriteInstruments')
      if (saved) {
        setFavorites(new Set(JSON.parse(saved)))
      }
      const savedCategory = localStorage.getItem('instrumentCategoryFilter')
      if (savedCategory) {
        setCategoryFilter(savedCategory as CategoryFilter)
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

  // Save category filter to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('instrumentCategoryFilter', categoryFilter)
    } catch (e) {
      // ignore write errors
    }
  }, [categoryFilter])

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

  // Build instruments from shared assetPrices prop
  const instruments = useMemo(() => {
    return instrumentSymbols.map(inst => {
      const price = assetPrices[inst.symbol] || 0
      const priceInfo = priceData[inst.symbol]
      const changePercent = 0 // Will be updated by WebSocket in future

      // Check if instrument has received data (within last 10 seconds)
      const lastUpdate = priceInfo?.timestamp || 0
      const now = Date.now()
      const isActive = lastUpdate > 0 && (now - lastUpdate) < 10000
      const isLoading = lastUpdate === 0

      return {
        symbol: inst.symbol,
        displayName: inst.displayName,
        baseCurrency: inst.baseCurrency,
        iconUrl: inst.iconUrl,
        category: inst.category,
        price: price,
        change: changePercent,
        isActive,
        isLoading,
      }
    })
  }, [assetPrices, priceData])

  // Filter instruments based on search, favorites, and category
  const filteredInstruments = instruments.filter(item => {
    // Filter by category
    if (categoryFilter !== 'all' && item.category !== categoryFilter) {
      return false
    }

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

  // Category counts
  const categoryCounts = useMemo(() => {
    return {
      all: instruments.length,
      major: instruments.filter(i => i.category === 'major').length,
      defi: instruments.filter(i => i.category === 'defi').length,
      altcoin: instruments.filter(i => i.category === 'altcoin').length,
    }
  }, [instruments])

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

      {/* Category Filter Tabs */}
      <div className="flex gap-1 mb-3 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded-md transition ${
            categoryFilter === 'all'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          All ({categoryCounts.all})
        </button>
        <button
          onClick={() => setCategoryFilter('major')}
          className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded-md transition ${
            categoryFilter === 'major'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Major ({categoryCounts.major})
        </button>
        <button
          onClick={() => setCategoryFilter('defi')}
          className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded-md transition ${
            categoryFilter === 'defi'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          DeFi ({categoryCounts.defi})
        </button>
        <button
          onClick={() => setCategoryFilter('altcoin')}
          className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded-md transition ${
            categoryFilter === 'altcoin'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Altcoin ({categoryCounts.altcoin})
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

      {pricesLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="py-3 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                <div className="flex-1">
                  <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-20 mb-1"></div>
                  <div className="h-3 bg-slate-300 dark:bg-slate-700 rounded w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredInstruments.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
          {searchQuery ? `No results found for "${searchQuery}"` : 'No favorite instruments'}
        </div>
      ) : (
        <ul className="space-y-1">
          {filteredInstruments.map((item) => {
            const isActiveInstrument = activeInstrument === item.symbol
            const changeNum = item.change
            const isPositive = changeNum >= 0
            const isFavorite = favorites.has(item.symbol)
            const { text: changeText } = formatPercentChange(changeNum)

            return (
              <li
                key={item.symbol}
                className={`relative py-3 px-3 rounded-lg cursor-pointer transition-all ${
                  isActiveInstrument
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3" onClick={() => dispatch(setActiveInstrument(item.symbol))}>
                  {/* Icon */}
                  <div className="relative flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {item.isLoading ? (
                      <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 border-t-slate-600 dark:border-t-slate-300 rounded-full animate-spin"></div>
                    ) : item.iconUrl ? (
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

                    {/* Status Indicator */}
                    {!item.isLoading && (
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                        item.isActive ? 'bg-green-500' : 'bg-slate-400'
                      }`} title={item.isActive ? 'Active' : 'Inactive'}></div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${
                        isActiveInstrument ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {item.displayName}
                      </span>
                      <span className={`text-xs font-bold ${
                        isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
                      }`}>
                        {changeText}
                      </span>
                    </div>
                    <div className={`text-xs mt-1 ${
                      isActiveInstrument ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      ${formatPrice(item.price)}
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

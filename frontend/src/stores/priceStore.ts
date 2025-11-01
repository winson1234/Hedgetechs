import { create } from 'zustand'

// Binance 24h ticker response format
interface BinanceTicker {
  symbol: string
  lastPrice: string
  highPrice: string
  lowPrice: string
  openPrice: string
  volume: string
  priceChange: string
  priceChangePercent: string
}

// Price data structure
export interface PriceData {
  current: number        // Real-time price from WebSocket
  timestamp: number      // Last update timestamp
  high24h: number        // 24h high from REST hydration
  low24h: number         // 24h low from REST hydration
  open24h: number        // 24h open from REST hydration
  volume24h: number      // 24h volume from REST hydration
  change24h: number      // 24h change percentage
  changeValue24h: number // 24h change absolute value
}

interface PriceStore {
  prices: Record<string, PriceData>
  loading: boolean
  lastHydration: number | null

  // Actions
  hydrateFrom24hData: (data: BinanceTicker[]) => void
  updateCurrentPrice: (symbol: string, price: number) => void
  clearStaleData: () => void
}

export const usePriceStore = create<PriceStore>((set, get) => ({
  prices: {},
  loading: true,
  lastHydration: null,

  hydrateFrom24hData: (data: BinanceTicker[]) => {
    const prices: Record<string, PriceData> = {}

    data.forEach((ticker) => {
      const current = parseFloat(ticker.lastPrice)
      const high = parseFloat(ticker.highPrice)
      const low = parseFloat(ticker.lowPrice)
      const open = parseFloat(ticker.openPrice)
      const volume = parseFloat(ticker.volume)
      const changeValue = parseFloat(ticker.priceChange)
      const changePercent = parseFloat(ticker.priceChangePercent)

      prices[ticker.symbol] = {
        current,
        timestamp: Date.now(),
        high24h: high,
        low24h: low,
        open24h: open,
        volume24h: volume,
        change24h: changePercent,
        changeValue24h: changeValue,
      }
    })

    set({
      prices,
      loading: false,
      lastHydration: Date.now(),
    })
  },

  updateCurrentPrice: (symbol: string, price: number) => {
    const { prices } = get()
    const existingData = prices[symbol]

    if (!existingData) {
      // If we don't have hydrated data yet, create minimal entry
      set((state) => ({
        prices: {
          ...state.prices,
          [symbol]: {
            current: price,
            timestamp: Date.now(),
            high24h: price,
            low24h: price,
            open24h: price,
            volume24h: 0,
            change24h: 0,
            changeValue24h: 0,
          },
        },
      }))
      return
    }

    // Update current price only - preserve 24h change data from hydration
    // This prevents recalculation errors and keeps the official Binance 24h change percentage
    set((state) => ({
      prices: {
        ...state.prices,
        [symbol]: {
          ...existingData,
          current: price,
          timestamp: Date.now(),
        },
      },
    }))
  },

  clearStaleData: () => {
    const { prices } = get()
    const now = Date.now()
    const staleThreshold = 60000 // 60 seconds

    const freshPrices: Record<string, PriceData> = {}
    Object.entries(prices).forEach(([symbol, data]) => {
      if (now - data.timestamp < staleThreshold) {
        freshPrices[symbol] = data
      }
    })

    set({ prices: freshPrices })
  },
}))

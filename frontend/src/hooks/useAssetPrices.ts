import { useMemo } from 'react'
import { useAppSelector } from '../store'

export type AssetPriceMap = Record<string, number>

interface UseAssetPricesReturn {
  prices: AssetPriceMap
  loading: boolean
}

/**
 * Hook that provides real-time asset prices from Redux store.
 * Prices are hydrated once on app load from REST API, then updated in real-time via WebSocket.
 *
 * @param symbols - Array of symbols (kept for backward compatibility, but now retrieves all available prices)
 * @returns Object with prices map and loading state
 */
export const useAssetPrices = (symbols?: string[]): UseAssetPricesReturn => {
  // Get all prices from Redux store and convert to simple price map
  const currentPrices = useAppSelector(state => state.price.currentPrices)
  const loading = useAppSelector(state => state.price.loading)

  // Convert PriceData objects to simple number map for backward compatibility
  // Use useMemo to prevent creating new object on every render (fixes infinite loop)
  const prices: AssetPriceMap = useMemo(() => {
    return Object.fromEntries(
      Object.entries(currentPrices).map(([symbol, data]) => [symbol, data.price])
    )
  }, [currentPrices])

  // If symbols array was provided (legacy usage), filter to only those symbols
  // Otherwise return all available prices
  const filteredPrices = useMemo(() => {
    if (symbols && symbols.length > 0) {
      const filtered: AssetPriceMap = {}
      symbols.forEach(symbol => {
        if (prices[symbol] !== undefined) {
          filtered[symbol] = prices[symbol]
        }
      })
      return filtered
    }
    return prices
  }, [prices, symbols])

  return { prices: filteredPrices, loading }
}

import { usePriceStore } from '../stores/priceStore'

export type AssetPriceMap = Record<string, number>

interface UseAssetPricesReturn {
  prices: AssetPriceMap
  loading: boolean
}

/**
 * Hook that provides real-time asset prices from the unified price store.
 * Prices are hydrated once on app load from REST API, then updated in real-time via WebSocket.
 *
 * @param symbols - Array of symbols (kept for backward compatibility, but now retrieves all available prices)
 * @returns Object with prices map and loading state
 */
export const useAssetPrices = (symbols?: string[]): UseAssetPricesReturn => {
  // Get all prices from the store and convert to simple price map
  const allPrices = usePriceStore(state => state.prices)
  const loading = usePriceStore(state => state.loading)

  // Convert PriceData objects to simple number map for backward compatibility
  const prices: AssetPriceMap = Object.fromEntries(
    Object.entries(allPrices).map(([symbol, data]) => [symbol, data.current])
  )

  // If symbols array was provided (legacy usage), filter to only those symbols
  // Otherwise return all available prices
  if (symbols && symbols.length > 0) {
    const filtered: AssetPriceMap = {}
    symbols.forEach(symbol => {
      if (prices[symbol] !== undefined) {
        filtered[symbol] = prices[symbol]
      }
    })
    return { prices: filtered, loading }
  }

  return { prices, loading }
}

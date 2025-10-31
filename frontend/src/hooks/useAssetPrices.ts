import { useEffect, useState } from 'react'

export type AssetPriceMap = Record<string, number>

interface UseAssetPricesReturn {
  prices: AssetPriceMap
  loading: boolean
}

export const useAssetPrices = (symbols: string[]): UseAssetPricesReturn => {
  const [prices, setPrices] = useState<AssetPriceMap>({})
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const symbolsParam = symbols.join(',')
        const response = await fetch(`/api/v1/ticker?symbols=${symbolsParam}`)

        if (!response.ok) {
          throw new Error('Failed to fetch asset prices')
        }

        const data = await response.json()

        const priceMap: AssetPriceMap = {}
        if (Array.isArray(data)) {
          data.forEach((ticker: { symbol?: string; lastPrice?: string }) => {
            if (ticker.symbol && ticker.lastPrice) {
              priceMap[ticker.symbol] = parseFloat(ticker.lastPrice)
            }
          })
        }

        setPrices(priceMap)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching asset prices:', error)
        setLoading(false)
      }
    }

    fetchPrices()
    const interval = setInterval(fetchPrices, 10000)

    return () => clearInterval(interval)
  }, [symbols])

  return { prices, loading }
}

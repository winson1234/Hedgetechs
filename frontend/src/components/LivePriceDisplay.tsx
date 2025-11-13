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
      // Support both legacy and new API format
      const baseCurrency = inst.baseCurrency || inst.base_currency || inst.symbol.replace('USDT', '')

      // Use icon URL if available, otherwise map ALL currencies to icons
      let iconUrl = inst.iconUrl || ''
      if (!iconUrl && inst.base_currency) {
        // Complete icon mapping for ALL 26 instruments in database
        const iconMap: Record<string, string> = {
          // Major Cryptocurrencies
          'BTC': 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
          'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
          'BNB': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
          'SOL': 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
          'XRP': 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
          'ADA': 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
          'AVAX': 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',

          // DeFi / Layer 2
          'MATIC': 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
          'LINK': 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
          'UNI': 'https://assets.coingecko.com/coins/images/12504/small/uni.jpg',
          'ATOM': 'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png',
          'DOT': 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
          'ARB': 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
          'OP': 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
          'APT': 'https://assets.coingecko.com/coins/images/26455/small/aptos_round.png',

          // Altcoins
          'DOGE': 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
          'LTC': 'https://assets.coingecko.com/coins/images/2/small/litecoin.png',
          'SHIB': 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
          'NEAR': 'https://assets.coingecko.com/coins/images/10365/small/near.jpg',
          'ICP': 'https://assets.coingecko.com/coins/images/14495/small/Internet_Computer_logo.png',
          'FIL': 'https://assets.coingecko.com/coins/images/12817/small/filecoin.png',
          'SUI': 'https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg',
          'STX': 'https://assets.coingecko.com/coins/images/2069/small/Stacks_logo_full.png',
          'TON': 'https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png',

          // Forex & Commodities (CFD instruments)
          'EUR': 'https://hatscripts.github.io/circle-flags/flags/eu.svg',
          'PAXG': 'https://assets.coingecko.com/coins/images/9519/small/paxg.PNG',
        }
        iconUrl = iconMap[inst.base_currency] || ''
      }

      map[inst.symbol] = {
        iconUrl: iconUrl,
        baseCurrency: baseCurrency
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

import React, { useEffect, useState, useContext } from 'react'
import { WebSocketContext } from '../context/WebSocketContext'

type SpotTradingPanelProps = {
  activeInstrument: string
}

type OrderType = 'limit' | 'market' | 'stop-limit'

export default function SpotTradingPanel({ activeInstrument }: SpotTradingPanelProps) {
  const ws = useContext(WebSocketContext)
  const lastMessage = ws?.lastMessage ?? null
  
  const [orderType, setOrderType] = useState<OrderType>('limit')
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [limitPrice, setLimitPrice] = useState<string>('')
  const [stopPrice, setStopPrice] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [percentage, setPercentage] = useState<number>(0)
  
  // Mock balance (in production, fetch from API)
  const balance = 10000 // USD
  
  // Extract base and quote currencies from symbol (e.g., BTCUSDT -> BTC, USDT)
  const baseCurrency = activeInstrument.replace(/USDT?$/, '')
  const quoteCurrency = activeInstrument.match(/USDT?$/)?.[0] || 'USDT'
  
  // Listen to live price updates
  useEffect(() => {
    if (!lastMessage) return
    
    // Only process trade messages (has price field, no bids/asks)
    if ('symbol' in lastMessage && 'price' in lastMessage && !('bids' in lastMessage)) {
      const msg = lastMessage as { symbol: string; price: string | number }
      
      if (msg.symbol === activeInstrument) {
        const price = typeof msg.price === 'string' ? parseFloat(msg.price) : msg.price
        if (!isNaN(price)) {
          setCurrentPrice(price)
        }
      }
    }
  }, [lastMessage, activeInstrument])
  
  // Initialize limit price when instrument changes or when first price is received
  useEffect(() => {
    if (currentPrice > 0 && !limitPrice) {
      setLimitPrice(currentPrice.toFixed(2))
    }
  }, [currentPrice, limitPrice])
  
  // Reset form ONLY when instrument changes
  useEffect(() => {
    setLimitPrice('')
    setStopPrice('')
    setAmount('')
    setPercentage(0)
  }, [activeInstrument])
  
  // Calculate total
  const getTotal = (): string => {
    const price = orderType === 'market' ? currentPrice : parseFloat(limitPrice)
    const qty = parseFloat(amount)
    
    if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) {
      return '0.00'
    }
    
    return (price * qty).toFixed(2)
  }
  
  // Calculate max amount based on percentage
  const calculateAmountFromPercentage = (pct: number) => {
    const price = orderType === 'market' ? currentPrice : parseFloat(limitPrice)
    if (isNaN(price) || price <= 0) return
    
    const usdAmount = balance * (pct / 100)
    const cryptoAmount = usdAmount / price
    setAmount(cryptoAmount.toFixed(6))
    setPercentage(pct)
  }
  
  // Handle amount input change
  const handleAmountChange = (value: string) => {
    setAmount(value)
    // Reset percentage slider when manually typing
    setPercentage(0)
  }
  
  // Handle order submission (mock)
  const handleOrder = (side: 'buy' | 'sell') => {
    const price = orderType === 'market' ? currentPrice : parseFloat(limitPrice)
    const qty = parseFloat(amount)
    
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid amount')
      return
    }
    
    if (orderType !== 'market' && (isNaN(price) || price <= 0)) {
      alert('Please enter a valid price')
      return
    }
    
    if (orderType === 'stop-limit' && (isNaN(parseFloat(stopPrice)) || parseFloat(stopPrice) <= 0)) {
      alert('Please enter a valid stop price')
      return
    }
    
    // Mock order confirmation
    const orderDetails = {
      side,
      type: orderType,
      symbol: activeInstrument,
      price: orderType === 'market' ? 'Market' : price.toFixed(2),
      amount: qty.toFixed(6),
      total: getTotal(),
      stopPrice: orderType === 'stop-limit' ? stopPrice : undefined
    }
    
    console.log('Order placed:', orderDetails)
    alert(`${side.toUpperCase()} order placed!\n${JSON.stringify(orderDetails, null, 2)}`)
    
    // Reset form
    setAmount('')
    setPercentage(0)
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Spot Trading</h3>
      </div>
      
      {/* Order Type Tabs */}
      <div className="flex gap-1 mb-3 bg-slate-100 dark:bg-slate-800 rounded p-1">
        <button
          onClick={() => setOrderType('limit')}
          className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition ${
            orderType === 'limit'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Limit
        </button>
        <button
          onClick={() => setOrderType('market')}
          className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition ${
            orderType === 'market'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Market
        </button>
        <button
          onClick={() => setOrderType('stop-limit')}
          className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition ${
            orderType === 'stop-limit'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Stop-Limit
        </button>
      </div>
      
      {/* Order Form */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        {/* Stop Price (only for stop-limit) */}
        {orderType === 'stop-limit' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Stop Price
            </label>
            <div className="relative">
              <input
                type="number"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                placeholder={currentPrice > 0 ? currentPrice.toFixed(2) : '0.00'}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
              />
              <span className="absolute right-3 top-2 text-xs text-slate-400">{quoteCurrency}</span>
            </div>
          </div>
        )}
        
        {/* Price (not shown for market orders) */}
        {orderType !== 'market' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Price
            </label>
            <div className="relative">
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={currentPrice > 0 ? currentPrice.toFixed(2) : '0.00'}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
              />
              <span className="absolute right-3 top-2 text-xs text-slate-400">{quoteCurrency}</span>
            </div>
          </div>
        )}
        
        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Amount
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.000000"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
            />
            <span className="absolute right-3 top-2 text-xs text-slate-400">{baseCurrency}</span>
          </div>
        </div>
        
        {/* Percentage Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Quick Amount</span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{percentage}%</span>
          </div>
          <div className="flex gap-2">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => calculateAmountFromPercentage(pct)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition ${
                  percentage === pct
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
        
        {/* Total */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600 dark:text-slate-400">Total</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {getTotal()} <span className="text-xs text-slate-500 dark:text-slate-400">{quoteCurrency}</span>
            </span>
          </div>
        </div>
        
        {/* Spacer for Limit and Market orders to balance with Stop-Limit */}
        {orderType !== 'stop-limit' && <div className="flex-2"></div>}
        
        {/* Buy/Sell Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={() => handleOrder('buy')}
            className="px-4 py-2.5 text-sm font-semibold bg-green-500 hover:bg-green-600 text-white rounded transition"
          >
            Buy {baseCurrency}
          </button>
          <button
            onClick={() => handleOrder('sell')}
            className="px-4 py-2.5 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded transition"
          >
            Sell {baseCurrency}
          </button>
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useState, useContext } from 'react'
import { WebSocketContext } from '../context/WebSocketContext'

type TradingPanelProps = {
  activeInstrument: string
  usdBalance: number
  cryptoHoldings: Record<string, number>
  onBuyOrder: (symbol: string, amount: number, price: number) => { success: boolean; message: string }
  onSellOrder: (symbol: string, amount: number, price: number) => { success: boolean; message: string }
}

type TradingMode = 'spot' | 'cross' | 'isolated' | 'grid'
type OrderType = 'limit' | 'market' | 'stop-limit'

export default function TradingPanel({ 
  activeInstrument, 
  usdBalance, 
  cryptoHoldings, 
  onBuyOrder, 
  onSellOrder 
}: TradingPanelProps) {
  const ws = useContext(WebSocketContext)
  const lastMessage = ws?.lastMessage ?? null
  
  // Trading mode and settings
  const [tradingMode, setTradingMode] = useState<TradingMode>('spot')
  const [orderType, setOrderType] = useState<OrderType>('limit')
  const [isRecurring, setIsRecurring] = useState<boolean>(false)
  const [buyWithEUR, setBuyWithEUR] = useState<boolean>(false)
  const [enableTPSL, setEnableTPSL] = useState<boolean>(false)
  const feeLevel = 0.1 // 0.1% default fee
  
  // Price and order inputs
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [limitPrice, setLimitPrice] = useState<string>('')
  const [stopPrice, setStopPrice] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [percentage, setPercentage] = useState<number>(0)
  
  // TP/SL inputs
  const [tpTrigger, setTpTrigger] = useState<string>('')
  const [tpLimit, setTpLimit] = useState<string>('')
  const [tpOffset, setTpOffset] = useState<string>('')
  const [slTrigger, setSlTrigger] = useState<string>('')
  const [slLimit, setSlLimit] = useState<string>('')
  const [slOffset, setSlOffset] = useState<string>('')
  
  // Trading info
  const [lots, setLots] = useState<number>(0)
  const [margin, setMargin] = useState<number>(0)
  const [pipValue, setPipValue] = useState<number>(0)
  
  // Pending orders
  type PendingOrder = {
    id: string
    type: 'limit' | 'stop-limit'
    side: 'buy' | 'sell'
    symbol: string
    price: number
    amount: number
    stopPrice?: number
    timestamp: number
  }
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  
  // Extract base and quote currencies from symbol (e.g., BTCUSDT -> BTC, USDT)
  const baseCurrency = activeInstrument.replace(/USDT?$/, '')
  const quoteCurrency = activeInstrument.match(/USDT?$/)?.[0] || 'USDT'
  
  // Get current holdings for the active instrument
  const currentHolding = cryptoHoldings[baseCurrency] || 0
  
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
    // Reset ALL state including currentPrice
    setCurrentPrice(0)
    setLimitPrice('')
    setStopPrice('')
    setAmount('')
    setPercentage(0)
    setTpTrigger('')
    setTpLimit('')
    setTpOffset('')
    setSlTrigger('')
    setSlLimit('')
    setSlOffset('')
  }, [activeInstrument])
  
  // Calculate trading info (lots, margin, pip value)
  useEffect(() => {
    const qty = parseFloat(amount)
    
    // Always use currentPrice as the base, fallback to limitPrice if needed
    let price = currentPrice
    
    // For limit orders, use limitPrice if available and valid
    if (orderType === 'limit' && limitPrice && parseFloat(limitPrice) > 0) {
      price = parseFloat(limitPrice)
    }
    
    if (!isNaN(qty) && qty > 0 && !isNaN(price) && price > 0) {
      // Lots calculation (1 lot = 100,000 units in forex, for crypto we use direct amount)
      const calculatedLots = tradingMode === 'spot' ? qty : qty / 100000
      setLots(calculatedLots)
      
      // Margin calculation (for leveraged trading)
      const leverage = tradingMode === 'spot' ? 1 : (tradingMode === 'cross' ? 10 : 5)
      const totalValue = qty * price
      const calculatedMargin = totalValue / leverage
      setMargin(calculatedMargin)
      
      // Pip value calculation (1 pip = 0.0001 for most pairs)
      const pipSize = 0.0001
      const calculatedPipValue = qty * pipSize
      setPipValue(calculatedPipValue)
    } else {
      setLots(0)
      setMargin(0)
      setPipValue(0)
    }
  }, [amount, limitPrice, currentPrice, orderType, tradingMode])
  
  // Calculate total
  // Calculate fee amount
  const getFeeAmount = (): number => {
    let price = currentPrice
    if (orderType === 'limit' && limitPrice && parseFloat(limitPrice) > 0) {
      price = parseFloat(limitPrice)
    }
    const qty = parseFloat(amount)
    if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) {
      return 0
    }
    return price * qty * (feeLevel / 100)
  }

  // Calculate total including fee
  const getTotal = (): string => {
    let price = currentPrice
    if (orderType === 'limit' && limitPrice && parseFloat(limitPrice) > 0) {
      price = parseFloat(limitPrice)
    }
    const qty = parseFloat(amount)
    if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) {
      return '0.00'
    }
    const total = price * qty + getFeeAmount()
    return total.toFixed(2)
  }
  
  // Calculate max amount based on percentage
  const calculateAmountFromPercentage = (pct: number) => {
    // Always use currentPrice as the base, fallback to limitPrice if needed
    let price = currentPrice
    
    // For limit orders, use limitPrice if available and valid
    if (orderType === 'limit' && limitPrice && parseFloat(limitPrice) > 0) {
      price = parseFloat(limitPrice)
    }
    
    // If price is still invalid, return early
    if (isNaN(price) || price <= 0) {
      console.warn('Invalid price for percentage calculation:', price)
      return
    }
    
    const usdAmount = usdBalance * (pct / 100)
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
  
  // Handle order submission
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
    
    // For limit and stop-limit orders, add to pending orders
    if (orderType === 'limit' || orderType === 'stop-limit') {
      const newOrder: PendingOrder = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: orderType,
        side,
        symbol: activeInstrument,
        price,
        amount: qty,
        stopPrice: orderType === 'stop-limit' ? parseFloat(stopPrice) : undefined,
        timestamp: Date.now()
      }
      
      setPendingOrders(prev => [...prev, newOrder])
      
      alert(`${orderType.toUpperCase()} ${side.toUpperCase()} order placed successfully!\nPrice: ${price.toFixed(2)} ${quoteCurrency}\nAmount: ${qty.toFixed(6)} ${baseCurrency}`)
    } else {
      // Market orders execute immediately
      const result = side === 'buy' 
        ? onBuyOrder(activeInstrument, qty, price)
        : onSellOrder(activeInstrument, qty, price)
      
      if (!result.success) {
        alert(result.message)
        return
      }
      
      alert(`MARKET ${side.toUpperCase()} order executed successfully!\nPrice: ${price.toFixed(2)} ${quoteCurrency}\nAmount: ${qty.toFixed(6)} ${baseCurrency}`)
    }
    
    // Reset form
    setAmount('')
    setPercentage(0)
  }
  
  // Cancel pending order
  const cancelPendingOrder = (orderId: string) => {
    setPendingOrders(prev => prev.filter(order => order.id !== orderId))
    alert('Order cancelled successfully')
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 h-full flex flex-col">
      {/* Header with Fee Level */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Trading</h3>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="font-medium">% Fee Level</span>
          <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded font-semibold text-slate-700 dark:text-slate-300">
            {feeLevel}%
          </span>
        </div>
      </div>
      
      {/* Trading Mode Tabs */}
      <div className="flex gap-1.5 mb-4 bg-slate-100 dark:bg-slate-800 rounded-lg p-1.5">
        {(['spot', 'cross', 'isolated', 'grid'] as TradingMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setTradingMode(mode)}
            className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition capitalize ${
              tradingMode === mode
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
      
      {/* Order Type Tabs */}
      <div className="flex gap-1.5 mb-4 bg-slate-100 dark:bg-slate-800 rounded-lg p-1.5">
        <button
          onClick={() => setOrderType('limit')}
          className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition ${
            orderType === 'limit'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Limit
        </button>
        <button
          onClick={() => setOrderType('market')}
          className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition ${
            orderType === 'market'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Market
        </button>
        <button
          onClick={() => setOrderType('stop-limit')}
          className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition ${
            orderType === 'stop-limit'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Stop-Limit
        </button>
      </div>
      
      {/* Recurring and Buy with EUR Toggles */}
      <div className="flex items-center justify-between mb-5 text-sm">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 rounded-full peer-checked:bg-blue-500 transition"></div>
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5"></div>
          </div>
          <span className="text-slate-700 dark:text-slate-300 font-medium">Recurring</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={buyWithEUR}
              onChange={(e) => setBuyWithEUR(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 rounded-full peer-checked:bg-blue-500 transition"></div>
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5"></div>
          </div>
          <span className="text-slate-700 dark:text-slate-300 font-medium">Buy with EUR</span>
        </label>
      </div>
      
      {/* Available Balance Breakdown */}
      <div className="mb-5 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Available Balance</div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">USD Balance:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">{baseCurrency} Holdings:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {currentHolding.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} {baseCurrency}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
            <span className="text-slate-600 dark:text-slate-400">Total Value:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {(usdBalance + (currentHolding * currentPrice)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </span>
          </div>
        </div>
      </div>
      
      {/* Order Form */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
        {/* Stop Price (only for stop-limit) */}
        {orderType === 'stop-limit' && (
          <div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
              Stop Price
            </label>
            <div className="relative">
              <input
                type="number"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                placeholder={currentPrice > 0 ? currentPrice.toFixed(2) : '0.00'}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
              />
              <span className="absolute right-4 top-2.5 text-sm text-slate-400 font-medium">{quoteCurrency}</span>
            </div>
          </div>
        )}
        
        {/* Price (not shown for market orders) */}
        {orderType !== 'market' && (
          <div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
              Price
            </label>
            <div className="relative">
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={currentPrice > 0 ? currentPrice.toFixed(2) : '0.00'}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
              />
              <span className="absolute right-4 top-2.5 text-sm text-slate-400 font-medium">{quoteCurrency}</span>
            </div>
          </div>
        )}
        
        {/* Amount */}
        <div>
          <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Amount
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.000000"
              className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
            />
            <span className="absolute right-4 top-2.5 text-sm text-slate-400 font-medium">{baseCurrency}</span>
          </div>
        </div>
        
        {/* Percentage Slider */}
        <div>
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Quick Amount</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{percentage}%</span>
          </div>
          <div className="flex gap-2.5">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => calculateAmountFromPercentage(pct)}
                className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition ${
                  percentage === pct
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
        
        {/* TP/SL Toggle */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">TP/SL</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={enableTPSL}
                onChange={(e) => setEnableTPSL(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer-checked:bg-blue-500 transition"></div>
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-5"></div>
            </div>
          </label>
        </div>
        
        {/* TP/SL Advanced Options */}
        {enableTPSL && (
          <div className="space-y-3 p-2.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
            {/* Take Profit */}
            <div>
              <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">Take Profit</div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">TP Trigger</label>
                    <input
                      type="number"
                      value={tpTrigger}
                      onChange={(e) => setTpTrigger(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">TP Limit</label>
                    <input
                      type="number"
                      value={tpLimit}
                      onChange={(e) => setTpLimit(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 dark:text-slate-400">Offset:</label>
                  <input
                    type="number"
                    value={tpOffset}
                    onChange={(e) => setTpOffset(e.target.value)}
                    placeholder="0"
                    className="flex-1 px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                  <button className="px-2 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition">
                    %
                  </button>
                </div>
              </div>
            </div>
            
            {/* Stop Loss */}
            <div>
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">Stop Loss</div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">SL Trigger</label>
                    <input
                      type="number"
                      value={slTrigger}
                      onChange={(e) => setSlTrigger(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">SL Limit</label>
                    <input
                      type="number"
                      value={slLimit}
                      onChange={(e) => setSlLimit(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 dark:text-slate-400">Offset:</label>
                  <input
                    type="number"
                    value={slOffset}
                    onChange={(e) => setSlOffset(e.target.value)}
                    placeholder="0"
                    className="flex-1 px-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <button className="px-2 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition">
                    %
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Total & Fee */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Fee ({feeLevel}%)</span>
            <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {getFeeAmount().toFixed(2)} <span className="text-xs text-slate-500 dark:text-slate-400">{quoteCurrency}</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total (incl. fee)</span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {getTotal()} <span className="text-sm text-slate-500 dark:text-slate-400">{quoteCurrency}</span>
            </span>
          </div>
        </div>
        
        {/* Trading Info Block - Lots, Margin, Pip Value */}
        <div className="p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-lg border border-blue-200 dark:border-slate-700">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-slate-600 dark:text-slate-400 mb-1.5 font-medium">Lots</div>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-base">
                {lots.toFixed(2)}
              </div>
            </div>
            <div className="text-center border-x border-blue-200 dark:border-slate-700">
              <div className="text-slate-600 dark:text-slate-400 mb-1.5 font-medium">Margin</div>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-base">
                ${margin.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-slate-600 dark:text-slate-400 mb-1.5 font-medium">Pip Value</div>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-base">
                ${pipValue.toFixed(4)}
              </div>
            </div>
          </div>
        </div>
        
        {/* Buy/Sell Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => handleOrder('buy')}
            className="px-4 py-3 text-base font-bold bg-green-500 hover:bg-green-600 text-white rounded-lg transition shadow-sm"
          >
            Buy {baseCurrency}
          </button>
          <button
            onClick={() => handleOrder('sell')}
            className="px-4 py-3 text-base font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition shadow-sm"
          >
            Sell {baseCurrency}
          </button>
        </div>
      </div>
      
      {/* Pending Orders Section */}
      {pendingOrders.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Pending Orders ({pendingOrders.length})
            </h4>
            <button
              onClick={() => setPendingOrders([])}
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
            >
              Cancel All
            </button>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {pendingOrders.map((order) => {
              const fee = order.price * order.amount * (feeLevel / 100);
              const totalWithFee = order.price * order.amount + fee;
              return (
                <div
                  key={order.id}
                  className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        order.side === 'buy' 
                          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                      }`}>
                        {order.side.toUpperCase()}
                      </span>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {order.symbol}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                        {order.type}
                      </span>
                    </div>
                    <button
                      onClick={() => cancelPendingOrder(order.id)}
                      className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {order.stopPrice && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Stop:</span>
                        <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300">
                          ${order.stopPrice.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Price:</span>
                      <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300">
                        ${order.price.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Amount:</span>
                      <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300">
                        {order.amount.toFixed(6)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Fee ({feeLevel}%):</span>
                      <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300">
                        ${fee.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Total (incl. fee):</span>
                      <span className="ml-1 font-semibold text-blue-700 dark:text-blue-300">
                        ${totalWithFee.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  )
}

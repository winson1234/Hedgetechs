import React, { useState } from 'react'
import LivePriceDisplay from './components/LivePriceDisplay'
import ChartComponent from './components/ChartComponent'
import TradingPanel from './components/TradingPanel'
import InstrumentsPanel from './components/InstrumentsPanel'
import NewsPanel from './components/NewsPanel'
import Header from './components/Header'
import OrderBookPanel from './components/OrderBookPanel'
import LeftToolbar from './components/LeftToolbar'
import AnalyticsPanel from './components/AnalyticsPanel'

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [activeTimeframe, setActiveTimeframe] = useState('1h')
  const [showCustomInterval, setShowCustomInterval] = useState(false)
  const [customInterval, setCustomInterval] = useState('')
  const [activeInstrument, setActiveInstrument] = useState('BTCUSDT')
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  
  // Balance and Holdings Management
  const [usdBalance, setUsdBalance] = useState(10000)
  const [cryptoHoldings, setCryptoHoldings] = useState<Record<string, number>>({
    BTC: 10,
    ETH: 10,
    SOL: 10,
    EUR: 10
  })

  // Persist balance and holdings to localStorage
  React.useEffect(() => {
    try {
      const savedBalance = localStorage.getItem('usdBalance')
      const savedHoldings = localStorage.getItem('cryptoHoldings')
      if (savedBalance) setUsdBalance(parseFloat(savedBalance))
      if (savedHoldings) setCryptoHoldings(JSON.parse(savedHoldings))
    } catch (e) {
      // ignore errors reading saved data
    }
  }, [])

  React.useEffect(() => {
    try {
      localStorage.setItem('usdBalance', String(usdBalance))
      localStorage.setItem('cryptoHoldings', JSON.stringify(cryptoHoldings))
    } catch (e) {
      // ignore write errors
    }
  }, [usdBalance, cryptoHoldings])

  // Handle deposit
  const handleDeposit = (amount: number) => {
    setUsdBalance(prev => prev + amount)
  }

  // Handle buy order
  const handleBuyOrder = (symbol: string, amount: number, price: number) => {
    const total = amount * price
    if (total > usdBalance) {
      return { success: false, message: 'Insufficient balance' }
    }
    
    // Extract base currency from symbol
    const baseCurrency = symbol.replace(/USDT?$/, '')
    
    // Deduct USD and add crypto
    setUsdBalance(prev => prev - total)
    setCryptoHoldings(prev => ({
      ...prev,
      [baseCurrency]: (prev[baseCurrency] || 0) + amount
    }))
    
    return { success: true, message: 'Buy order executed' }
  }

  // Handle sell order
  const handleSellOrder = (symbol: string, amount: number, price: number) => {
    const baseCurrency = symbol.replace(/USDT?$/, '')
    const currentHolding = cryptoHoldings[baseCurrency] || 0
    
    if (amount > currentHolding) {
      return { success: false, message: `Insufficient ${baseCurrency} balance` }
    }
    
    const total = amount * price
    
    // Add USD and deduct crypto
    setUsdBalance(prev => prev + total)
    setCryptoHoldings(prev => ({
      ...prev,
      [baseCurrency]: prev[baseCurrency] - amount
    }))
    
    return { success: true, message: 'Sell order executed' }
  }

  const handleToolSelect = (toolId: string | null) => {
    setActiveTool(toolId)
    if (toolId === 'alpha-vantage') {
      setShowAnalyticsPanel(true)
    } else {
      setShowAnalyticsPanel(false)
    }
  }

  const handleAnalyticsPanelClose = () => {
    setShowAnalyticsPanel(false)
    setActiveTool(null) // Clear the toolbar highlight when panel closes
  }

  const handleCustomIntervalSubmit = () => {
    if (customInterval.trim()) {
      setActiveTimeframe(customInterval.trim())
      setShowCustomInterval(false)
      setCustomInterval('')
    }
  }

  // read persisted preference on mount
  React.useEffect(() => {
    try {
      const v = localStorage.getItem('isDarkMode')
      if (v !== null) setIsDarkMode(v === 'true')
      else {
        const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        setIsDarkMode(Boolean(prefers))
      }
    } catch (e) {
      // ignore errors reading theme preference
    }
  }, [])

  // persist on change
  React.useEffect(() => {
    try { localStorage.setItem('isDarkMode', String(isDarkMode)) } catch (e) {
      // ignore write errors (e.g., blocked storage)
    }
  }, [isDarkMode])

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        {/* Top bar */}
        <Header 
          isDarkMode={isDarkMode} 
          setIsDarkMode={setIsDarkMode}
          usdBalance={usdBalance}
          onDeposit={handleDeposit}
        />

        {/* Left Toolbar */}
        <LeftToolbar onToolSelect={handleToolSelect} activeTool={activeTool} />

        {/* Analytics Panel */}
        <AnalyticsPanel
          isOpen={showAnalyticsPanel}
          onClose={handleAnalyticsPanelClose}
          symbol={activeInstrument}
        />

        {/* Main content area - with left margin for toolbar + gap */}
        <div className="ml-14 px-4 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Left Panel: Chart + Order Book (50% - 2 columns) */}
            <div className="lg:col-span-2">
              {/* Chart panel */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
                {/* Timeframe selector */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Timeframe:</span>
                    <button 
                      onClick={() => setActiveTimeframe('1h')}
                      className={`px-3 py-1.5 text-sm font-medium rounded transition ${
                        activeTimeframe === '1h' 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      1h
                    </button>
                    <button 
                      onClick={() => setActiveTimeframe('4h')}
                      className={`px-3 py-1.5 text-sm font-medium rounded transition ${
                        activeTimeframe === '4h' 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      4h
                    </button>
                    <button 
                      onClick={() => setActiveTimeframe('1d')}
                      className={`px-3 py-1.5 text-sm font-medium rounded transition ${
                        activeTimeframe === '1d' 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      1d
                    </button>
                    
                    {/* Custom interval button/input */}
                    {!showCustomInterval ? (
                      <button 
                        onClick={() => setShowCustomInterval(true)}
                        className="px-3 py-1.5 text-sm font-medium rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition border border-slate-300 dark:border-slate-700"
                      >
                        Custom
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customInterval}
                          onChange={(e) => setCustomInterval(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleCustomIntervalSubmit()}
                          placeholder="e.g., 15m, 1w"
                          className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-24"
                          autoFocus
                        />
                        <button
                          onClick={handleCustomIntervalSubmit}
                          className="px-2 py-1 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 transition"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => {
                            setShowCustomInterval(false)
                            setCustomInterval('')
                          }}
                          className="px-2 py-1 text-xs font-medium rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                    <button className="hover:text-slate-700 dark:hover:text-slate-200 transition">Indicators</button>
                    <button className="hover:text-slate-700 dark:hover:text-slate-200 transition">Compare</button>
                  </div>
                </div>

                {/* Live price display */}
                <div className="mb-5">
                  <LivePriceDisplay symbol={activeInstrument} />
                </div>

                {/* Chart */}
                <div className="h-[566px]">
                  <ChartComponent timeframe={activeTimeframe} symbol={activeInstrument} />
                </div>
              </div>

              {/* Order Book Panel */}
              <div className="mt-4 h-[440px]">
                <OrderBookPanel activeInstrument={activeInstrument} />
              </div>
            </div>

            {/* Middle Panel: Spot Trading (25% - 1 column) */}
            <div className="lg:col-span-1">
              <div className="h-[1300px]">
                <TradingPanel 
                  activeInstrument={activeInstrument}
                  usdBalance={usdBalance}
                  cryptoHoldings={cryptoHoldings}
                  onBuyOrder={handleBuyOrder}
                  onSellOrder={handleSellOrder}
                />
              </div>
            </div>

            {/* Right Panel: Instruments + News (25% - 1 column) */}
            <div className="lg:col-span-1 space-y-4">
              {/* Instruments panel */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 h-[735px] overflow-y-auto">
                <InstrumentsPanel 
                  activeInstrument={activeInstrument}
                  onInstrumentChange={setActiveInstrument}
                />
              </div>

              {/* News panel */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 h-[549px]">
                <NewsPanel />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

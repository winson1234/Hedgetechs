import React, { useState } from 'react'
import LivePriceDisplay from './components/LivePriceDisplay'
import ChartComponent from './components/ChartComponent'
import SpotTradingPanel from './components/SpotTradingPanel'
import InstrumentsPanel from './components/InstrumentsPanel'
import NewsPanel from './components/NewsPanel'
import Header from './components/Header'
import OrderBookPanel from './components/OrderBookPanel'

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [activeTimeframe, setActiveTimeframe] = useState('1h')
  const [showCustomInterval, setShowCustomInterval] = useState(false)
  const [customInterval, setCustomInterval] = useState('')
  const [activeInstrument, setActiveInstrument] = useState('BTCUSDT')

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
        <Header isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />

        {/* Main content area - full width with internal padding */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left + Center: Chart area (2 columns) */}
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

                {/* Chart - Market standard 60% of left column */}
                <div className="h-[550px]">
                  <ChartComponent timeframe={activeTimeframe} symbol={activeInstrument} />
                </div>
              </div>

              {/* Order Book Panel - Market standard 40% of left column */}
              <div className="mt-4 h-[440px]">
                <OrderBookPanel activeInstrument={activeInstrument} />
              </div>
            </div>

            {/* Right: side panels (1 column) - Optimized for full space utilization */}
            <div className="space-y-4">
              {/* Spot Trading panel - Binance-style with tabs */}
              <div className="h-[480px]">
                <SpotTradingPanel activeInstrument={activeInstrument} />
              </div>

              {/* Instruments panel - Compact */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 h-[250px] overflow-y-auto">
                <InstrumentsPanel 
                  activeInstrument={activeInstrument}
                  onInstrumentChange={setActiveInstrument}
                />
              </div>

              {/* News panel - Expanded to fill remaining space */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 h-[510px]">
                <NewsPanel />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

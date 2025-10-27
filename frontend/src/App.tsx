import React, { useState } from 'react'
import LivePriceDisplay from './components/LivePriceDisplay'
import ChartComponent from './components/ChartComponent'
import TradePanel from './components/TradePanel'
import InstrumentsPanel from './components/InstrumentsPanel'
import NewsPanel from './components/NewsPanel'
import Header from './components/Header'

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true)

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
      <div className="min-h-screen bg-slate-900 text-slate-200 p-4">
      {/* Top bar */}
      <Header isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />

      {/* Main content area */}
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Chart and toolbar */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-lg ring-1 ring-inset ring-slate-700 dark:ring-slate-700 shadow-sm p-4 text-slate-900 dark:text-slate-200">
          {/* Chart toolbar placeholder */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">Timeframe:</div>
              <div className="bg-gray-100 px-2 py-1 rounded text-sm">1h</div>
              <div className="bg-gray-100 px-2 py-1 rounded text-sm">4h</div>
              <div className="bg-gray-100 px-2 py-1 rounded text-sm">1d</div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div>Indicators</div>
              <div>Compare</div>
            </div>
          </div>

          {/* Live price + chart */}
          <div className="mb-4">
            <LivePriceDisplay />
          </div>
          <div className="h-[480px]">
            <ChartComponent />
          </div>
        </div>

        {/* Right: side panels */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg ring-1 ring-inset ring-slate-700 shadow-sm p-4 text-slate-900 dark:text-slate-200">
            <TradePanel />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg ring-1 ring-inset ring-slate-700 shadow-sm p-4 text-slate-900 dark:text-slate-200">
            <InstrumentsPanel />
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg ring-1 ring-inset ring-slate-700 shadow-sm p-4 text-slate-900 dark:text-slate-200">
            <NewsPanel />
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}

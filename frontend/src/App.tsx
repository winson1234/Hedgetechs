import React from 'react'
import LivePriceDisplay from './components/LivePriceDisplay'
import ChartComponent from './components/ChartComponent'
import TradePanel from './components/TradePanel'
import InstrumentsPanel from './components/InstrumentsPanel'
import NewsPanel from './components/NewsPanel'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Top bar */}
      <div className="max-w-[1200px] mx-auto mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Brokerage Market Data (Dev)</h1>
            <div className="text-sm text-gray-600">Prototype dashboard</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-700">Balance: <span className="font-medium">0.00 USD</span></div>
            <button className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm">Deposit</button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Chart and toolbar */}
        <div className="lg:col-span-8 bg-white rounded-md shadow p-4">
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
          <div className="bg-white rounded-md shadow p-3">
            <TradePanel />
          </div>
          <div className="bg-white rounded-md shadow p-3">
            <InstrumentsPanel />
          </div>
          <div className="bg-white rounded-md shadow p-3">
            <NewsPanel />
          </div>
        </div>
      </div>
    </div>
  )
}

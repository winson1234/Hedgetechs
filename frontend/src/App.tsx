import React from 'react'
import LivePriceDisplay from './components/LivePriceDisplay'
import ChartComponent from './components/ChartComponent'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Brokerage Market Data (Dev)</h1>
        <div className="mb-6">
          <LivePriceDisplay />
        </div>
        <div>
          <ChartComponent />
        </div>
      </div>
    </div>
  )
}

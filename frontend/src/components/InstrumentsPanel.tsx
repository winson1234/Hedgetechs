import React, { useState } from 'react'

const instruments = [
  { symbol: 'BTC/USD', price: 115229.51, change: 1.14 },
  { symbol: 'ETH/USD', price: 2845.32, change: -0.87 },
  { symbol: 'SOL/USD', price: 189.45, change: 3.21 },
  { symbol: 'EUR/USD', price: 1.0842, change: -0.12 }
]

export default function InstrumentsPanel() {
  const [activeInstrument, setActiveInstrument] = useState('BTC/USD')

  return (
    <div>
      <div className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Instruments</div>
      <ul className="space-y-1">
        {instruments.map((item) => {
          const isActive = activeInstrument === item.symbol
          const isPositive = item.change >= 0
          
          return (
            <li 
              key={item.symbol}
              onClick={() => setActiveInstrument(item.symbol)}
              className={`py-3 px-3 rounded-lg cursor-pointer transition-all ${
                isActive 
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800' 
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${
                  isActive ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {item.symbol}
                </span>
                <span className={`text-xs font-bold ${
                  isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
                }`}>
                  {isPositive ? '+' : ''}{item.change.toFixed(2)}%
                </span>
              </div>
              <div className={`text-xs mt-1 ${
                isActive ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
              }`}>
                ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

import React from 'react'

export default function TradePanel() {
  return (
    <div className="space-y-3">
      <div className="text-lg font-bold text-slate-900 dark:text-slate-100">Trade</div>
      
      <div className="text-xs text-slate-500 dark:text-slate-400">Order form placeholder</div>
      
      <div className="flex gap-2">
        <button className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-bold text-sm transition">
          Buy
        </button>
        <button className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-bold text-sm transition">
          Sell
        </button>
      </div>
      
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
        Balance: 0.00 USD
      </div>
    </div>
  )
}

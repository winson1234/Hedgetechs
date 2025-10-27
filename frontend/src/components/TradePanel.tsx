import React from 'react'

export default function TradePanel() {
  return (
    <div className="space-y-4">
      <div className="text-xl font-bold text-slate-900 dark:text-slate-100">Trade</div>
      
      <div className="text-sm text-slate-500 dark:text-slate-400">Order form placeholder</div>
      
      <div className="flex gap-3 mt-5">
        <button className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-sm transition shadow-sm hover:shadow">
          Buy
        </button>
        <button className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold text-sm transition shadow-sm hover:shadow">
          Sell
        </button>
      </div>
      
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 pt-3 mt-3 border-t border-slate-200 dark:border-slate-800">
        Balance: 0.00 USD
      </div>
    </div>
  )
}

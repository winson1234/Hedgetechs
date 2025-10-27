import React from 'react'

export default function TradePanel() {
  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold text-slate-100">Trade</div>
      <div className="text-sm text-slate-400">Order form placeholder</div>
      <div className="flex gap-2">
        <button className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-md font-semibold transition">Buy</button>
        <button className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-md font-semibold transition">Sell</button>
      </div>
      <div className="text-xs text-slate-400">Balance: 0.00 USD</div>
    </div>
  )
}

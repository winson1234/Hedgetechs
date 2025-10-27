import React from 'react'

export default function TradePanel() {
  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold">Trade</div>
      <div className="text-sm text-gray-600">Order form placeholder</div>
      <div className="flex gap-2">
        <button className="flex-1 bg-green-500 text-white py-2 rounded">Buy</button>
        <button className="flex-1 bg-red-500 text-white py-2 rounded">Sell</button>
      </div>
      <div className="text-xs text-gray-500">Balance: 0.00 USD</div>
    </div>
  )
}

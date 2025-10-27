import React from 'react'

const instruments = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'EUR/USD']

export default function InstrumentsPanel() {
  return (
    <div>
      <div className="text-lg font-semibold mb-2">Instruments</div>
      <ul className="space-y-1 text-sm">
        {instruments.map((s) => (
          <li key={s} className="py-1 px-2 rounded hover:bg-gray-50">{s}</li>
        ))}
      </ul>
    </div>
  )
}

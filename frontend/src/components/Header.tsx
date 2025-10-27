import React from 'react'

type Props = {
  isDarkMode: boolean
  setIsDarkMode: (v: boolean) => void
}

export default function Header({ isDarkMode, setIsDarkMode }: Props) {
  return (
    <header className="max-w-[1200px] mx-auto mb-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-100">Brokerage Market Data (Dev)</div>
          <div className="text-sm text-slate-400">REAL #1812761287</div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-200">Balance: <span className="font-medium">10,000.00 USD</span></div>
          <button className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded-md text-sm transition">Deposit</button>

          <button
            className="px-2 py-1 border border-slate-700 rounded text-sm bg-slate-700 text-slate-100 hover:bg-slate-600 transition"
            onClick={() => setIsDarkMode(!isDarkMode)}
          >
            Toggle Theme
          </button>

          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="px-2 py-1 border border-slate-700 rounded">P</div>
            <div className="px-2 py-1 border border-slate-700 rounded">S</div>
          </div>
        </div>
      </div>
    </header>
  )
}

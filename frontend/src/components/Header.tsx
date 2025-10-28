import React from 'react'

type Props = {
  isDarkMode: boolean
  setIsDarkMode: (v: boolean) => void
}

export default function Header({ isDarkMode, setIsDarkMode }: Props) {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Brokerage Market Data</div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            Balance: <span className="font-semibold">10,000.00 USD</span>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded text-sm font-medium transition">
            Deposit
          </button>

          <button
            className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            onClick={() => setIsDarkMode(!isDarkMode)}
          >
            Toggle Theme
          </button>

          <div className="flex items-center gap-2 text-sm">
            <button className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              P
            </button>
            <button className="px-2 py-1 border border-slate-300 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              S
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

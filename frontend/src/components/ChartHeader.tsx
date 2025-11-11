import { useState } from 'react'

interface ChartHeaderProps {
  activeTimeframe: string
  onTimeframeChange: (timeframe: string) => void
  onAnalyticsClick?: () => void
  onClearDrawings?: () => void
}

export default function ChartHeader({ 
  activeTimeframe, 
  onTimeframeChange, 
  onAnalyticsClick, 
  onClearDrawings 
}: ChartHeaderProps) {
  const [showCustomInterval, setShowCustomInterval] = useState(false)
  const [customInterval, setCustomInterval] = useState('')

  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w']

  const handleTimeframeClick = (timeframe: string) => {
    if (timeframe === 'Custom') {
      setShowCustomInterval(!showCustomInterval)
      if (!showCustomInterval) {
        onTimeframeChange('Custom')
      }
    } else {
      onTimeframeChange(timeframe)
      setShowCustomInterval(false)
    }
  }

  const handleCustomIntervalSubmit = () => {
    if (customInterval.trim()) {
      onTimeframeChange(customInterval.trim())
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
      {/* Timeframe buttons */}
      <div className="flex flex-wrap items-center gap-1">
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => handleTimeframeClick(tf)}
            className={`px-2.5 py-1.5 text-xs sm:text-sm font-medium rounded transition-colors ${
              activeTimeframe === tf && !showCustomInterval
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {tf}
          </button>
        ))}
        <button
          onClick={() => handleTimeframeClick('Custom')}
          className={`px-2.5 py-1.5 text-xs sm:text-sm font-medium rounded transition-colors ${
            showCustomInterval
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Custom
        </button>
      </div>

      {/* Custom interval input */}
      {showCustomInterval && (
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={customInterval}
            onChange={(e) => setCustomInterval(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCustomIntervalSubmit()
              }
            }}
            placeholder="e.g., 2h, 3d, 1w"
            className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCustomIntervalSubmit}
            className="px-3 py-1.5 text-xs sm:text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            Apply
          </button>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1 hidden sm:block" />

      {/* Action buttons group */}
      <div className="flex flex-wrap items-center gap-1 w-full sm:w-auto">
        <button
          onClick={onAnalyticsClick}
          className="px-2.5 py-1.5 text-xs sm:text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
          title="Analytics"
        >
          Analytics
        </button>
        <button
          onClick={onClearDrawings}
          className="px-2.5 py-1.5 text-xs sm:text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded transition-colors"
          title="Clear all drawings"
        >
          Clear Drawings
        </button>
        <button
          className="px-2.5 py-1.5 text-xs sm:text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded cursor-not-allowed"
          title="Indicators (Coming Soon)"
          disabled
        >
          Indicators
        </button>
        <button
          className="px-2.5 py-1.5 text-xs sm:text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded cursor-not-allowed"
          title="Compare (Coming Soon)"
          disabled
        >
          Compare
        </button>
      </div>
    </div>
  )
}

import React from 'react'
import { useUIStore } from '../stores/uiStore'

export default function LeftToolbar() {
  const activeTool = useUIStore(state => state.activeTool)
  const setActiveTool = useUIStore(state => state.setActiveTool)

  const handleToolClick = (toolId: string) => {
    // Toggle tool - if already active, deactivate it
    const newActiveTool = activeTool === toolId ? null : toolId
    setActiveTool(newActiveTool)
  }

  return (
    <div className="fixed left-0 top-[60px] z-40 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm w-14 h-[calc(100vh-60px)]">
      {/* Alpha Vantage Tool */}
      <button
        onClick={() => handleToolClick('alpha-vantage')}
        className={`w-full h-14 flex items-center justify-center border-b border-slate-200 dark:border-slate-800 transition-colors flex-shrink-0 ${
          activeTool === 'alpha-vantage'
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
        title="Alpha Vantage"
        aria-label="Alpha Vantage tool"
      >
        {/* Alpha Vantage Icon - SVG from public folder */}
        <img 
          src="/icons/alphaVantage.svg" 
          alt="Alpha Vantage" 
          className="w-6 h-6 object-contain"
        />
      </button>

      {/* Future tools will be added here */}
    </div>
  )
}

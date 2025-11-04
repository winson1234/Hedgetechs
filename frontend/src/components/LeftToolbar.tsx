import React from 'react'
import { useUIStore } from '../stores/uiStore'

export default function LeftToolbar() {
  const activeDrawingTool = useUIStore(state => state.activeDrawingTool)
  const setActiveDrawingTool = useUIStore(state => state.setActiveDrawingTool)
  const navigateTo = useUIStore(state => state.navigateTo)

  const handleToolClick = (toolId: string) => {
    // Toggle tool - if already active, deactivate it
    const newActiveTool = activeDrawingTool === toolId ? null : toolId
    setActiveDrawingTool(newActiveTool)
  }

  const drawingTools = [
    {
      id: 'trendline',
      name: 'Trendline',
      disabled: true,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="4" y1="20" x2="20" y2="4" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'horizontal-line',
      name: 'Horizontal Line',
      disabled: false,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="4" y1="12" x2="20" y2="12" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'vertical-line',
      name: 'Vertical Line',
      disabled: true,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="12" y1="4" x2="12" y2="20" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'rectangle',
      name: 'Rectangle',
      disabled: true,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="5" y="7" width="14" height="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      id: 'text-annotation',
      name: 'Text Annotation',
      disabled: true,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M4 7h16M9 20V7M15 20V7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
  ]

  return (
    <div className="fixed left-0 top-[60px] z-40 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm w-14 h-[calc(100vh-60px)]">
      {/* Dashboard/Home Button */}
      <button
        onClick={() => navigateTo('dashboard')}
        className="w-full h-14 flex items-center justify-center border-b border-slate-200 dark:border-slate-800 transition-colors flex-shrink-0 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
        title="Dashboard"
        aria-label="Go to Dashboard"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </button>
      
      {/* Drawing Tools */}
      {drawingTools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => !tool.disabled && handleToolClick(tool.id)}
          disabled={tool.disabled}
          className={`w-full h-14 flex items-center justify-center border-b border-slate-200 dark:border-slate-800 transition-colors flex-shrink-0 ${
            tool.disabled
              ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-50'
              : activeDrawingTool === tool.id
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title={tool.disabled ? `${tool.name} (Coming in v2)` : tool.name}
          aria-label={`${tool.name} tool`}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  )
}

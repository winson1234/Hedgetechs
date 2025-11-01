import React from 'react'
import { useUIStore } from '../stores/uiStore'

export default function LeftToolbar() {
  const activeDrawingTool = useUIStore(state => state.activeDrawingTool)
  const setActiveDrawingTool = useUIStore(state => state.setActiveDrawingTool)

  const handleToolClick = (toolId: string) => {
    // Toggle tool - if already active, deactivate it
    const newActiveTool = activeDrawingTool === toolId ? null : toolId
    setActiveDrawingTool(newActiveTool)
  }

  const drawingTools = [
    {
      id: 'trendline',
      name: 'Trendline',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="4" y1="20" x2="20" y2="4" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'horizontal-line',
      name: 'Horizontal Line',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="4" y1="12" x2="20" y2="12" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'vertical-line',
      name: 'Vertical Line',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="12" y1="4" x2="12" y2="20" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'rectangle',
      name: 'Rectangle',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="5" y="7" width="14" height="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      id: 'text-annotation',
      name: 'Text Annotation',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M4 7h16M9 20V7M15 20V7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
  ]

  return (
    <div className="fixed left-0 top-[60px] z-40 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm w-14 h-[calc(100vh-60px)]">
      {/* Drawing Tools */}
      {drawingTools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => handleToolClick(tool.id)}
          className={`w-full h-14 flex items-center justify-center border-b border-slate-200 dark:border-slate-800 transition-colors flex-shrink-0 ${
            activeDrawingTool === tool.id
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title={tool.name}
          aria-label={`${tool.name} tool`}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  )
}

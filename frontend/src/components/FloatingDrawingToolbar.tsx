import { useState } from 'react';
import { useUIStore } from '../stores/uiStore';

export default function FloatingDrawingToolbar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const activeDrawingTool = useUIStore(state => state.activeDrawingTool);
  const setActiveDrawingTool = useUIStore(state => state.setActiveDrawingTool);

  const handleToolClick = (toolId: string) => {
    // Toggle tool - if already active, deactivate it
    const newActiveTool = activeDrawingTool === toolId ? null : toolId;
    setActiveDrawingTool(newActiveTool);
  };

  const drawingTools = [
    {
      id: 'trendline',
      name: 'Trendline',
      disabled: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="4" y1="20" x2="20" y2="4" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'horizontal-line',
      name: 'Horizontal Line',
      disabled: false,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="4" y1="12" x2="20" y2="12" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'vertical-line',
      name: 'Vertical Line',
      disabled: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="12" y1="4" x2="12" y2="20" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'rectangle',
      name: 'Rectangle',
      disabled: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="5" y="7" width="14" height="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      id: 'text-annotation',
      name: 'Text Annotation',
      disabled: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M4 7h16M9 20V7M15 20V7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
  ];

  return (
    <div className="absolute bottom-9 left-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
      {/* Toolbar Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Tools
        </span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isExpanded ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            )}
          </svg>
        </button>
      </div>

      {/* Drawing Tools - Vertical Layout */}
      {isExpanded && (
        <div className="flex flex-col gap-1 px-2 pb-2 border-t border-slate-200 dark:border-slate-700 pt-2">
          {drawingTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => !tool.disabled && handleToolClick(tool.id)}
              disabled={tool.disabled}
              className={`relative h-9 w-9 flex items-center justify-center rounded transition-all ${
                tool.disabled
                  ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-40'
                  : activeDrawingTool === tool.id
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title={tool.disabled ? `${tool.name} (Coming in v2)` : tool.name}
              aria-label={`${tool.name} tool`}
            >
              {tool.icon}
              {/* Active indicator dot */}
              {activeDrawingTool === tool.id && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full"></span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

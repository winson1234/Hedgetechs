import { useState } from 'react';
import { useUIStore } from '../stores/uiStore';
import type { LineStyle } from '../types';

export default function FloatingDrawingToolbar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLineWidth, setShowLineWidth] = useState(false);
  const [showLineStyle, setShowLineStyle] = useState(false);

  const activeDrawingTool = useUIStore(state => state.activeDrawingTool);
  const setActiveDrawingTool = useUIStore(state => state.setActiveDrawingTool);
  const activeDrawingColor = useUIStore(state => state.activeDrawingColor);
  const setActiveDrawingColor = useUIStore(state => state.setActiveDrawingColor);
  const activeLineWidth = useUIStore(state => state.activeLineWidth);
  const setActiveLineWidth = useUIStore(state => state.setActiveLineWidth);
  const activeLineStyle = useUIStore(state => state.activeLineStyle);
  const setActiveLineStyle = useUIStore(state => state.setActiveLineStyle);

  const handleToolClick = (toolId: string) => {
    // Toggle tool - if already active, deactivate it
    const newActiveTool = activeDrawingTool === toolId ? null : toolId;
    setActiveDrawingTool(newActiveTool);
  };

  const colors = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Green', value: '#10b981' },
    { name: 'Yellow', value: '#f59e0b' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Orange', value: '#f97316' },
    { name: 'White', value: '#ffffff' },
    { name: 'Gray', value: '#6b7280' }
  ];

  const lineWidths = [1, 2, 3, 4];
  const lineStyles: { name: string; value: LineStyle }[] = [
    { name: 'Solid', value: 'solid' },
    { name: 'Dashed', value: 'dashed' },
    { name: 'Dotted', value: 'dotted' }
  ];

  const drawingTools = [
    {
      id: 'trendline',
      name: 'Trendline',
      disabled: false,
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
      disabled: false,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="12" y1="4" x2="12" y2="20" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'rectangle',
      name: 'Rectangle',
      disabled: false,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="5" y="7" width="14" height="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      id: 'text',
      name: 'Text Annotation',
      disabled: false,
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
        <>
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
                title={tool.name}
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

          {/* Drawing Settings */}
          <div className="border-t border-slate-200 dark:border-slate-700 px-2 py-2 space-y-2">
            {/* Color Picker */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowLineWidth(false);
                  setShowLineStyle(false);
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
              >
                <span>Color</span>
                <div
                  className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600"
                  style={{ backgroundColor: activeDrawingColor }}
                />
              </button>
              {showColorPicker && (
                <div className="absolute left-full ml-2 bottom-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 grid grid-cols-4 gap-1.5 w-36">
                  {colors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => {
                        setActiveDrawingColor(color.value);
                        setShowColorPicker(false);
                      }}
                      className={`w-7 h-7 rounded border-2 transition ${
                        activeDrawingColor === color.value
                          ? 'border-blue-500 scale-110'
                          : 'border-slate-300 dark:border-slate-600 hover:scale-110'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Line Width */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowLineWidth(!showLineWidth);
                  setShowColorPicker(false);
                  setShowLineStyle(false);
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
              >
                <span>Width</span>
                <span className="text-slate-500 dark:text-slate-400">{activeLineWidth}px</span>
              </button>
              {showLineWidth && (
                <div className="absolute left-full ml-2 bottom-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 space-y-1">
                  {lineWidths.map((width) => (
                    <button
                      key={width}
                      onClick={() => {
                        setActiveLineWidth(width);
                        setShowLineWidth(false);
                      }}
                      className={`w-full px-3 py-1.5 text-xs rounded flex items-center justify-between transition ${
                        activeLineWidth === width
                          ? 'bg-blue-500 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{width}px</span>
                      <div style={{ height: `${width}px` }} className="w-8 bg-current rounded" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Line Style */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowLineStyle(!showLineStyle);
                  setShowColorPicker(false);
                  setShowLineWidth(false);
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
              >
                <span>Style</span>
                <span className="text-slate-500 dark:text-slate-400 capitalize">{activeLineStyle}</span>
              </button>
              {showLineStyle && (
                <div className="absolute left-full ml-2 bottom-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 space-y-1">
                  {lineStyles.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => {
                        setActiveLineStyle(style.value);
                        setShowLineStyle(false);
                      }}
                      className={`w-full px-3 py-2 text-xs rounded flex items-center justify-between transition ${
                        activeLineStyle === style.value
                          ? 'bg-blue-500 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{style.name}</span>
                      <svg className="w-8 h-0.5 ml-2" viewBox="0 0 32 2">
                        <line
                          x1="0"
                          y1="1"
                          x2="32"
                          y2="1"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeDasharray={style.value === 'dashed' ? '4 2' : style.value === 'dotted' ? '1 2' : '0'}
                        />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

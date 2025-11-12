import React, { useEffect, useRef, useContext, useState, useCallback } from 'react'
import { createChart, IChartApi, ISeriesApi, UTCTimestamp, CandlestickData, IPriceLine, MouseEventParams, Time } from 'lightweight-charts'
import { WebSocketContext } from '../context/WebSocketContext'
import type { PriceMessage } from '../hooks/useWebSocket'
import { useAppDispatch, useAppSelector } from '../store'
import { setShowAnalyticsPanel } from '../store/slices/uiSlice'
import ChartHeader from './ChartHeader'
import FloatingDrawingToolbar from './FloatingDrawingToolbar'
import TextInputModal from './TextInputModal'
import { getApiUrl } from '../config/api'
import type { Drawing } from '../types'

type Kline = {
  openTime: number
  open: string
  high: string
  low: string
  close: string
  volume: string
}

type OHLCVData = {
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export default function ChartComponent() {
  const dispatch = useAppDispatch();
  // Access Redux state
  const symbol = useAppSelector(state => state.ui.activeInstrument);
  
  // Local state for chart-specific features
  const [timeframe, setTimeframe] = useState('1h');
  const [activeDrawingTool, setActiveDrawingTool] = useState<Drawing['type'] | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawingState, setDrawingState] = useState<{ type: 'trendline' | 'rectangle'; point1: { time: number; price: number } } | null>(null);
  const [activeDrawingColor, setActiveDrawingColor] = useState('#3b82f6');
  const [activeLineWidth, setActiveLineWidth] = useState(2);
  const [activeLineStyle, setActiveLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  
  // Helper functions for drawing management
  const addDrawing = useCallback((drawing: Drawing) => {
    setDrawings(prev => [...prev, drawing]);
  }, []);
  
  const removeDrawing = useCallback((id: string) => {
    setDrawings(prev => prev.filter(d => d.id !== id));
  }, []);

  const ref = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastBarRef = useRef<{ time: UTCTimestamp; open: number; high: number; low: number; close: number } | null>(null)
  const priceLineRef = useRef<IPriceLine | null>(null)
  const [ohlcv, setOhlcv] = useState<OHLCVData | null>(null)
  const volumeDataRef = useRef<Map<number, number>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const loadingTimeoutRef = useRef<number | null>(null)

  // Text annotation modal state
  const [showTextModal, setShowTextModal] = useState(false)
  const [textModalPosition, setTextModalPosition] = useState<{ time: number; price: number } | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; drawingId: string } | null>(null)
  
  // Map timeframe to seconds for candle grouping
  const getTimeframeSeconds = (tf: string): number => {
    const timeframeSecondsMap: Record<string, number> = {
      '1m': 60,
      '3m': 180,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '6h': 21600,
      '8h': 28800,
      '12h': 43200,
      '1d': 86400,
      '3d': 259200,
      '1w': 604800,
      '1M': 2592000
    }
    return timeframeSecondsMap[tf] || 3600 // default to 1h if not found
  }
  const timeframeSeconds = getTimeframeSeconds(timeframe)
  
  const ws = useContext(WebSocketContext)
  const lastMessage = ws?.lastMessage ?? null

  // Helper function to convert LineStyle to lightweight-charts numeric format
  const getNumericLineStyle = (style: string): 0 | 1 | 2 => {
    switch (style) {
      case 'dotted':
        return 1
      case 'dashed':
        return 2
      case 'solid':
      default:
        return 0
    }
  }

  useEffect(() => {
    if (!ref.current) return
    
    // Trigger loading effect when symbol or timeframe changes
    setIsLoading(true)
    
    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }
    
    // Auto-hide after 500ms maximum
    loadingTimeoutRef.current = window.setTimeout(() => {
      setIsLoading(false)
    }, 500)
    
    const isDark = document.documentElement.classList.contains('dark')
    
    chartRef.current = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 500,
      layout: {
        background: { color: 'transparent' },
        textColor: isDark ? '#94a3b8' : '#64748b',
      },
      grid: {
        vertLines: { color: isDark ? '#1e293b' : '#e2e8f0' },
        horzLines: { color: isDark ? '#1e293b' : '#e2e8f0' },
      },
      crosshair: {
        mode: 1,
      },
      timeScale: {
        borderColor: isDark ? '#334155' : '#cbd5e1',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: isDark ? '#334155' : '#cbd5e1',
      },
      localization: {
        locale: 'en-US',
        dateFormat: 'dd MMM',
      },
    })
    
    seriesRef.current = chartRef.current.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })

    const onResize = () => {
      if (chartRef.current && ref.current) {
        chartRef.current.applyOptions({ width: ref.current.clientWidth })
      }
    }
    window.addEventListener('resize', onResize)

    // Fetch klines with dynamic timeframe and symbol
    fetch(getApiUrl(`/api/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=200`))
      .then((r) => r.json())
      .then((data: Kline[]) => {
        // Store volume data
        volumeDataRef.current.clear()
        data.forEach((k) => {
          const time = Math.floor(k.openTime / 1000)
          volumeDataRef.current.set(time, parseFloat(k.volume))
        })
        
        const formatted: CandlestickData<UTCTimestamp>[] = data.map((k) => ({
          time: Math.floor(k.openTime / 1000) as UTCTimestamp,
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close)
        }))
        seriesRef.current?.setData(formatted)
        // remember last bar and set initial OHLCV
        if (formatted.length > 0) {
          const lb = formatted[formatted.length - 1]
          lastBarRef.current = { time: lb.time as UTCTimestamp, open: lb.open, high: lb.high, low: lb.low, close: lb.close }
          // Set initial OHLCV display to last candle
          const volume = volumeDataRef.current.get(lb.time as number) || 0
          setOhlcv({
            open: lb.open,
            high: lb.high,
            low: lb.low,
            close: lb.close,
            volume: volume
          })
        }
      })
      .catch((err) => console.error('Failed to fetch klines:', err))

    return () => {
      window.removeEventListener('resize', onResize)
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
      if (priceLineRef.current && seriesRef.current) {
        try {
          seriesRef.current.removePriceLine(priceLineRef.current)
        } catch (e) {
          // ignore if already disposed
        }
      }
      chartRef.current?.remove()
      chartRef.current = null
      seriesRef.current = null
      priceLineRef.current = null
      lastBarRef.current = null
    }
  }, [timeframe, symbol])

  // live update handler: append/update candles based on ws ticks
  // Filter messages to only process data for the currently selected symbol
  useEffect(() => {
    if (!lastMessage || !seriesRef.current) return
    const msg: PriceMessage = lastMessage
    
    // CRITICAL: Only process WebSocket messages that match the current symbol
    if (msg.symbol !== symbol) {
      return // Ignore messages from other symbols
    }
    
    const price = typeof msg.price === 'string' ? parseFloat(msg.price) : msg.price
    if (Number.isNaN(price) || !price) return

    // Update price line only if we have historical data loaded
    if (lastBarRef.current) {
      if (priceLineRef.current) {
        seriesRef.current.removePriceLine(priceLineRef.current)
      }
      
      // Determine color based on last bar
      const isUp = price >= lastBarRef.current.close
      const lineColor = isUp ? '#10b981' : '#ef4444'
      
      priceLineRef.current = seriesRef.current.createPriceLine({
        price: price,
        color: lineColor,
        lineWidth: 2,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: '',
      })
    }

    // compute candle time (UTCTimestamp in seconds)
    const tickSec = Math.floor(msg.time / 1000)
    const candleTime = (Math.floor(tickSec / timeframeSeconds) * timeframeSeconds) as UTCTimestamp

    const current = lastBarRef.current
    
    // CRITICAL: Prevent updating with older timestamps (causes "Cannot update oldest data" error)
    if (current && candleTime < current.time) {
      // Ignore WebSocket updates that would create candles older than the last known candle
      // This can happen with longer timeframes (1w, 1M) when switching timeframes
      return
    }
    
    if (current && current.time === candleTime) {
      // update existing candle
      const updated: CandlestickData<UTCTimestamp> = {
        time: current.time,
        open: current.open,
        high: Math.max(current.high, price),
        low: Math.min(current.low, price),
        close: price
      }
      // update chart and lastBarRef
      seriesRef.current.update(updated)
      lastBarRef.current = updated
      
      // Update OHLCV display
      const volume = volumeDataRef.current.get(candleTime) || 0
      setOhlcv({
        open: updated.open,
        high: updated.high,
        low: updated.low,
        close: updated.close,
        volume: volume
      })
    } else if (current && candleTime > current.time) {
      // new candle: only create if timestamp is newer than current
      const newBar: CandlestickData<UTCTimestamp> = { time: candleTime, open: price, high: price, low: price, close: price }
      seriesRef.current.update(newBar)
      lastBarRef.current = newBar
      
      // Initialize volume for new candle
      volumeDataRef.current.set(candleTime, 0)
      setOhlcv({
        open: newBar.open,
        high: newBar.high,
        low: newBar.low,
        close: newBar.close,
        volume: 0
      })
    } else if (!current) {
      // Handle case where we don't have any historical data yet
      const newBar: CandlestickData<UTCTimestamp> = { time: candleTime, open: price, high: price, low: price, close: price }
      seriesRef.current.update(newBar)
      lastBarRef.current = newBar
      
      volumeDataRef.current.set(candleTime, 0)
      setOhlcv({
        open: newBar.open,
        high: newBar.high,
        low: newBar.low,
        close: newBar.close,
        volume: 0
      })
    }
  }, [lastMessage, timeframeSeconds, symbol])

  // Helper function to save drawings to localStorage
  const saveDrawingsToLocalStorage = useCallback((drawingsToSave: Drawing[]) => {
    const serializable = drawingsToSave.map(d => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { lineRef, ...rest } = d as Drawing & { lineRef?: IPriceLine }
      return rest
    })
    localStorage.setItem(`chart-drawings-${symbol}`, JSON.stringify(serializable))
  }, [symbol])

  // Load drawings from localStorage when symbol changes
  useEffect(() => {
    if (!seriesRef.current) return

    // Clear existing horizontal line price lines
    drawings.forEach(drawing => {
      if (drawing.type === 'horizontal-line' && drawing.lineRef && seriesRef.current) {
        try {
          seriesRef.current.removePriceLine(drawing.lineRef as IPriceLine)
        } catch (e) {
          // ignore if already disposed
        }
      }
    })

    // Load drawings for the current symbol
    const savedDrawings = localStorage.getItem(`chart-drawings-${symbol}`)
    if (savedDrawings) {
      try {
        const parsedDrawings: Drawing[] = JSON.parse(savedDrawings)

        // Re-create horizontal price lines from saved data
        const drawingsWithRefs = parsedDrawings.map(drawing => {
          if (drawing.type === 'horizontal-line' && seriesRef.current) {
            // Clamp lineWidth to valid range for lightweight-charts (1-4)
            const validLineWidth = Math.min(4, Math.max(1, drawing.lineWidth)) as 1 | 2 | 3 | 4
            const line = seriesRef.current.createPriceLine({
              price: drawing.price,
              color: drawing.color,
              lineWidth: validLineWidth,
              lineStyle: getNumericLineStyle(drawing.lineStyle),
              axisLabelVisible: true,
              title: '',
            })
            return { ...drawing, lineRef: line }
          }
          return drawing
        })

        setDrawings(drawingsWithRefs)
      } catch (e) {
        console.error('Failed to load drawings:', e)
        setDrawings([])
      }
    } else {
      setDrawings([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, setDrawings])

  // Handle drawing tool clicks - State Machine
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || !activeDrawingTool) return

    const handleChartClick = (param: MouseEventParams) => {
      if (!param.point || !seriesRef.current || !chartRef.current) return

      const price = seriesRef.current.coordinateToPrice(param.point.y)
      const time = chartRef.current.timeScale().coordinateToTime(param.point.x)

      if (price === null || time === null) return

      const priceNum = Number(price)
      const timeNum = typeof time === 'object' && 'timestamp' in time ? time.timestamp : Number(time)

      // State machine for different drawing tools
      if (activeDrawingTool === 'horizontal-line') {
        // 1-click tool
        // Clamp lineWidth to valid range for lightweight-charts (1-4)
        const validLineWidth = Math.min(4, Math.max(1, activeLineWidth)) as 1 | 2 | 3 | 4
        const line = seriesRef.current.createPriceLine({
          price: priceNum,
          color: activeDrawingColor,
          lineWidth: validLineWidth,
          lineStyle: getNumericLineStyle(activeLineStyle),
          axisLabelVisible: true,
          title: '',
        })

        const newDrawing: Drawing = {
          id: crypto.randomUUID(),
          type: 'horizontal-line',
          price: priceNum,
          color: activeDrawingColor,
          lineWidth: activeLineWidth,
          lineStyle: activeLineStyle,
          lineRef: line
        }

        addDrawing(newDrawing)
        saveDrawingsToLocalStorage([...drawings, newDrawing])
        setActiveDrawingTool(null)
      } else if (activeDrawingTool === 'vertical-line') {
        // 1-click tool
        const newDrawing: Drawing = {
          id: crypto.randomUUID(),
          type: 'vertical-line',
          time: Number(timeNum),
          color: activeDrawingColor,
          lineWidth: activeLineWidth,
          lineStyle: activeLineStyle
        }

        addDrawing(newDrawing)
        saveDrawingsToLocalStorage([...drawings, newDrawing])
        setActiveDrawingTool(null)
      } else if (activeDrawingTool === 'text') {
        // 1-click tool with modal
        setTextModalPosition({ time: Number(timeNum), price: priceNum })
        setShowTextModal(true)
      } else if (activeDrawingTool === 'trendline' || activeDrawingTool === 'rectangle') {
        // 2-click tools
        if (!drawingState) {
          // First click
          setDrawingState({
            type: activeDrawingTool as 'trendline' | 'rectangle',
            point1: { time: Number(timeNum), price: priceNum }
          })
        } else {
          // Second click
          const newDrawing: Drawing = activeDrawingTool === 'trendline'
            ? {
                id: crypto.randomUUID(),
                type: 'trendline',
                point1: drawingState.point1,
                point2: { time: Number(timeNum), price: priceNum },
                color: activeDrawingColor,
                lineWidth: activeLineWidth,
                lineStyle: activeLineStyle
              }
            : {
                id: crypto.randomUUID(),
                type: 'rectangle',
                point1: drawingState.point1,
                point2: { time: Number(timeNum), price: priceNum },
                color: activeDrawingColor,
                lineWidth: activeLineWidth,
                lineStyle: activeLineStyle
              }

          addDrawing(newDrawing)
          saveDrawingsToLocalStorage([...drawings, newDrawing])
          setDrawingState(null)
          setActiveDrawingTool(null)
        }
      }
    }

    chartRef.current.subscribeClick(handleChartClick)

    return () => {
      if (chartRef.current) {
        chartRef.current.unsubscribeClick(handleChartClick)
      }
    }
  }, [activeDrawingTool, drawingState, activeDrawingColor, activeLineWidth, activeLineStyle, drawings, addDrawing, setActiveDrawingTool, setDrawingState, symbol, saveDrawingsToLocalStorage])

  // Canvas rendering function
  const renderDrawings = useCallback(() => {
    if (!canvasRef.current || !chartRef.current || !seriesRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Render each drawing
    drawings.forEach(drawing => {
      if (drawing.type === 'horizontal-line') {
        // Skip - handled by LWC price line
        return
      }

      ctx.strokeStyle = drawing.color
      ctx.fillStyle = drawing.color

      // Set line width and style for non-text drawings
      if (drawing.type !== 'text') {
        ctx.lineWidth = drawing.lineWidth

        // Set line style
        if (drawing.lineStyle === 'dashed') {
          ctx.setLineDash([drawing.lineWidth * 4, drawing.lineWidth * 2])
        } else if (drawing.lineStyle === 'dotted') {
          ctx.setLineDash([drawing.lineWidth, drawing.lineWidth * 2])
        } else {
          ctx.setLineDash([])
        }
      }

      if (drawing.type === 'vertical-line') {
        const x = chartRef.current!.timeScale().timeToCoordinate(drawing.time as Time)
        if (x !== null) {
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, canvas.height)
          ctx.stroke()
        }
      } else if (drawing.type === 'trendline') {
        const x1 = chartRef.current!.timeScale().timeToCoordinate(drawing.point1.time as Time)
        const y1 = seriesRef.current!.priceToCoordinate(drawing.point1.price)
        const x2 = chartRef.current!.timeScale().timeToCoordinate(drawing.point2.time as Time)
        const y2 = seriesRef.current!.priceToCoordinate(drawing.point2.price)

        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }
      } else if (drawing.type === 'rectangle') {
        const x1 = chartRef.current!.timeScale().timeToCoordinate(drawing.point1.time as Time)
        const y1 = seriesRef.current!.priceToCoordinate(drawing.point1.price)
        const x2 = chartRef.current!.timeScale().timeToCoordinate(drawing.point2.time as Time)
        const y2 = seriesRef.current!.priceToCoordinate(drawing.point2.price)

        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
          const width = x2 - x1
          const height = y2 - y1
          ctx.strokeRect(x1, y1, width, height)
        }
      } else if (drawing.type === 'text') {
        const x = chartRef.current!.timeScale().timeToCoordinate(drawing.point.time as Time)
        const y = seriesRef.current!.priceToCoordinate(drawing.point.price)

        if (x !== null && y !== null) {
          ctx.font = `${drawing.fontSize || 14}px sans-serif`
          ctx.fillText(drawing.text, x + 5, y - 5)
        }
      }
    })
  }, [drawings])

  // Canvas render loop - redraw when chart moves or drawings change
  useEffect(() => {
    if (!chartRef.current) return

    const handleVisibleRangeChange = () => {
      renderDrawings()
    }

    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange)

    return () => {
      if (chartRef.current) {
        chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange)
      }
    }
  }, [drawings, renderDrawings])

  // Trigger render when drawings change
  useEffect(() => {
    renderDrawings()
  }, [drawings, renderDrawings])

  // Handle canvas and chart resize
  useEffect(() => {
    if (!ref.current || !canvasRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      if (ref.current && canvasRef.current && chartRef.current) {
        const width = ref.current.clientWidth
        const height = 500

        canvasRef.current.width = width
        canvasRef.current.height = height

        chartRef.current.applyOptions({ width })
        renderDrawings()
      }
    })

    resizeObserver.observe(ref.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [renderDrawings])

  // Right-click context menu handler
  useEffect(() => {
    if (!ref.current) return

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()

      if (!chartRef.current || !seriesRef.current) return

      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Hit detection - find if any drawing is near the click
      const hitTolerance = 10 // pixels
      let hitDrawing: Drawing | null = null

      for (const drawing of drawings) {
        if (drawing.type === 'horizontal-line') {
          const lineY = seriesRef.current.priceToCoordinate(drawing.price)
          if (lineY !== null && Math.abs(lineY - y) < hitTolerance) {
            hitDrawing = drawing
            break
          }
        } else if (drawing.type === 'vertical-line') {
          const lineX = chartRef.current.timeScale().timeToCoordinate(drawing.time as Time)
          if (lineX !== null && Math.abs(lineX - x) < hitTolerance) {
            hitDrawing = drawing
            break
          }
        } else if (drawing.type === 'trendline') {
          const x1 = chartRef.current.timeScale().timeToCoordinate(drawing.point1.time as Time)
          const y1 = seriesRef.current.priceToCoordinate(drawing.point1.price)
          const x2 = chartRef.current.timeScale().timeToCoordinate(drawing.point2.time as Time)
          const y2 = seriesRef.current.priceToCoordinate(drawing.point2.price)

          if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
            // Simple distance to line calculation
            const dist = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2)
            if (dist < hitTolerance) {
              hitDrawing = drawing
              break
            }
          }
        } else if (drawing.type === 'rectangle') {
          const x1 = chartRef.current.timeScale().timeToCoordinate(drawing.point1.time as Time)
          const y1 = seriesRef.current.priceToCoordinate(drawing.point1.price)
          const x2 = chartRef.current.timeScale().timeToCoordinate(drawing.point2.time as Time)
          const y2 = seriesRef.current.priceToCoordinate(drawing.point2.price)

          if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
            const minX = Math.min(x1, x2)
            const maxX = Math.max(x1, x2)
            const minY = Math.min(y1, y2)
            const maxY = Math.max(y1, y2)

            if (x >= minX - hitTolerance && x <= maxX + hitTolerance && y >= minY - hitTolerance && y <= maxY + hitTolerance) {
              // Check if near border
              if (Math.abs(x - minX) < hitTolerance || Math.abs(x - maxX) < hitTolerance || Math.abs(y - minY) < hitTolerance || Math.abs(y - maxY) < hitTolerance) {
                hitDrawing = drawing
                break
              }
            }
          }
        } else if (drawing.type === 'text') {
          const textX = chartRef.current.timeScale().timeToCoordinate(drawing.point.time as Time)
          const textY = seriesRef.current.priceToCoordinate(drawing.point.price)

          if (textX !== null && textY !== null) {
            // Rough hit detection for text
            if (Math.abs(textX - x) < 50 && Math.abs(textY - y) < 20) {
              hitDrawing = drawing
              break
            }
          }
        }
      }

      if (hitDrawing) {
        setContextMenu({ x: e.clientX, y: e.clientY, drawingId: hitDrawing.id })
      }
    }

    ref.current.addEventListener('contextmenu', handleContextMenu)
    const refCurrent = ref.current

    return () => {
      refCurrent?.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [drawings])

  // Close context menu on click elsewhere
  useEffect(() => {
    if (!contextMenu) return

    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)

    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  // Handle text modal submission
  const handleTextSubmit = (text: string) => {
    if (!textModalPosition) return

    const newDrawing: Drawing = {
      id: crypto.randomUUID(),
      type: 'text',
      point: textModalPosition,
      text,
      color: activeDrawingColor,
      fontSize: 14
    }

    addDrawing(newDrawing)
    saveDrawingsToLocalStorage([...drawings, newDrawing])
    setActiveDrawingTool(null)
  }

  // Format symbol for display (e.g., BTCUSDT -> BTC/USDT)
  const displaySymbol = symbol.replace(/USDT?$/, match => `/${match}`)

  // Format number with commas
  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
  }

  const handleAnalyticsClick = () => {
    dispatch(setShowAnalyticsPanel(true));
  }

  const handleClearDrawings = () => {
    // Remove all horizontal line price lines from chart
    drawings.forEach(drawing => {
      if (drawing.type === 'horizontal-line' && drawing.lineRef && seriesRef.current) {
        try {
          seriesRef.current.removePriceLine(drawing.lineRef as IPriceLine)
        } catch (e) {
          // ignore if already disposed
        }
      }
    })

    // Clear from state
    setDrawings([])

    // Clear from localStorage
    localStorage.removeItem(`chart-drawings-${symbol}`)
  }

  return (
    <div className="w-full">
      <ChartHeader 
        activeTimeframe={timeframe}
        onTimeframeChange={setTimeframe}
        onAnalyticsClick={handleAnalyticsClick} 
        onClearDrawings={handleClearDrawings} 
      />
      <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-2 truncate">
        {displaySymbol} - {timeframe} (last 200)
      </div>
      <div
        className="relative overflow-hidden w-full"
        style={{
          height: '500px',
          cursor: activeDrawingTool ? 'crosshair' : 'default'
        }}
      >
        <div ref={ref} className="w-full h-full" />

        {/* Canvas overlay for drawings */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '500px' }}
        />

        {/* Floating Drawing Toolbar */}
        <FloatingDrawingToolbar 
          activeDrawingTool={activeDrawingTool}
          onToolChange={setActiveDrawingTool}
          activeDrawingColor={activeDrawingColor}
          onColorChange={setActiveDrawingColor}
          activeLineWidth={activeLineWidth}
          onLineWidthChange={setActiveLineWidth}
          activeLineStyle={activeLineStyle}
          onLineStyleChange={setActiveLineStyle}
        />

        {isLoading && (
          <div className="absolute inset-0 bg-slate-300/70 dark:bg-slate-700/70 flex items-center justify-center pointer-events-none z-10">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-slate-400/40 to-transparent animate-shimmer" />
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 z-20">
              Updating data...
            </div>
          </div>
        )}

        {/* Context menu for deleting drawings */}
        {contextMenu && (
          <div
            className="fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                removeDrawing(contextMenu.drawingId)
                const updatedDrawings = drawings.filter(d => d.id !== contextMenu.drawingId)
                saveDrawingsToLocalStorage(updatedDrawings)
                setContextMenu(null)
              }}
              className="w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              Delete Drawing
            </button>
          </div>
        )}
      </div>

      {/* Text Input Modal */}
      <TextInputModal
        isOpen={showTextModal}
        onClose={() => {
          setShowTextModal(false)
          setTextModalPosition(null)
        }}
        onSubmit={handleTextSubmit}
      />

      {ohlcv && (
        <div className="mt-3 grid grid-cols-5 gap-2 text-xs overflow-hidden">
          <div className="flex flex-col min-w-0">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] mb-0.5">Open</span>
            <span className="font-semibold text-slate-900 dark:text-white truncate text-[11px]">
              ${formatNumber(ohlcv.open)}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] mb-0.5">High</span>
            <span className="font-semibold text-green-600 dark:text-green-400 truncate text-[11px]">
              ${formatNumber(ohlcv.high)}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] mb-0.5">Low</span>
            <span className="font-semibold text-red-600 dark:text-red-400 truncate text-[11px]">
              ${formatNumber(ohlcv.low)}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] mb-0.5">Close</span>
            <span className="font-semibold text-slate-900 dark:text-white truncate text-[11px]">
              ${formatNumber(ohlcv.close)}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-slate-500 dark:text-slate-400 text-[10px] mb-0.5">Volume</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400 truncate text-[11px]">
              {formatNumber(ohlcv.volume, 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

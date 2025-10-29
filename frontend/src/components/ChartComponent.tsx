import React, { useEffect, useRef, useContext, useState } from 'react'
import { createChart, IChartApi, ISeriesApi, UTCTimestamp, CandlestickData, IPriceLine } from 'lightweight-charts'
import { WebSocketContext } from '../context/WebSocketContext'
import type { PriceMessage } from '../hooks/useWebSocket'

type Kline = {
  openTime: number
  open: string
  high: string
  low: string
  close: string
  volume: string
}

type ChartComponentProps = {
  timeframe: string
  symbol: string
}

type OHLCVData = {
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export default function ChartComponent({ timeframe, symbol }: ChartComponentProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lastBarRef = useRef<{ time: UTCTimestamp; open: number; high: number; low: number; close: number } | null>(null)
  const priceLineRef = useRef<IPriceLine | null>(null)
  const [ohlcv, setOhlcv] = useState<OHLCVData | null>(null)
  const volumeDataRef = useRef<Map<number, number>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
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

  useEffect(() => {
    if (!ref.current) return
    
    // Trigger loading effect when symbol or timeframe changes
    setIsLoading(true)
    
    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }
    
    // Auto-hide after 500ms maximum
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false)
    }, 500)
    
    const isDark = document.documentElement.classList.contains('dark')
    
    chartRef.current = createChart(ref.current, { 
      width: ref.current.clientWidth, 
      height: 480,
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
    fetch(`/api/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=200`)
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
    } else {
      // new candle: create candle with open=close=price
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
    }
  }, [lastMessage, timeframeSeconds, symbol])

  // Format symbol for display (e.g., BTCUSDT -> BTC/USDT)
  const displaySymbol = symbol.replace(/USDT?$/, match => `/${match}`)

  // Format number with commas
  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    })
  }

  return (
    <div className="w-full h-full">
      <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
        {displaySymbol} - {timeframe} (last 200)
      </div>
      <div className="relative overflow-hidden" style={{ height: '480px' }}>
        <div ref={ref} className="w-full h-full" />
        
        {isLoading && (
          <div className="absolute inset-0 bg-slate-300/70 dark:bg-slate-700/70 flex items-center justify-center pointer-events-none z-10">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-slate-400/40 to-transparent animate-shimmer" />
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 z-20">
              Updating data...
            </div>
          </div>
        )}
      </div>
      
      {ohlcv && (
        <div className="mt-3 grid grid-cols-5 gap-3 text-sm">
          <div className="flex flex-col">
            <span className="text-slate-500 dark:text-slate-400 text-xs mb-1">Open</span>
            <span className="font-medium text-slate-900 dark:text-white">
              ${formatNumber(ohlcv.open)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 dark:text-slate-400 text-xs mb-1">High</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              ${formatNumber(ohlcv.high)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 dark:text-slate-400 text-xs mb-1">Low</span>
            <span className="font-medium text-red-600 dark:text-red-400">
              ${formatNumber(ohlcv.low)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 dark:text-slate-400 text-xs mb-1">Close</span>
            <span className="font-medium text-slate-900 dark:text-white">
              ${formatNumber(ohlcv.close)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 dark:text-slate-400 text-xs mb-1">Volume</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {formatNumber(ohlcv.volume, 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

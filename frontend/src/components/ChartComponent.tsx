import React, { useEffect, useRef, useContext } from 'react'
import { createChart, IChartApi, ISeriesApi, UTCTimestamp, CandlestickData } from 'lightweight-charts'
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

export default function ChartComponent() {
  const ref = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lastBarRef = useRef<{ time: UTCTimestamp; open: number; high: number; low: number; close: number } | null>(null)
  const timeframeSeconds = 3600 // 1h candles
  const ws = useContext(WebSocketContext)
  const lastMessage = ws?.lastMessage ?? null

  useEffect(() => {
    if (!ref.current) return
    chartRef.current = createChart(ref.current, { width: ref.current.clientWidth, height: 400 })
    seriesRef.current = chartRef.current.addCandlestickSeries()

    const onResize = () => {
      if (chartRef.current && ref.current) {
        chartRef.current.applyOptions({ width: ref.current.clientWidth })
      }
    }
    window.addEventListener('resize', onResize)

    // Fetch klines
    fetch('/api/v1/klines?symbol=BTCUSDT&interval=1h&limit=200')
      .then((r) => r.json())
      .then((data: Kline[]) => {
        const formatted: CandlestickData<UTCTimestamp>[] = data.map((k) => ({
          time: Math.floor(k.openTime / 1000) as UTCTimestamp,
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close)
        }))
        seriesRef.current?.setData(formatted)
        // remember last bar
        if (formatted.length > 0) {
          const lb = formatted[formatted.length - 1]
          lastBarRef.current = { time: lb.time as UTCTimestamp, open: lb.open, high: lb.high, low: lb.low, close: lb.close }
        }
      })
      .catch((err) => console.error('Failed to fetch klines:', err))

    return () => {
      window.removeEventListener('resize', onResize)
      chartRef.current?.remove()
      chartRef.current = null
    }
  }, [])

  // live update handler: append/update 1h candles based on ws ticks
  useEffect(() => {
    if (!lastMessage || !seriesRef.current) return
    const msg: PriceMessage = lastMessage
    const price = typeof msg.price === 'string' ? parseFloat(msg.price) : msg.price
    if (Number.isNaN(price)) return

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
    } else {
      // new candle: create candle with open=close=price
  const newBar: CandlestickData<UTCTimestamp> = { time: candleTime, open: price, high: price, low: price, close: price }
  seriesRef.current.update(newBar)
  lastBarRef.current = newBar
    }
  }, [lastMessage])

  return (
    <div className="p-4 bg-white rounded shadow">
      <div className="text-sm text-gray-500 mb-2">BTC/USDT - 1h (last 200)</div>
      <div ref={ref} />
    </div>
  )
}

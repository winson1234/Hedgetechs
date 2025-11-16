import React, { useEffect, useRef, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp, CandlestickData } from 'lightweight-charts';
import { useAppSelector } from '../store';

export default function ForexChartComponent() {
  const selectedSymbol = useAppSelector((state) => state.forex.selectedSymbol);
  // Get klines directly for the selected symbol only
  const klines = useAppSelector((state) =>
    state.forex.selectedSymbol ? state.forex.klines[state.forex.selectedSymbol] : undefined
  );

  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Callback ref to initialize chart when container is mounted
  const chartContainerRef = useCallback((container: HTMLDivElement | null) => {
    if (!container) {
      // Clean up existing chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
      containerRef.current = null;
      return;
    }

    // Prevent re-initialization if already initialized
    if (containerRef.current === container && chartRef.current) {
      return;
    }

    containerRef.current = container;

    // Clean up old chart if it exists
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    // Get container size
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width === 0 || height === 0) {
      return;
    }

    // Create chart
    const chart = createChart(container, {
      width,
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#374151',
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      if (newWidth > 0 && newHeight > 0 && chartRef.current) {
        chartRef.current.applyOptions({ width: newWidth, height: newHeight });
      }
    };

    window.addEventListener('resize', handleResize);
  }, []);

  // Update chart data when klines change
  useEffect(() => {
    if (!seriesRef.current || !klines || klines.length === 0) {
      if (seriesRef.current) {
        seriesRef.current.setData([]);
      }
      return;
    }

    try {
      // Convert klines to candlestick data
      const candleData: CandlestickData[] = klines.map((kline) => ({
        time: (new Date(kline.timestamp).getTime() / 1000) as UTCTimestamp,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close,
      }));

      // Sort by time in ascending order (oldest first)
      candleData.sort((a, b) => (a.time as number) - (b.time as number));

      seriesRef.current.setData(candleData);

      // Fit content after data is set
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (error) {
      console.error('[ForexChart] Error updating chart data:', error);
    }
  }, [klines]);

  if (!selectedSymbol) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <p>Select a forex pair to view chart</p>
      </div>
    );
  }

  if (!klines || klines.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <p>Loading chart data... (Symbol: {selectedSymbol})</p>
      </div>
    );
  }

  return (
    <div ref={chartContainerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
  );
}

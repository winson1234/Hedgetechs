import React, { useEffect, useState, useMemo } from 'react';
import { getApiUrl } from '../config/api';

interface MiniSparklineChartProps {
  symbol: string;
  color?: string;
  width?: number;
  height?: number;
}

interface KlineData {
  time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

const MiniSparklineChart: React.FC<MiniSparklineChartProps> = ({
  symbol,
  color = '#10b981',
  width = 120,
  height = 40,
}) => {
  const [data, setData] = useState<KlineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchKlineData = async () => {
      try {
        setLoading(true);
        setError(false);

        // Fetch 24h data with 15-minute intervals (96 data points)
        const response = await fetch(
          getApiUrl(`/api/v1/klines?symbol=${symbol}&interval=15m&limit=96`)
        );

        if (!response.ok) {
          throw new Error('Failed to fetch kline data');
        }

        const klineData: KlineData[] = await response.json();
        setData(klineData);
      } catch (err) {
        console.error(`Error fetching kline data for ${symbol}:`, err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchKlineData();

    // Refresh every 5 minutes to keep data fresh
    const interval = setInterval(fetchKlineData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [symbol]);

  // Generate SVG path from kline data
  const svgPath = useMemo(() => {
    if (data.length === 0) return '';

    // Extract close prices
    const prices = data.map((d) => parseFloat(d.close));

    // Find min and max for normalization
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    // If all prices are the same (flat line), return a straight line
    if (priceRange === 0) {
      return `M 0,${height / 2} L ${width},${height / 2}`;
    }

    // Generate path points
    const pathPoints = prices.map((price, index) => {
      const x = (index / (prices.length - 1)) * width;
      // Invert y-axis (0 at top, height at bottom)
      const y = height - ((price - minPrice) / priceRange) * height;
      return `${x},${y}`;
    });

    // Create smooth path using line segments
    return `M ${pathPoints.join(' L ')}`;
  }, [data, width, height]);

  // Use the color prop directly from parent (based on real-time 24h change)
  const lineColor = color;

  if (loading) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center">
        <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse"></div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <svg width={width} height={height} className="opacity-30">
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#64748b"
          strokeWidth="1"
          strokeDasharray="2,2"
        />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gradient fill area */}
      <path
        d={`${svgPath} L ${width},${height} L 0,${height} Z`}
        fill={`url(#gradient-${symbol})`}
      />

      {/* Line path */}
      <path
        d={svgPath}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default MiniSparklineChart;

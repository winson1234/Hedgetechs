import { memo, lazy, Suspense, useState, useEffect } from 'react';
import { getAssetColor } from '../utils/colors';

// Lazy load recharts
const AccountHoldingsRenderer = lazy(() => import('./AccountHoldingsRenderer'));

// Refresh icon
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

type AssetAllocation = {
  currency: string;
  amount: number;
  usdValue: number;
  percentage: number;
};

interface AccountHoldingsChartProps {
  allocations: AssetAllocation[];
  totalValue: number; // Total account value for live center label
  formatBalance: (amount: number, currency: string) => string;
}

function AccountHoldingsChart({
  allocations,
  totalValue,
  formatBalance,
}: AccountHoldingsChartProps) {
  const [chartSnapshot, setChartSnapshot] = useState<AssetAllocation[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize snapshot
  useEffect(() => {
    if (allocations.length > 0 && chartSnapshot.length === 0) {
      setChartSnapshot(allocations);
    }
  }, [allocations, chartSnapshot.length]);

  // Manual refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    setChartSnapshot(allocations);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (allocations.length === 0) {
    return (
      <div className="italic text-xs text-slate-400 dark:text-slate-600 py-4">
        No other holdings
      </div>
    );
  }

  return (
    <div>
      {/* Header with refresh button */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-slate-500 dark:text-slate-400 font-semibold text-sm">
          Holdings Allocation
        </div>
        {chartSnapshot.length > 0 && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded transition-colors disabled:opacity-50"
            title="Refresh chart"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>
              <RefreshIcon />
            </span>
            <span className="text-[10px]">Refresh</span>
          </button>
        )}
      </div>

      {/* Chart and Legend */}
      <div className="flex items-center justify-center gap-12">
        {/* Left: Chart */}
        <div className="flex-shrink-0">
          <Suspense
            fallback={
              <div className="h-[220px] flex items-center justify-center">
                <div className="animate-pulse">
                  <div className="w-40 h-40 rounded-full border-4 border-slate-200 dark:border-slate-700"></div>
                </div>
              </div>
            }
          >
            <AccountHoldingsRenderer
              allocations={chartSnapshot}
              liveValue={totalValue}
              formatBalance={formatBalance}
            />
          </Suspense>
        </div>

        {/* Right: Legend */}
        <div className="flex-1 space-y-2.5 min-w-0">
          {chartSnapshot.map((asset) => (
            <div key={asset.currency} className="flex items-start gap-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                style={{ backgroundColor: getAssetColor(asset.currency) }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                    {asset.currency}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {asset.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {asset.usdValue > 0
                    ? `$${asset.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : 'N/A'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(AccountHoldingsChart);

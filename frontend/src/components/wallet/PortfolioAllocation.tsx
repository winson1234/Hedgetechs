import type { Account } from '../../App';
import type { AssetPriceMap } from '../../hooks/useAssetPrices';
import { useMemo } from 'react';

type PortfolioAllocationProps = {
  accounts: Account[];
  formatBalance: (balance: number | undefined, currency: string | undefined) => string;
  assetPrices: AssetPriceMap;
  pricesLoading: boolean;
  totalPortfolioValue: number;
};

type AssetAllocation = {
  currency: string;
  amount: number;
  usdValue: number;
  percentage: number;
  isFiat: boolean;
};

const COLORS = [
  '#6366f1', // indigo
  '#10b981', // green
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
];

export default function PortfolioAllocation({
  accounts,
  formatBalance,
  assetPrices,
  pricesLoading,
  totalPortfolioValue,
}: PortfolioAllocationProps) {

  const assetAllocations = useMemo((): AssetAllocation[] => {
    const assetTotals: Record<string, number> = {};

    // Aggregate all assets across accounts
    accounts.forEach(acc => {
      Object.entries(acc.balances).forEach(([currency, amount]) => {
        if (assetTotals[currency]) {
          assetTotals[currency] += amount;
        } else {
          assetTotals[currency] = amount;
        }
      });
    });

    // Calculate USD values and percentages
    const allocations: AssetAllocation[] = Object.entries(assetTotals)
      .filter(([, amount]) => amount > 0)
      .map(([currency, amount]) => {
        const isFiat = ['USD', 'EUR', 'MYR', 'JPY'].includes(currency);
        let usdValue = 0;

        if (isFiat) {
          // For now, treat all fiat as 1:1 USD (can enhance with real forex rates later)
          usdValue = amount;
        } else {
          // Convert crypto to USD using asset prices
          const symbol = `${currency}USDT`;
          const price = assetPrices[symbol] || 0;
          usdValue = amount * price;
        }

        const percentage = totalPortfolioValue > 0 ? (usdValue / totalPortfolioValue) * 100 : 0;

        return {
          currency,
          amount,
          usdValue,
          percentage,
          isFiat,
        };
      })
      .sort((a, b) => b.usdValue - a.usdValue); // Sort by USD value descending

    return allocations;
  }, [accounts, assetPrices, totalPortfolioValue]);

  // Simple Donut Chart (SVG)
  const DonutChart = () => {
    if (assetAllocations.length === 0) return null;

    const size = 200;
    const strokeWidth = 30;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let currentAngle = 0;

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          className="dark:stroke-slate-700"
        />
        {assetAllocations.map((asset, index) => {
          const angle = (asset.percentage / 100) * 360;
          const dashArray = `${(asset.percentage / 100) * circumference} ${circumference}`;
          const rotation = currentAngle - 90;
          currentAngle += angle;

          return (
            <circle
              key={asset.currency}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={0}
              transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
              className="transition-all duration-300"
            />
          );
        })}
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dy=".3em"
          className="text-2xl font-bold fill-slate-900 dark:fill-slate-100"
        >
          {assetAllocations.length}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 20}
          textAnchor="middle"
          className="text-xs fill-slate-500 dark:fill-slate-400"
        >
          Assets
        </text>
      </svg>
    );
  };

  if (pricesLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
          Portfolio Allocation
        </h3>
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">Loading asset prices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">
        Portfolio Allocation
      </h3>

      {assetAllocations.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-center py-8 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
          No assets found in portfolio.
        </p>
      ) : (
        <div className="space-y-6">
          {/* Donut Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
            <DonutChart />
          </div>

          {/* Detailed List */}
          <div className="space-y-3">
            {assetAllocations.map((asset, index) => (
              <div
                key={asset.currency}
                className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                      asset.isFiat
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      {asset.currency.substring(0, 3)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {asset.currency}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {asset.isFiat ? 'Fiat Currency' : 'Cryptocurrency'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {asset.isFiat
                        ? formatBalance(asset.amount, asset.currency)
                        : asset.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6,
                          })
                      }
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatBalance(asset.usdValue, 'USD')} ({asset.percentage.toFixed(2)}%)
                    </p>
                  </div>
                </div>

                {/* Percentage Bar */}
                <div className="mt-3 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${asset.percentage}%`,
                      backgroundColor: COLORS[index % COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Summary Card */}
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
              Total Portfolio Value
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatBalance(totalPortfolioValue, 'USD')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Aggregated across {assetAllocations.length} {assetAllocations.length === 1 ? 'asset' : 'assets'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

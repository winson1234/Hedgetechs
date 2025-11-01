import { memo } from 'react';

type AssetAllocation = {
  currency: string;
  amount: number;
  usdValue: number;
  percentage: number;
  isFiat: boolean;
};

interface LegendPayload {
  value: string;
  color: string;
  payload: AssetAllocation;
}

interface PortfolioLegendProps {
  payload?: LegendPayload[];
  formatBalance: (amount: number | undefined, currency: string | undefined) => string;
}

function PortfolioLegend({ payload, formatBalance }: PortfolioLegendProps) {
  if (!payload || payload.length === 0) return null;

  return (
    <div className="space-y-3">
      {payload.map((entry) => {
        const asset = entry.payload;

        return (
          <div
            key={asset.currency}
            className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center justify-between gap-4">
              {/* Left: Color dot + Currency info */}
              <div className="flex items-center gap-3 flex-1">
                {/* Color Dot */}
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />

                {/* Currency Icon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    asset.isFiat
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {asset.currency.substring(0, 3)}
                </div>

                {/* Currency Name & Type */}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {asset.currency}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {asset.isFiat ? 'Fiat Currency' : 'Cryptocurrency'}
                  </p>
                </div>
              </div>

              {/* Right: Amount & Value */}
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
                  backgroundColor: entry.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(PortfolioLegend);

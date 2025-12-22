import { memo } from 'react';
import type { TooltipProps } from 'recharts';

type AssetAllocation = {
  currency: string;
  amount: number;
  usdValue: number;
  percentage: number;
  isFiat: boolean;
};

interface CustomTooltipProps extends TooltipProps<number, string> {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: AssetAllocation;
  }>;
}

// Currency full names mapping
const CURRENCY_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  USD: 'US Dollar',
  EUR: 'Euro',
  MYR: 'Malaysian Ringgit',
  JPY: 'Japanese Yen',
};

function PortfolioTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  // Extract actual currency (remove "Live: " or "Demo: " prefix)
  const actualCurrency = data.currency.replace(/^(Live|Demo):\s*/, '');
  const isLive = data.currency.startsWith('Live:');
  const isDemo = data.currency.startsWith('Demo:');
  const fullName = CURRENCY_NAMES[actualCurrency] || actualCurrency;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-lg">
      {/* Currency Name */}
      <div className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2 flex-wrap">
        <span>{fullName} ({actualCurrency})</span>
        {isLive && (
          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded uppercase">
            Live
          </span>
        )}
        {isDemo && (
          <span className="text-xs font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-1.5 py-0.5 rounded uppercase">
            Demo
          </span>
        )}
      </div>

      {/* Details Grid */}
      <div className="space-y-1.5 text-sm">
        {/* Amount Held */}
        <div className="flex justify-between gap-4">
          <span className="text-slate-600 dark:text-slate-400">Amount:</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {data.isFiat
              ? data.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : data.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })
            } {actualCurrency}
          </span>
        </div>

        {/* USD Value */}
        <div className="flex justify-between gap-4">
          <span className="text-slate-600 dark:text-slate-400">Value:</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            ${data.usdValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* Percentage */}
        <div className="flex justify-between gap-4 pt-1 border-t border-slate-200 dark:border-slate-700">
          <span className="text-slate-600 dark:text-slate-400">Allocation:</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">
            {data.percentage.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(PortfolioTooltip);

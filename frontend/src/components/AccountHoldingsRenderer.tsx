import { memo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { getAssetColor } from '../utils/colors';

type AssetAllocation = {
  currency: string;
  amount: number;
  usdValue: number;
  percentage: number;
};

interface AccountHoldingsRendererProps {
  allocations: AssetAllocation[];
  liveValue: number;
  formatBalance: (amount: number, currency: string) => string;
}

interface TooltipPayload {
  payload: AssetAllocation;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

// Simple tooltip component
const HoldingsTooltip = memo(({ active, payload }: TooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 shadow-lg">
      <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 mb-1">
        {data.currency}
      </div>
      <div className="space-y-0.5 text-[10px]">
        <div className="flex justify-between gap-2">
          <span className="text-slate-600 dark:text-slate-400">Amount:</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {data.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-600 dark:text-slate-400">Value:</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            ${data.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between gap-2 pt-0.5 border-t border-slate-200 dark:border-slate-700">
          <span className="text-slate-600 dark:text-slate-400">Share:</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">
            {data.percentage.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
});

HoldingsTooltip.displayName = 'HoldingsTooltip';

function AccountHoldingsRenderer({
  allocations,
  liveValue,
  formatBalance,
}: AccountHoldingsRendererProps) {
  // Guard against rendering before container is ready
  if (!allocations || allocations.length === 0) {
    return (
      <div style={{ width: '100%', height: '220px' }} className="flex items-center justify-center">
        <span className="text-sm text-slate-400">No data</span>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '220px' }}>
      <ResponsiveContainer width="100%" height={220} minWidth={200} minHeight={220} debounce={50}>
        <PieChart>
          <Pie
            data={allocations}
            dataKey="usdValue"
            nameKey="currency"
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="90%"
            animationDuration={200}
            labelLine={false}
            label={false}
          >
            {allocations.map((asset) => (
              <Cell
                key={asset.currency}
                fill={getAssetColor(asset.currency)}
              />
            ))}
          </Pie>
          <Tooltip content={<HoldingsTooltip />} animationDuration={0} />
          {/* Center label with live value */}
          <text
            x="50%"
            y="48%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs font-bold fill-slate-900 dark:fill-slate-100"
          >
            {formatBalance(liveValue, 'USD')}
          </text>
          <text
            x="50%"
            y="60%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[9px] fill-slate-500 dark:fill-slate-400"
          >
            {allocations.length} {allocations.length === 1 ? 'Asset' : 'Assets'}
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(AccountHoldingsRenderer);

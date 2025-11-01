import { memo } from 'react';

interface CenterLabelProps {
  viewBox?: {
    cx: number;
    cy: number;
  };
  totalValue: number;
  assetCount: number;
  formatBalance: (amount: number | undefined, currency: string | undefined) => string;
}

function DonutCenterLabel({
  viewBox,
  totalValue,
  assetCount,
  formatBalance,
}: CenterLabelProps) {
  // Provide fallback coordinates if viewBox is undefined
  const { cx = 0, cy = 0 } = viewBox || {};

  // Format the total value for display
  const formattedTotal = formatBalance(totalValue, 'USD');

  return (
    <g>
      {/* Total Portfolio Value (large) */}
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-xl font-bold fill-slate-900 dark:fill-slate-100"
      >
        {formattedTotal}
      </text>

      {/* Asset Count (small, below) */}
      <text
        x={cx}
        y={cy + 15}
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-xs fill-slate-500 dark:fill-slate-400"
      >
        {assetCount} {assetCount === 1 ? 'Asset' : 'Assets'}
      </text>
    </g>
  );
}

export default memo(DonutCenterLabel);

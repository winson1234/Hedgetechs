import { memo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { getAssetColor } from '../../utils/colors';
import PortfolioTooltip from './PortfolioTooltip';
import type { AssetAllocation } from './PortfolioAllocation';

interface DonutChartRendererProps {
  assetAllocations: AssetAllocation[]; // Frozen snapshot data for chart segments
  liveValue: number; // Live updating value for center label
  formatBalance: (amount: number | undefined, currency: string | undefined) => string;
}

function DonutChartRenderer({
  assetAllocations,
  liveValue,
  formatBalance,
}: DonutChartRendererProps) {
  return (
    <div style={{ width: '100%', height: '256px' }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={256}>
        <PieChart>
          <Pie
            data={assetAllocations}
            dataKey="usdValue"
            nameKey="currency"
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            animationDuration={200}
            animationBegin={0}
            isAnimationActive={true}
            labelLine={false}
            label={false}
          >
            {assetAllocations.map((asset) => (
              <Cell
                key={asset.currency}
                fill={getAssetColor(asset.currency)}
              />
            ))}
          </Pie>
          <Tooltip content={<PortfolioTooltip />} animationDuration={0} />
          {/* Center label - uses LIVE value for real-time updates */}
          <text
            x="50%"
            y="45%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xl font-bold fill-slate-900 dark:fill-slate-100"
          >
            {formatBalance(liveValue, 'USD')}
          </text>
          <text
            x="50%"
            y="55%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs fill-slate-500 dark:fill-slate-400"
          >
            {assetAllocations.length} {assetAllocations.length === 1 ? 'Asset' : 'Assets'}
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(DonutChartRenderer);

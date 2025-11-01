import { memo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { getAssetColor } from '../../utils/colors';
import PortfolioTooltip from './PortfolioTooltip';
import DonutCenterLabel from './DonutCenterLabel';
import type { AssetAllocation } from './PortfolioAllocation';

interface DonutChartRendererProps {
  assetAllocations: AssetAllocation[];
  totalPortfolioValue: number;
  formatBalance: (amount: number | undefined, currency: string | undefined) => string;
}

function DonutChartRenderer({
  assetAllocations,
  totalPortfolioValue,
  formatBalance,
}: DonutChartRendererProps) {
  return (
    <div style={{ width: '100%', height: '256px' }}>
      <ResponsiveContainer>
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
            label={(props) => (
              <DonutCenterLabel
                {...props}
                totalValue={totalPortfolioValue}
                assetCount={assetAllocations.length}
                formatBalance={formatBalance}
              />
            )}
          >
            {assetAllocations.map((asset) => (
              <Cell
                key={asset.currency}
                fill={getAssetColor(asset.currency)}
              />
            ))}
          </Pie>
          <Tooltip content={<PortfolioTooltip />} animationDuration={0} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(DonutChartRenderer);

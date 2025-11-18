import { useMemo, memo, lazy, Suspense, useState, useEffect } from 'react';
import type { AssetPriceMap } from '../../hooks/useAssetPrices';
import { getAssetColor } from '../../utils/colors';
import PortfolioLegend from './PortfolioLegend';
import { getApiUrl } from '../../config/api';

// Account type from Redux store
interface Balance {
  id: string;
  account_id: string;
  currency: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

interface Account {
  id: string;
  user_id: string;
  account_id: string;
  type: 'live' | 'demo';
  product_type: 'spot' | 'cfd' | 'futures';
  currency: string;
  status: 'active' | 'deactivated' | 'suspended';
  created_at: string;
  updated_at: string;
  nickname?: string | null;
  color?: string | null;
  icon?: string | null;
  last_accessed_at?: string | null;
  access_count: number;
  balances: Balance[];
}

// Lazy load the chart component to improve initial load time
const DonutChartRenderer = lazy(() => import('./DonutChartRenderer'));

// Refresh icon
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

type PortfolioAllocationProps = {
  accounts: Account[];
  formatBalance: (balance: number | undefined, currency: string | undefined) => string;
  assetPrices: AssetPriceMap;
  pricesLoading: boolean;
  totalPortfolioValue: number;
};

export type AssetAllocation = {
  currency: string;
  amount: number;
  usdValue: number;
  percentage: number;
  isFiat: boolean;
};

function PortfolioAllocation({
  accounts,
  formatBalance,
  assetPrices,
  pricesLoading,
  totalPortfolioValue,
}: PortfolioAllocationProps) {
  // Store a snapshot of allocations to prevent continuous re-renders
  const [chartSnapshot, setChartSnapshot] = useState<AssetAllocation[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fxRates, setFxRates] = useState<Record<string, number>>({ USD: 1.0 });

  // Fetch FX rates on mount
  useEffect(() => {
    const fetchFXRates = async () => {
      try {
        const response = await fetch(getApiUrl('/api/v1/fx-rates'));
        if (!response.ok) throw new Error('Failed to fetch FX rates');
        const rates = await response.json();
        setFxRates(rates);
      } catch (error) {
        console.error('Failed to load FX rates:', error);
      }
    };
    fetchFXRates();
  }, []);

  const assetAllocations = useMemo((): AssetAllocation[] => {
    const assetTotals: Record<string, number> = {};

    // Aggregate all assets across accounts
    accounts.forEach(acc => {
      acc.balances.forEach((balance) => {
        if (assetTotals[balance.currency]) {
          assetTotals[balance.currency] += balance.amount;
        } else {
          assetTotals[balance.currency] = balance.amount;
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
          // Convert fiat to USD using real forex rates from Massive API
          const rate = fxRates[currency] || 1.0;
          usdValue = amount * rate;
        } else {
          // Convert crypto to USD using asset prices from Binance
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
  }, [accounts, assetPrices, totalPortfolioValue, fxRates]);

  // Initialize snapshot on mount and when data changes significantly
  useEffect(() => {
    if (!pricesLoading && assetAllocations.length > 0 && chartSnapshot.length === 0) {
      setChartSnapshot(assetAllocations);
    }
  }, [pricesLoading, assetAllocations, chartSnapshot.length]);

  // Manual refresh function
  const handleRefresh = () => {
    setIsRefreshing(true);
    setChartSnapshot(assetAllocations);

    // Reset refreshing state after animation
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
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
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Portfolio Allocation
        </h3>
        {chartSnapshot.length > 0 && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh chart with latest prices"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>
              <RefreshIcon />
            </span>
            Refresh
          </button>
        )}
      </div>

      {assetAllocations.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-center py-8 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
          No assets found in portfolio.
        </p>
      ) : (
        <div className="space-y-6">
          {/* Recharts Donut Chart + Detailed Legend */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Left Column: Interactive Donut Chart */}
              <Suspense
                fallback={
                  <div className="h-64 min-h-[256px] flex items-center justify-center">
                    <div className="animate-pulse flex flex-col items-center gap-3">
                      <div className="w-48 h-48 rounded-full border-8 border-slate-200 dark:border-slate-700"></div>
                      <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                  </div>
                }
              >
                <DonutChartRenderer
                  assetAllocations={chartSnapshot}
                  liveValue={totalPortfolioValue}
                  formatBalance={formatBalance}
                />
              </Suspense>

              {/* Right Column: Detailed Legend */}
              <div>
                <PortfolioLegend
                  payload={chartSnapshot.map((asset) => ({
                    value: asset.currency,
                    color: getAssetColor(asset.currency),
                    payload: asset,
                  }))}
                  formatBalance={formatBalance}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(PortfolioAllocation);

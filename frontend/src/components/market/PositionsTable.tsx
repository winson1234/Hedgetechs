import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppSelector } from '../../store';
import { formatCurrency } from '../../utils/formatters';
import { ProductType } from '../../types';

interface Position {
  id: string;
  user_id: string;
  account_id: string;
  symbol: string;
  contract_number: string;
  side: 'long' | 'short';
  status: 'open' | 'closed' | 'liquidated';
  lot_size: number;
  entry_price: number;
  margin_used: number;
  leverage: number;
  product_type?: 'spot' | 'cfd' | 'futures'; // Product type for the position
  tp_price?: number | null;
  sl_price?: number | null;
  close_price?: number | null;
  pnl?: number | null;
  liquidation_price?: number | null;
  swap: number;
  commission: number;
  created_at: string;
  closed_at?: string | null;
  updated_at: string;
}

interface PositionsTableProps {
  filterByProductType: boolean;
  selectedProductType: ProductType;
}

export default function PositionsTable({ filterByProductType, selectedProductType }: PositionsTableProps) {
  const { activeAccountId } = useAppSelector(state => state.account);
  const { currentPrices } = useAppSelector(state => state.price);
  const session = useAppSelector(state => state.auth.session);

  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch open positions
  const fetchPositions = useCallback(async () => {
    if (!activeAccountId || !session?.access_token) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/v1/contracts?account_id=${activeAccountId}&status=open`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch positions');

      const data = await response.json();
      setPositions(data.contracts || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching positions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch positions');
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, session?.access_token]);

  // Fetch positions on mount and when account changes
  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // Filter positions by product type
  const filteredPositions = useMemo(() =>
    positions.filter(position => {
      const matchesProductType = !filterByProductType || position.product_type === selectedProductType;
      return matchesProductType;
    }),
    [positions, filterByProductType, selectedProductType]
  );

  // Close position handler
  const handleClosePosition = async (contractId: string, symbol: string) => {
    if (!session?.access_token) return;

    try {
      // Get current market price for this symbol
      const priceData = currentPrices[symbol];
      const currentPrice = priceData?.price;

      if (!currentPrice) {
        alert('Unable to get current market price. Please try again.');
        return;
      }

      const response = await fetch(`/api/v1/contracts/close?contract_id=${contractId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          close_price: currentPrice,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to close position');
      }

      // Refresh positions after closing
      await fetchPositions();
    } catch (err) {
      console.error('Error closing position:', err);
      alert(err instanceof Error ? err.message : 'Failed to close position');
    }
  };

  // Calculate real-time P&L for each position
  const positionsWithPnL = useMemo(() => {
    return filteredPositions.map(position => {
      const priceData = currentPrices[position.symbol];
      const currentPrice = priceData?.price || position.entry_price;

      // Calculate unrealized P&L
      let unrealizedPnL: number;
      if (position.side === 'long') {
        unrealizedPnL = (currentPrice - position.entry_price) * position.lot_size;
      } else {
        unrealizedPnL = (position.entry_price - currentPrice) * position.lot_size;
      }

      // Calculate ROE (Return on Equity) as percentage of margin
      const roe = (unrealizedPnL / position.margin_used) * 100;

      return {
        ...position,
        currentPrice,
        unrealizedPnL,
        roe,
      };
    });
  }, [filteredPositions, currentPrices]);

  // Format timestamp to readable date
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading positions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-red-400 dark:text-red-600 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Open Positions
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {positionsWithPnL.length} {positionsWithPnL.length === 1 ? 'position' : 'positions'} open
        </p>
      </div>

      {positionsWithPnL.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-8">
            <svg
              className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="text-sm text-slate-500 dark:text-slate-400">No open positions</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Your leveraged positions will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {positionsWithPnL.map((position) => (
              <div
                key={position.id}
                className={`p-3 border rounded-lg transition-colors ${
                  position.side === 'long'
                    ? 'border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10'
                    : 'border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10'
                }`}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        position.side === 'long'
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {position.side.toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {position.symbol}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {position.leverage}x
                    </span>
                  </div>
                  <button
                    onClick={() => handleClosePosition(position.id, position.symbol)}
                    className="px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    Close
                  </button>
                </div>

                {/* Position Details Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Size:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {position.lot_size.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Entry:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(position.entry_price, 'USD')}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Current:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(position.currentPrice, 'USD')}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Margin:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(position.margin_used, 'USD')}
                    </span>
                  </div>

                  {position.liquidation_price && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Liq. Price:</span>
                      <span className="font-medium text-orange-600 dark:text-orange-400">
                        {formatCurrency(position.liquidation_price, 'USD')}
                      </span>
                    </div>
                  )}
                </div>

                {/* P&L and ROE Row */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-600 dark:text-slate-400">Unrealized P&L:</span>
                      <span
                        className={`ml-2 text-sm font-bold ${
                          position.unrealizedPnL >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {position.unrealizedPnL >= 0 ? '+' : ''}
                        {formatCurrency(position.unrealizedPnL, 'USD')}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-600 dark:text-slate-400">ROE:</span>
                      <span
                        className={`ml-2 text-sm font-bold ${
                          position.roe >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {position.roe >= 0 ? '+' : ''}
                        {position.roe.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contract Number (small, bottom) */}
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                      ID: {position.contract_number}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {formatTimestamp(position.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { formatCurrency } from '../../utils/formatters';
import { ProductType } from '../../types';
import { fetchPositions, closePosition, updateAllPositionsPnL } from '../../store/slices/positionSlice';
import { fetchAccounts } from '../../store/slices/accountSlice';
import { addToast } from '../../store/slices/uiSlice';

interface PositionsTableProps {
  filterByProductType: boolean;
  selectedProductType: ProductType;
}

export default function PositionsTable({ filterByProductType, selectedProductType }: PositionsTableProps) {
  const dispatch = useAppDispatch();
  const { activeAccountId } = useAppSelector(state => state.account);
  const { currentPrices } = useAppSelector(state => state.price);
  const { positions, loading, error } = useAppSelector(state => state.position);
  const positionsRefreshTrigger = useAppSelector(state => state.ui.positionsRefreshTrigger);

  // Fetch positions when account changes or when triggered
  useEffect(() => {
    if (activeAccountId) {
      dispatch(fetchPositions({ accountId: activeAccountId, status: 'open' }));
    }
  }, [dispatch, activeAccountId, positionsRefreshTrigger]);

  // Update all positions' P&L when prices change
  useEffect(() => {
    if (currentPrices && Object.keys(currentPrices).length > 0) {
      dispatch(updateAllPositionsPnL(currentPrices));
    }
  }, [dispatch, currentPrices]);

  // Filter positions by product type
  const filteredPositions = useMemo(() =>
    positions.filter(position => {
      const matchesProductType = !filterByProductType || position.product_type === selectedProductType;
      return matchesProductType;
    }),
    [positions, filterByProductType, selectedProductType]
  );

  // Close position handler with confirmation and hedged pair warning
  const handleClosePosition = async (contractId: string, symbol: string) => {
    // Get current market price for this symbol
    const priceData = currentPrices[symbol];
    const currentPrice = priceData?.price;

    if (!currentPrice) {
      dispatch(addToast({ message: 'Unable to get current market price. Please try again.', type: 'error' }));
      return;
    }

    // Find the position to show P&L in confirmation
    const position = positions.find(p => p.id === contractId);
    if (!position) return;

    const unrealizedPnL = position.unrealized_pnl || 0;
    const pnlText = unrealizedPnL >= 0 ? `+${formatCurrency(unrealizedPnL, 'USD')}` : formatCurrency(unrealizedPnL, 'USD');

    // Check if this position is part of a hedged pair
    const isHedgedPosition = position.pair_id !== null && position.pair_id !== undefined;
    const pairedPosition = isHedgedPosition ? positions.find(p => p.pair_id === position.pair_id && p.id !== position.id) : null;

    // Show hedged pair warning if applicable
    if (isHedgedPosition && pairedPosition && pairedPosition.status === 'open') {
      const pairedPnL = pairedPosition.unrealized_pnl || 0;
      const pairedPnLText = pairedPnL >= 0 ? `+${formatCurrency(pairedPnL, 'USD')}` : formatCurrency(pairedPnL, 'USD');

      const warningConfirmed = window.confirm(
        `⚠️ HEDGED PAIR WARNING ⚠️\n\n` +
        `This position is part of a hedged pair!\n\n` +
        `Closing Position:\n` +
        `${position.side.toUpperCase()} ${position.symbol} - P&L: ${pnlText}\n\n` +
        `Paired Position (will remain open):\n` +
        `${pairedPosition.side.toUpperCase()} ${pairedPosition.symbol} - P&L: ${pairedPnLText}\n\n` +
        `Closing only one leg will break your hedge and expose you to market risk.\n\n` +
        `Do you want to continue closing ONLY this position?`
      );

      if (!warningConfirmed) return;
    } else {
      // Standard confirmation dialog
      const confirmed = window.confirm(
        `Close ${position.side.toUpperCase()} ${position.symbol} position?\n\n` +
        `Current P&L: ${pnlText}\n` +
        `Close Price: ${formatCurrency(currentPrice, 'USD')}`
      );

      if (!confirmed) return;
    }

    try {
      // Dispatch close position action
      await dispatch(closePosition({ contractId, closePrice: currentPrice })).unwrap();

      // Show success toast with P&L
      dispatch(addToast({
        message: `Position closed: ${pnlText}`,
        type: 'success'
      }));

      // Refresh account balance
      dispatch(fetchAccounts());
    } catch (err) {
      // Error toast is handled by the thunk rejection
      dispatch(addToast({
        message: err instanceof Error ? err.message : 'Failed to close position',
        type: 'error'
      }));
    }
  };

  // Positions already have P&L calculated by Redux, just use filteredPositions
  const positionsWithPnL = filteredPositions;

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
                      {formatCurrency(position.current_price || position.entry_price, 'USD')}
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
                          (position.unrealized_pnl || 0) >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {(position.unrealized_pnl || 0) >= 0 ? '+' : ''}
                        {formatCurrency(position.unrealized_pnl || 0, 'USD')}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-600 dark:text-slate-400">ROE:</span>
                      <span
                        className={`ml-2 text-sm font-bold ${
                          (position.roe || 0) >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {(position.roe || 0) >= 0 ? '+' : ''}
                        {(position.roe || 0).toFixed(2)}%
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

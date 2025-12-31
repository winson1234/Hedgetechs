import { useEffect, useMemo, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { formatCurrency } from '../../utils/formatters';
import { ProductType } from '../../types';
import { fetchPositions, closePosition, closePair, updateAllPositionsPnL } from '../../store/slices/positionSlice';
import { fetchAccounts } from '../../store/slices/accountSlice';
import { addToast } from '../../store/slices/uiSlice';
import ConfirmDialog from '../ConfirmDialog';

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

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'default' | 'danger' | 'warning';
    details: Array<{ label: string; value: string; highlight?: boolean }>;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'default',
    details: [],
    onConfirm: () => { }
  });

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

    // Close hedged pair (both positions) if applicable
    if (isHedgedPosition && pairedPosition && pairedPosition.status === 'open') {
      const pairedPnL = pairedPosition.unrealized_pnl || 0;
      const totalPnL = unrealizedPnL + pairedPnL;
      const totalPnLText = totalPnL >= 0 ? `+${formatCurrency(totalPnL, 'USD')}` : formatCurrency(totalPnL, 'USD');

      // Determine which is Long and which is Short for consistent ordering in dialog
      const longPos = position.side === 'long' ? position : pairedPosition;
      const shortPos = position.side === 'short' ? position : pairedPosition;

      const longPnL = longPos.unrealized_pnl || 0;
      const shortPnL = shortPos.unrealized_pnl || 0;

      const longPnLText = longPnL >= 0 ? `+${formatCurrency(longPnL, 'USD')}` : formatCurrency(longPnL, 'USD');
      const shortPnLText = shortPnL >= 0 ? `+${formatCurrency(shortPnL, 'USD')}` : formatCurrency(shortPnL, 'USD');

      setConfirmDialog({
        isOpen: true,
        title: 'Close Hedged Pair',
        message: 'This will close both positions in the hedged pair at the current market price.',
        variant: 'default',
        details: [
          { label: 'LONG Position', value: longPos.symbol, highlight: true },
          { label: 'P&L', value: longPnLText },
          { label: 'SHORT Position', value: shortPos.symbol, highlight: true },
          { label: 'P&L', value: shortPnLText },
          { label: 'Combined P&L', value: totalPnLText, highlight: true },
          { label: 'Close Price', value: formatCurrency(currentPrice, 'USD') }
        ],
        onConfirm: async () => {
          // Close dialog immediately to prevent double-execution
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          await executeClosePair(position.pair_id!, currentPrice, totalPnL);
        }
      });
    } else {
      // Standard confirmation dialog
      setConfirmDialog({
        isOpen: true,
        title: `Close ${position.side.toUpperCase()} ${position.symbol} position?`,
        message: 'Your position will be closed at the current market price.',
        variant: 'default',
        details: [
          { label: 'Current P&L', value: pnlText, highlight: true },
          { label: 'Close Price', value: formatCurrency(currentPrice, 'USD') }
        ],
        onConfirm: async () => {
          // Close dialog immediately to prevent double-execution
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          await executeClosePosition(contractId, currentPrice, pnlText);
        }
      });
    }
  };

  // Execute position close
  const executeClosePosition = async (contractId: string, closePrice: number, pnlText: string) => {
    try {
      // Dispatch close position action
      await dispatch(closePosition({ contractId, closePrice })).unwrap();

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

  // Execute hedged pair close (closes both long and short positions)
  const executeClosePair = async (pairId: string, closePrice: number, totalPnL: number) => {
    try {
      // Dispatch close pair action
      await dispatch(closePair({ pairId, closePrice })).unwrap();

      // Show success toast with combined P&L
      const pnlText = totalPnL >= 0 ? `+${formatCurrency(totalPnL, 'USD')}` : formatCurrency(totalPnL, 'USD');
      dispatch(addToast({
        message: `Hedged pair closed: ${pnlText}`,
        type: 'success'
      }));

      // Refresh account balance
      dispatch(fetchAccounts());
    } catch (err) {
      // Error toast
      dispatch(addToast({
        message: err instanceof Error ? err.message : 'Failed to close pair',
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
          <div className="space-y-2.5">
            {positionsWithPnL.map((position) => (
              <div
                key={position.id}
                className={`p-3.5 border rounded-lg transition-all hover:shadow-md ${position.side === 'long'
                    ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
                    : 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
                  }`}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${position.side === 'long'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                    >
                      {position.side === 'long' ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      {position.side.toUpperCase()}
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-200">
                      {position.symbol}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                      {position.leverage}x
                    </span>
                  </div>
                  <button
                    onClick={() => handleClosePosition(position.id, position.symbol)}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {loading ? 'Closing...' : 'Close'}
                  </button>
                </div>

                {/* Position Details Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      Size:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">
                      {position.lot_size.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Entry:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">
                      {formatCurrency(position.entry_price, 'USD')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Current:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">
                      {formatCurrency(position.current_price || position.entry_price, 'USD')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Margin:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">
                      {formatCurrency(position.margin_used, 'USD')}
                    </span>
                  </div>

                  {position.liquidation_price && (
                    <div className="flex justify-between items-center py-1 col-span-2">
                      <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Liq. Price:
                      </span>
                      <span className="font-semibold text-orange-400">
                        {formatCurrency(position.liquidation_price, 'USD')}
                      </span>
                    </div>
                  )}
                </div>

                {/* P&L and ROE Row */}
                <div className="pt-2.5 border-t border-slate-300 dark:border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 dark:text-slate-400">P&L:</span>
                      <span
                        className={`text-sm font-bold ${(position.unrealized_pnl || 0) >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                          }`}
                      >
                        {(position.unrealized_pnl || 0) >= 0 ? '+' : ''}
                        {formatCurrency(position.unrealized_pnl || 0, 'USD')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 dark:text-slate-400">ROE:</span>
                      <span
                        className={`text-sm font-bold ${(position.roe || 0) >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                          }`}
                      >
                        {(position.roe || 0) >= 0 ? '+' : ''}
                        {(position.roe || 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contract Number (small, bottom) */}
                <div className="mt-2.5 pt-2 border-t border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      ID: {position.contract_number}
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatTimestamp(position.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        details={confirmDialog.details}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

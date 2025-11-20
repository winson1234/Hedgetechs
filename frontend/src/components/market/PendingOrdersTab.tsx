import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { cancelPendingOrder, fetchPendingOrders } from '../../store/slices/orderSlice';
import { addToast } from '../../store/slices/uiSlice';
import { formatCurrency } from '../../utils/formatters';
import { ProductType } from '../../types';

interface PendingOrdersTabProps {
  filterByProductType: boolean;
  selectedProductType: ProductType;
}

export default function PendingOrdersTab({ filterByProductType, selectedProductType }: PendingOrdersTabProps) {
  const dispatch = useAppDispatch();
  const activeInstrument = useAppSelector(state => state.ui.activeInstrument);
  const allPendingOrders = useAppSelector(state => state.order.pendingOrders);
  const activeAccountId = useAppSelector(state => state.account.activeAccountId);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Manual refresh function
  const handleRefresh = useCallback(async () => {
    if (!activeAccountId || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await dispatch(fetchPendingOrders(activeAccountId)).unwrap();
    } catch (error) {
      console.error('Failed to refresh pending orders:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeAccountId, dispatch, isRefreshing]);

  // Auto-refresh every 10 seconds to catch executed orders
  useEffect(() => {
    if (!activeAccountId) return;

    // Function to fetch pending orders (inline to avoid dependency issues)
    const refreshOrders = async () => {
      try {
        await dispatch(fetchPendingOrders(activeAccountId)).unwrap();
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    };

    // Initial fetch when component mounts or account changes
    refreshOrders();

    // Set up polling interval
    const intervalId = setInterval(() => {
      refreshOrders();
    }, 10000); // Refresh every 10 seconds

    // Cleanup interval on unmount or account change
    return () => clearInterval(intervalId);
  }, [activeAccountId, dispatch]); // Safe dependencies

  // Memoize filtered orders to prevent unnecessary rerenders
  const pendingOrders = useMemo(() =>
    allPendingOrders.filter(order => {
      const matchesInstrument = order.symbol === activeInstrument;
      const matchesProductType = !filterByProductType || order.product_type === selectedProductType;
      const isPending = order.status === 'pending';

      return matchesInstrument && matchesProductType && isPending;
    }),
    [allPendingOrders, activeInstrument, filterByProductType, selectedProductType]
  );

  const handleCancel = async (orderId: string) => {
    setCancellingOrderId(orderId);
    try {
      await dispatch(cancelPendingOrder(orderId)).unwrap();
      dispatch(addToast({
        type: 'success',
        message: 'Order cancelled successfully'
      }));
    } catch (error) {
      dispatch(addToast({
        type: 'error',
        message: error as string || 'Failed to cancel order'
      }));

      // Refresh pending orders to remove any failed orders from UI
      // (Backend filters by status='pending', so failed orders will be excluded)
      if (activeAccountId) {
        dispatch(fetchPendingOrders(activeAccountId));
      }
    } finally {
      setCancellingOrderId(null);
    }
  };

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

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Pending Orders - {activeInstrument}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {pendingOrders.length} {pendingOrders.length === 1 ? 'order' : 'orders'} waiting for execution
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh pending orders"
        >
          <svg
            className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {pendingOrders.length === 0 ? (
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-sm text-slate-500 dark:text-slate-400">No pending orders</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Place limit or stop-limit orders in the trading panel
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {pendingOrders.map((order) => (
            <div
              key={order.id}
              className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              {/* Header: Type and Cancel Button */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      order.side === 'buy'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {order.side.toUpperCase()}
                  </span>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                    {order.type}
                  </span>
                </div>
                <button
                  onClick={() => handleCancel(order.id)}
                  disabled={cancellingOrderId === order.id}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Cancel order"
                >
                  {cancellingOrderId === order.id ? 'Cancelling...' : 'Cancel'}
                </button>
              </div>

              {/* Order Details */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Amount:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {order.quantity.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })}{' '}
                    {activeInstrument.replace('USDT', '')}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    {order.type === 'limit' ? 'Limit Price:' : 'Limit Price:'}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(order.trigger_price, 'USD')}
                  </span>
                </div>

                {order.type === 'stop_limit' && order.limit_price && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">Stop Price:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(order.limit_price, 'USD')}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Total:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(order.quantity * order.trigger_price, 'USD')}
                  </span>
                </div>

                <div className="pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-500">Placed:</span>
                    <span className="text-slate-500 dark:text-slate-500">
                      {formatTimestamp(order.created_at)}
                    </span>
                  </div>
                  {order.order_number && (
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-slate-400 dark:text-slate-500">Order ID:</span>
                      <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                        {order.order_number}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Execution Status Indicator */}
              <div className="mt-2 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {order.type === 'limit'
                    ? order.side === 'buy'
                      ? `Executes when price ≤ ${formatCurrency(order.trigger_price, 'USD')}`
                      : `Executes when price ≥ ${formatCurrency(order.trigger_price, 'USD')}`
                    : order.side === 'buy'
                    ? `Stops at ${formatCurrency(order.limit_price || 0, 'USD')}`
                    : `Stops at ${formatCurrency(order.limit_price || 0, 'USD')}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

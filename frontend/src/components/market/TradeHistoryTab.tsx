import { useMemo } from 'react';
import { useAppSelector } from '../../store';

// Utility function to format balance
const formatBalance = (value: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
};

export default function TradeHistoryTab() {
  const activeInstrument = useAppSelector(state => state.ui.activeInstrument);
  const allOrders = useAppSelector(state => state.order.orders);

  // Memoize filtered orders to prevent unnecessary rerenders
  const orderHistory = useMemo(() =>
    allOrders.filter(order =>
      order.symbol === activeInstrument &&
      (order.status === 'filled' || order.status === 'partially_filled')
    ),
    [allOrders, activeInstrument]
  );

  // Format timestamp to readable date
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Trade History - {activeInstrument}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {orderHistory.length} {orderHistory.length === 1 ? 'trade' : 'trades'} executed
        </p>
      </div>

      {orderHistory.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm text-slate-500 dark:text-slate-400">No trade history</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Your executed orders will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-1.5">
            {orderHistory.map((order) => (
              <div
                key={order.id}
                className={`p-2.5 border rounded-lg transition-colors ${
                  order.side === 'buy'
                    ? 'border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20'
                    : 'border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                }`}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${
                        order.side === 'buy'
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {order.side.toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
                      {order.type}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatTimestamp(order.created_at)}
                  </span>
                </div>

                {/* Trade Details */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Amount:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {order.amount_base.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Avg Price:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatBalance(order.average_fill_price || 0, 'USD')}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Filled:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {order.filled_amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Total:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatBalance((order.average_fill_price || 0) * order.filled_amount, 'USD')}
                    </span>
                  </div>
                </div>

                {/* Order ID (small, bottom) */}
                <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700/50">
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                    ID: {order.id.substring(0, 16)}...
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

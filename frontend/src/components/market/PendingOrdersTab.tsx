import { useUIStore } from '../../stores/uiStore';
import { useOrderStore } from '../../stores/orderStore';
import { formatBalance } from '../../stores/accountStore';

export default function PendingOrdersTab() {
  const activeInstrument = useUIStore(state => state.activeInstrument);
  const getPendingOrdersBySymbol = useOrderStore(state => state.getPendingOrdersBySymbol);
  const cancelPendingOrder = useOrderStore(state => state.cancelPendingOrder);

  const pendingOrders = getPendingOrdersBySymbol(activeInstrument);

  const handleCancel = (orderId: string) => {
    cancelPendingOrder(orderId);
  };

  // Format timestamp to readable date
  const formatTimestamp = (timestamp: number) => {
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
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Pending Orders - {activeInstrument}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {pendingOrders.length} {pendingOrders.length === 1 ? 'order' : 'orders'} waiting for execution
        </p>
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
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium transition"
                  title="Cancel order"
                >
                  Cancel
                </button>
              </div>

              {/* Order Details */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Amount:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {order.amount.toLocaleString(undefined, {
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
                    {formatBalance(order.price, 'USD')}
                  </span>
                </div>

                {order.type === 'stop-limit' && order.stopPrice && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400">Stop Price:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatBalance(order.stopPrice, 'USD')}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Total:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatBalance(order.amount * order.price, 'USD')}
                  </span>
                </div>

                <div className="pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-500">Placed:</span>
                    <span className="text-slate-500 dark:text-slate-500">
                      {formatTimestamp(order.timestamp)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Execution Status Indicator */}
              <div className="mt-2 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {order.type === 'limit'
                    ? order.side === 'buy'
                      ? `Executes when price ≤ ${formatBalance(order.price, 'USD')}`
                      : `Executes when price ≥ ${formatBalance(order.price, 'USD')}`
                    : order.side === 'buy'
                    ? `Stops at ${formatBalance(order.stopPrice, 'USD')}`
                    : `Stops at ${formatBalance(order.stopPrice, 'USD')}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

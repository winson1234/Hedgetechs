import { useMemo } from 'react';
import { useAppSelector } from '../../store';
import { formatCurrency } from '../../utils/formatters';
import { ProductType } from '../../types';

interface TradeHistoryTabProps {
  filterByProductType: boolean;
  selectedProductType: ProductType;
}

export default function TradeHistoryTab({ filterByProductType, selectedProductType }: TradeHistoryTabProps) {
  const activeInstrument = useAppSelector(state => state.ui.activeInstrument);
  const allOrders = useAppSelector(state => state.order.orders);

  // Memoize filtered orders to prevent unnecessary rerenders
  const orderHistory = useMemo(() =>
    allOrders.filter(order => {
      const matchesInstrument = order.symbol === activeInstrument;
      const matchesStatus = order.status === 'filled' || order.status === 'partially_filled';
      const matchesProductType = !filterByProductType || order.product_type === selectedProductType;

      return matchesInstrument && matchesStatus && matchesProductType;
    }),
    [allOrders, activeInstrument, filterByProductType, selectedProductType]
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
          <div className="space-y-2.5">
            {orderHistory.map((order) => (
              <div
                key={order.id}
                className={`p-3.5 border rounded-lg transition-all hover:shadow-md ${
                  order.side === 'buy'
                    ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
                    : 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
                }`}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${
                        order.side === 'buy'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {order.side === 'buy' ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      {order.side.toUpperCase()}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-300 bg-slate-700 border border-slate-600 uppercase">
                      {order.type}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatTimestamp(order.created_at)}
                  </span>
                </div>

                {/* Trade Details */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-2">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      Amount:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {order.amount_base.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Avg Price:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {formatCurrency(order.average_fill_price || 0, 'USD')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Filled:
                    </span>
                    <span className="font-semibold text-slate-200">
                      {order.filled_amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-5m-5 5h.01M9 17h.01M9 12h.01M12 12h.01M15 12h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Total:
                    </span>
                    <span className="font-bold text-slate-100">
                      {formatCurrency((order.average_fill_price || 0) * order.filled_amount, 'USD')}
                    </span>
                  </div>
                </div>

                {/* Order Number (small, bottom) */}
                <div className="mt-2.5 pt-2 border-t border-slate-700/50">
                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    ID: {order.order_number}
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

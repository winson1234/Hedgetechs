import { formatBalance, formatAccountId } from '../utils/formatters';
import type { Transaction, Position } from '../types';
import {
  type LegacyExecutedOrder as ExecutedOrder,
  type LegacyPendingOrder as PendingOrder
} from '../utils/orderAdapters';
import { useAppSelector } from '../store';

type ClosedPosition = Position & { timestamp: number; itemType: 'closedPosition' };
type DetailItem =
  | (Transaction & { itemType: 'transaction' })
  | (ExecutedOrder & { itemType: 'executedOrder' })
  | (PendingOrder & { itemType: 'pendingOrder' })
  | ClosedPosition;

interface TransactionDetailModalProps {
  item: DetailItem | null;
  onClose: () => void;
}

// Format timestamp to readable date
const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// Copy to clipboard helper
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

export default function TransactionDetailModal({ item, onClose }: TransactionDetailModalProps) {
  // Get accounts from Redux store to look up account numbers
  const accounts = useAppSelector((state) => state.account.accounts);

  // Helper function to get account ID from account UUID
  const getAccountNumber = (accountId: string | number): string => {
    const account = accounts.find(acc => acc.id === accountId || acc.account_id === accountId);
    if (!account) return 'Unknown Account';
    return formatAccountId(account.account_id, account.type);
  };

  if (!item) return null;

  // Render transaction details
  const renderTransactionDetails = () => {
    if (item.itemType !== 'transaction') return null;
    const txn = item as Transaction;

    return (
      <>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500 dark:text-slate-400">Transaction Number</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{txn.transactionNumber}</p>
              <button
                onClick={() => copyToClipboard(txn.transactionNumber)}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                title="Copy Number"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Type</p>
            <p className="font-medium text-slate-900 dark:text-slate-100 capitalize">{txn.type}</p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Amount</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {formatBalance(txn.amount, txn.currency)}
            </p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Status</p>
            <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${txn.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                txn.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                  txn.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
              {txn.status}
            </span>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Account</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{getAccountNumber(txn.accountId)}</p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Date & Time</p>
            <p className="text-slate-900 dark:text-slate-100">{formatDateTime(txn.timestamp)}</p>
          </div>
        </div>

        {/* Transfer specific details */}
        {txn.type === 'transfer' && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Transfer Details</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 dark:text-slate-400">From Account</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{txn.fromAccountId ? getAccountNumber(txn.fromAccountId) : 'N/A'}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">To Account</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{txn.toAccountId ? getAccountNumber(txn.toAccountId) : 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment metadata */}
        {txn.metadata && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Payment Details</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {txn.metadata.cardBrand && (
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Card</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {txn.metadata.cardBrand.toUpperCase()} •••• {txn.metadata.last4}
                  </p>
                </div>
              )}
              {txn.metadata.bankName && (
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Bank</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {txn.metadata.bankName}
                    {txn.metadata.accountLast4 && ` •••• ${txn.metadata.accountLast4}`}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Intent ID */}
        {txn.paymentIntentId && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Payment Intent ID</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs text-slate-600 dark:text-slate-400">{txn.paymentIntentId}</p>
              <button
                onClick={() => copyToClipboard(txn.paymentIntentId!)}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                title="Copy Payment Intent ID"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Error message / Rejection reason */}
        {(txn.status === 'failed' || txn.status === 'rejected') && txn.errorMessage && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
              {txn.type === 'deposit' ? 'Rejection Reason' : 'Error Details'}
            </p>
            <p className="text-sm text-red-600 dark:text-red-400">{txn.errorMessage}</p>
          </div>
        )}
      </>
    );
  };

  // Render closed position details
  const renderClosedPositionDetails = () => {
    if (item.itemType !== 'closedPosition') return null;
    const position = item as ClosedPosition;

    return (
      <>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500 dark:text-slate-400">Contract Number</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs text-slate-900 dark:text-slate-100">{position.contract_number}</p>
              <button
                onClick={() => copyToClipboard(position.contract_number)}
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                title="Copy Contract Number"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Symbol</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{position.symbol}</p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Side</p>
            <p className="font-medium text-slate-900 dark:text-slate-100 capitalize">{position.side}</p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Lot Size</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{position.lot_size}</p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Entry Price</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{formatBalance(position.entry_price, 'USD')}</p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Close Price</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{position.close_price ? formatBalance(position.close_price, 'USD') : 'N/A'}</p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">P&L</p>
            <p className={`font-semibold ${(position.pnl || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatBalance(position.pnl || 0, 'USD')}
            </p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Leverage</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{position.leverage}x</p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Status</p>
            <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${position.status === 'closed' ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300' :
                position.status === 'liquidated' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              }`}>
              {position.status}
            </span>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Account</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{getAccountNumber(position.account_id)}</p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-slate-400">Opened</p>
            <p className="text-slate-900 dark:text-slate-100">{formatDateTime(new Date(position.created_at).getTime())}</p>
          </div>

          {position.closed_at && (
            <div>
              <p className="text-slate-500 dark:text-slate-400">Closed</p>
              <p className="text-slate-900 dark:text-slate-100">{formatDateTime(new Date(position.closed_at).getTime())}</p>
            </div>
          )}
        </div>
      </>
    );
  };

  // Render order details
  const renderOrderDetails = () => {
    if (item.itemType === 'executedOrder') {
      const order = item as ExecutedOrder;
      return (
        <>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Order Number</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs text-slate-900 dark:text-slate-100">{order.orderNumber || 'N/A'}</p>
                <button
                  onClick={() => copyToClipboard(order.orderNumber || 'N/A')}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                  title="Copy Order Number"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Type</p>
              <p className="font-medium text-slate-900 dark:text-slate-100 capitalize">{order.side} Order</p>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Symbol</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{order.symbol}</p>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Amount</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{order.amount.toFixed(6)}</p>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Execution Price</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{formatBalance(order.executionPrice, 'USD')}</p>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Total</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{formatBalance(order.total, 'USD')}</p>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Fee</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{formatBalance(order.fee, 'USD')}</p>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Account</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{getAccountNumber(order.accountId)}</p>
            </div>

            <div className="col-span-2">
              <p className="text-slate-500 dark:text-slate-400">Execution Time</p>
              <p className="text-slate-900 dark:text-slate-100">{formatDateTime(order.timestamp)}</p>
            </div>

            {order.wasFromPending && (
              <div className="col-span-2">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  ℹ️ This order was executed from a pending limit order
                </p>
              </div>
            )}
          </div>
        </>
      );
    }

    if (item.itemType === 'pendingOrder') {
      const order = item as PendingOrder;
      return (
        <>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Order Number</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs text-slate-900 dark:text-slate-100">{order.orderNumber || 'N/A'}</p>
                <button
                  onClick={() => copyToClipboard(order.orderNumber || 'N/A')}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                  title="Copy Order Number"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Status</p>
              <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                Pending
              </span>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Type</p>
              <p className="font-medium text-slate-900 dark:text-slate-100 capitalize">{order.type}</p>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Side</p>
              <p className="font-medium text-slate-900 dark:text-slate-100 capitalize">{order.side}</p>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Symbol</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{order.symbol}</p>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Amount</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{order.amount.toFixed(6)}</p>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Limit Price</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{formatBalance(order.price, 'USD')}</p>
            </div>

            {order.stopPrice && (
              <div>
                <p className="text-slate-500 dark:text-slate-400">Stop Price</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{formatBalance(order.stopPrice, 'USD')}</p>
              </div>
            )}

            <div>
              <p className="text-slate-500 dark:text-slate-400">Estimated Total</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                ~{formatBalance(order.amount * order.price, 'USD')}
              </p>
            </div>

            <div>
              <p className="text-slate-500 dark:text-slate-400">Account</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{getAccountNumber(order.accountId)}</p>
            </div>

            <div className="col-span-2">
              <p className="text-slate-500 dark:text-slate-400">Created</p>
              <p className="text-slate-900 dark:text-slate-100">{formatDateTime(order.timestamp)}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              ℹ️ This order will execute automatically when the market price reaches your limit price
            </p>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full border border-slate-200 dark:border-slate-700">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {item.itemType === 'transaction' ? 'Transaction Details' :
                item.itemType === 'executedOrder' ? 'Order Details (Executed)' :
                  item.itemType === 'pendingOrder' ? 'Order Details (Pending)' :
                    'Position Details (Closed)'}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {item.itemType === 'transaction' ? renderTransactionDetails() :
              item.itemType === 'closedPosition' ? renderClosedPositionDetails() :
                renderOrderDetails()}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

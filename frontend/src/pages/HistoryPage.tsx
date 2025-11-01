import { useMemo, useState } from 'react';
import { useTransactionStore } from '../stores/transactionStore';
import { useOrderStore, type ExecutedOrder, type PendingOrder } from '../stores/orderStore';
import { useAccountStore, formatBalance } from '../stores/accountStore';
import type { Transaction } from '../types';

type HistoryTab = 'all' | 'trades' | 'transactions';
type HistoryItem = (Transaction | ExecutedOrder | PendingOrder) & { itemType: 'transaction' | 'executedOrder' | 'pendingOrder' };

// Helper function to format timestamp
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Helper to get status badge color
const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
    case 'active':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    case 'pending':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    case 'processing':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    case 'failed':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    default:
      return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
  }
};

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<HistoryTab>('all');
  // const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null); // TODO: Will be used for detail modal

  // Get data from stores
  const transactions = useTransactionStore(state => state.transactions);
  const executedOrders = useOrderStore(state => state.orderHistory);
  const pendingOrders = useOrderStore(state => state.pendingOrders);
  const accounts = useAccountStore(state => state.accounts);

  // Combined and sorted history
  const allHistory = useMemo<HistoryItem[]>(() => {
    const items: HistoryItem[] = [
      ...transactions.map(t => ({ ...t, itemType: 'transaction' as const })),
      ...executedOrders.map(o => ({ ...o, itemType: 'executedOrder' as const })),
      ...pendingOrders.map(o => ({ ...o, itemType: 'pendingOrder' as const })),
    ];

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, executedOrders, pendingOrders]);

  // Filter by tab
  const filteredHistory = useMemo(() => {
    switch (activeTab) {
      case 'trades':
        return allHistory.filter(item =>
          item.itemType === 'executedOrder' || item.itemType === 'pendingOrder'
        );
      case 'transactions':
        return allHistory.filter(item => item.itemType === 'transaction');
      default:
        return allHistory;
    }
  }, [activeTab, allHistory]);

  // Helper to render icon
  const renderIcon = (item: HistoryItem) => {
    if (item.itemType === 'transaction') {
      const txn = item as Transaction;
      switch (txn.type) {
        case 'deposit':
          return (
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          );
        case 'withdraw':
          return (
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </div>
          );
        case 'transfer':
          return (
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
          );
      }
    }

    if (item.itemType === 'executedOrder' || item.itemType === 'pendingOrder') {
      const order = item as ExecutedOrder | PendingOrder;
      const isBuy = order.side === 'buy';
      return (
        <div className={`w-10 h-10 rounded-full ${isBuy ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'} flex items-center justify-center`}>
          <svg className={`w-5 h-5 ${isBuy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isBuy ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"} />
          </svg>
        </div>
      );
    }

    return null;
  };

  // Helper to render description
  const renderDescription = (item: HistoryItem) => {
    if (item.itemType === 'transaction') {
      const txn = item as Transaction;
      const account = accounts.find(a => a.id === txn.accountId);

      switch (txn.type) {
        case 'deposit':
          return (
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Deposit</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {txn.metadata?.cardBrand && txn.metadata?.last4
                  ? `${txn.metadata.cardBrand.toUpperCase()} •••• ${txn.metadata.last4}`
                  : 'Card payment'}
                {account && ` → ${account.id}`}
              </p>
            </div>
          );
        case 'withdraw':
          return (
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Withdrawal</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {txn.metadata?.bankName || 'Bank'}
                {txn.metadata?.accountLast4 && ` •••• ${txn.metadata.accountLast4}`}
                {account && ` ← ${account.id}`}
              </p>
            </div>
          );
        case 'transfer':
          return (
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Transfer</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {txn.fromAccountId} → {txn.toAccountId}
              </p>
            </div>
          );
      }
    }

    if (item.itemType === 'executedOrder') {
      const order = item as ExecutedOrder;
      return (
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {order.side === 'buy' ? 'Buy' : 'Sell'} {order.symbol}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {order.amount.toFixed(6)} @ {formatBalance(order.executionPrice, 'USD')}
            {order.wasFromPending && ' (Limit Order)'}
          </p>
        </div>
      );
    }

    if (item.itemType === 'pendingOrder') {
      const order = item as PendingOrder;
      return (
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {order.side === 'buy' ? 'Buy' : 'Sell'} {order.symbol} (Pending)
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {order.amount.toFixed(6)} @ {formatBalance(order.price, 'USD')}
            {order.type === 'stop-limit' && order.stopPrice && ` (Stop: ${formatBalance(order.stopPrice, 'USD')})`}
          </p>
        </div>
      );
    }

    return null;
  };

  // Helper to render amount
  const renderAmount = (item: HistoryItem) => {
    if (item.itemType === 'transaction') {
      const txn = item as Transaction;
      const isPositive = txn.type === 'deposit';
      return (
        <div className="text-right">
          <p className={`font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isPositive ? '+' : '-'}{formatBalance(txn.amount, txn.currency)}
          </p>
        </div>
      );
    }

    if (item.itemType === 'executedOrder') {
      const order = item as ExecutedOrder;
      return (
        <div className="text-right">
          <p className={`font-semibold ${order.side === 'buy' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatBalance(order.total, 'USD')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fee: {formatBalance(order.fee, 'USD')}
          </p>
        </div>
      );
    }

    if (item.itemType === 'pendingOrder') {
      const order = item as PendingOrder;
      const estimatedTotal = order.amount * order.price;
      return (
        <div className="text-right">
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            ~{formatBalance(estimatedTotal, 'USD')}
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8 bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-61px)]">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Transaction History
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          View all your trades, deposits, withdrawals, and transfers
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-700 px-5 md:px-6 lg:px-8 pt-3">
          <nav className="flex -mb-px space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('all')}
              className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'all'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
              }`}
            >
              All ({allHistory.length})
            </button>
            <button
              onClick={() => setActiveTab('trades')}
              className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'trades'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
              }`}
            >
              Trades ({executedOrders.length + pendingOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'transactions'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
              }`}
            >
              Transactions ({transactions.length})
            </button>
          </nav>
        </div>

        {/* History List */}
        <div className="p-5 md:p-6 lg:p-8">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">No history</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {activeTab === 'trades' && 'You haven\'t made any trades yet.'}
                {activeTab === 'transactions' && 'You haven\'t made any deposits, withdrawals, or transfers yet.'}
                {activeTab === 'all' && 'Your transaction history will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item, index) => (
                <div
                  key={`${item.itemType}-${item.id}-${index}`}
                  className="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  // onClick={() => setSelectedItem(item)} // TODO: Will be used for detail modal
                >
                  {/* Icon */}
                  {renderIcon(item)}

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    {renderDescription(item)}
                  </div>

                  {/* Status (for transactions) */}
                  {item.itemType === 'transaction' && (
                    <div className="hidden sm:block">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor((item as Transaction).status)}`}>
                        {(item as Transaction).status}
                      </span>
                    </div>
                  )}

                  {/* Amount */}
                  <div className="hidden md:block">
                    {renderAmount(item)}
                  </div>

                  {/* Date */}
                  <div className="text-right">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {formatDate(item.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

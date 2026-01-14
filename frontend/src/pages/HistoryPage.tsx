import { apiFetch } from '../utils/api';
import { useMemo, useState, useEffect, useRef, memo, useCallback } from 'react';
import { useAppSelector } from '../store';
import { formatCurrency, formatAccountId } from '../utils/formatters';
import type { Transaction, TransactionStatus, TransactionType, Position } from '../types';
import type { Account } from '../store/slices/accountSlice';
import { transformTransaction, type BackendTransaction } from '../store/slices/transactionSlice';
import { type Order as ReduxOrder, type PendingOrder as ReduxPendingOrder } from '../store/slices/orderSlice';
import {
  type LegacyExecutedOrder as ExecutedOrder,
  type LegacyPendingOrder as PendingOrder,
  adaptExecutedOrder,
  adaptPendingOrder
} from '../utils/orderAdapters';
import TransactionDetailModal from '../components/TransactionDetailModal';
// import HistorySummaryCards from '../components/HistorySummaryCards'; // Replaced with inline cards to match PNG

type HistoryTab = 'all' | 'open-orders' | 'trades' | 'transactions' | 'positions' | 'demo';
type ClosedPosition = Position & { timestamp: number; itemType: 'closedPosition' };
type HistoryItem =
  | (Transaction & { itemType: 'transaction' })
  | (ExecutedOrder & { itemType: 'executedOrder' })
  | (PendingOrder & { itemType: 'pendingOrder' })
  | ClosedPosition;
type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
type DateRangeOption = 'all' | 'today' | 'week' | 'month' | 'custom';

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
    case 'rejected':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    default:
      return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
  }
};

// Export to CSV helper
const exportToCSV = (items: HistoryItem[], filename: string) => {
  const headers = ['Type', 'Number', 'Symbol', 'Side', 'Entry Price', 'Close Price', 'Lot Size', 'P&L', 'Status', 'Date'];
  const rows = items.map(item => {
    if (item.itemType === 'transaction') {
      const txn = item as Transaction;
      return [
        txn.type,
        txn.transactionNumber,
        '-',
        '-',
        '-',
        '-',
        txn.amount.toString(),
        '-',
        txn.status,
        new Date(txn.timestamp).toISOString(),
      ];
    } else if (item.itemType === 'executedOrder') {
      const order = item as ExecutedOrder;
      return [
        `${order.side} (executed)`,
        order.orderNumber || 'N/A',
        order.symbol,
        order.side,
        '-',
        '-',
        order.amount.toString(),
        '-',
        'completed',
        new Date(order.timestamp).toISOString(),
      ];
    } else if (item.itemType === 'pendingOrder') {
      const order = item as PendingOrder;
      return [
        `${order.side} (pending)`,
        order.orderNumber || 'N/A',
        order.symbol,
        order.side,
        '-',
        '-',
        order.amount.toString(),
        '-',
        'pending',
        new Date(order.timestamp).toISOString(),
      ];
    } else {
      const position = item as ClosedPosition;
      return [
        'CFD Position',
        position.contract_number,
        position.symbol,
        position.side,
        position.entry_price.toString(),
        position.close_price?.toString() || '-',
        position.lot_size.toString(),
        position.pnl?.toString() || '0',
        position.status,
        new Date(position.timestamp).toISOString(),
      ];
    }
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Memoized row component for transactions
const TransactionRow = memo(({
  transaction,
  accounts,
  onClick
}: {
  transaction: Transaction;
  accounts: Account[];
  onClick: () => void;
}) => {
  const account = accounts.find((a) => a.id === transaction.accountId);

  // Determine if transaction is positive (credit) or negative (debit)
  let isPositive = false;
  if (transaction.type === 'deposit') {
    isPositive = true;
  } else if (transaction.type === 'transfer') {
    // For transfers: "Transfer from Account X" = credit (positive), "Transfer to Account X" = debit (negative)
    isPositive = transaction.description?.includes('Transfer from') || false;
  }
  // Withdrawals are always negative (debit)

  const isDemoAdjustment = transaction.description?.includes('Demo Balance Adjustment');

  const icon = useMemo(() => {
    if (isDemoAdjustment) {
      return (
        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
      );
    }

    // Normalize transaction type (backend uses 'withdrawal', frontend uses 'withdraw')
    // Handle both 'withdraw' and 'withdrawal' types from backend
    const normalizedType: TransactionType = (transaction.type === 'withdraw' || (transaction.type as string) === 'withdrawal') ? 'withdraw' : transaction.type;

    const iconMap: Record<TransactionType, JSX.Element> = {
      deposit: (
        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      ),
      withdraw: (
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </div>
      ),
      transfer: (
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
      ),
      position_close: (
        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6" />
          </svg>
        </div>
      ),
    };

    return iconMap[normalizedType] || iconMap.deposit;
  }, [transaction.type, isDemoAdjustment]);

  const description = useMemo(() => {
    const hasRejectionReason = transaction.status === 'failed' && transaction.errorMessage;

    // Normalize transaction type (backend uses 'withdrawal', frontend uses 'withdraw')
    // Handle both 'withdraw' and potential 'withdrawal' from backend
    const txType: TransactionType = (transaction.type === 'withdraw' || (transaction.type as string) === 'withdrawal') ? 'withdraw' : transaction.type;

    switch (txType) {
      case 'deposit':
        return (
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {isDemoAdjustment ? 'Demo Adjustment' : 'Deposit'}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {(() => {
                let desc = transaction.description || '';
                // Remove outdated status text from description (status badge shows current status)
                if (desc) {
                  desc = desc
                    .replace(/\s*\(Pending Approval\)/gi, '')
                    .replace(/\s*\(Pending Review\)/gi, '')
                    .replace(/\s*\(Approved\)/gi, '')
                    .replace(/\s*\(Rejected\)/gi, '')
                    .trim();
                }
                return desc || (transaction.metadata?.cardBrand && transaction.metadata?.last4
                  ? `${transaction.metadata.cardBrand.toUpperCase()} •••• ${transaction.metadata.last4}`
                  : 'Card payment');
              })()}

              {account && ` → Account ${formatAccountId(account.account_id, account.type)}`}
            </p>
            {hasRejectionReason && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Rejected: {transaction.errorMessage}
              </p>
            )}
          </div>
        );
      case 'withdraw': {
        // Build withdrawal description
        let withdrawalDesc = transaction.description;

        // Remove outdated status text from description (status badge shows current status)
        if (withdrawalDesc) {
          withdrawalDesc = withdrawalDesc
            .replace(/\s*\(Pending Approval\)/gi, '')
            .replace(/\s*\(Pending Review\)/gi, '')
            .replace(/\s*\(Approved\)/gi, '')
            .replace(/\s*\(Rejected\)/gi, '')
            .trim();
        }

        if (!withdrawalDesc) {
          // Try to build from metadata
          if (transaction.metadata?.bankName) {
            withdrawalDesc = `${transaction.metadata.bankName}`;
            if (transaction.metadata.accountLast4) {
              withdrawalDesc += ` •••• ${transaction.metadata.accountLast4}`;
            }
          } else if (transaction.metadata?.wallet_address && typeof transaction.metadata.wallet_address === 'string') {
            const addr = transaction.metadata.wallet_address;
            withdrawalDesc = `Tron (USDT) ${addr.slice(0, 6)}...${addr.slice(-4)}`;
          } else {
            withdrawalDesc = 'Withdrawal request';
          }
        }

        // Extract withdrawal reference ID from description if present
        // Format: "Withdrawal request WTH-20251216-000009 - USD 10.00"
        const withdrawalMatch = withdrawalDesc.match(/Withdrawal request\s+([A-Z]+-\d{8}-\d+)/i);
        const referenceId = withdrawalMatch ? withdrawalMatch[1] : null;

        // Build clean description
        if (referenceId) {
          // Extract currency and amount if present in original description
          const amountMatch = withdrawalDesc.match(/(USD|EUR|GBP)\s+([\d,]+\.?\d*)/i);
          if (amountMatch) {
            withdrawalDesc = `Withdrawal ${referenceId} - ${amountMatch[1]} ${amountMatch[2]}`;
          } else {
            withdrawalDesc = `Withdrawal ${referenceId}`;
          }
        }

        // Add transaction number if available and not already included
        if (transaction.transactionNumber && !withdrawalDesc.includes(transaction.transactionNumber)) {
          withdrawalDesc = `${transaction.transactionNumber} - ${withdrawalDesc}`;
        }

        // Add account info if available
        if (account) {
          withdrawalDesc += ` ← Account ${formatAccountId(account.account_id, account.type)}`;
        }

        return (
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">Withdrawal</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {withdrawalDesc}
            </p>
            {hasRejectionReason && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Error: {transaction.errorMessage}
              </p>
            )}
          </div>
        );
      }
      case 'transfer':
        return (
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">Transfer</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {transaction.description || `${transaction.fromAccountId} → ${transaction.toAccountId}`}
            </p>
            {hasRejectionReason && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Error: {transaction.errorMessage}
              </p>
            )}
          </div>
        );
      default:
        return null;
    }
  }, [transaction, account, isDemoAdjustment]);

  return (
    <div
      className="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {icon}
      <div className="flex-1 min-w-0">{description}</div>
      <div className="hidden sm:block">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(transaction.status)}`}>
          {transaction.status}
        </span>
      </div>
      <div className="hidden md:block text-right">
        <p className={`font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {isPositive ? '+' : '-'}{formatCurrency(transaction.amount, transaction.currency)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {formatDate(transaction.timestamp)}
        </p>
      </div>
    </div>
  );
});

TransactionRow.displayName = 'TransactionRow';

// Memoized row component for executed orders
const ExecutedOrderRow = memo(({
  order,
  onClick
}: {
  order: ExecutedOrder;
  onClick: () => void;
}) => {
  const isBuy = order.side === 'buy';

  return (
    <div
      className="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className={`w-10 h-10 rounded-full ${isBuy ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'} flex items-center justify-center`}>
        <svg className={`w-5 h-5 ${isBuy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isBuy ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          {isBuy ? 'Buy' : 'Sell'} {order.symbol}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {order.amount.toFixed(6)} @ {formatCurrency(order.executionPrice, 'USD')}
          {order.wasFromPending && ' (Limit Order)'}
        </p>
      </div>
      <div className="hidden md:block text-right">
        <p className={`font-semibold ${isBuy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {formatCurrency(order.total, 'USD')}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Fee: {formatCurrency(order.fee, 'USD')}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {formatDate(order.timestamp)}
        </p>
      </div>
    </div>
  );
});

ExecutedOrderRow.displayName = 'ExecutedOrderRow';

// Memoized row component for pending orders
const PendingOrderRow = memo(({
  order,
  onClick
}: {
  order: PendingOrder;
  onClick: () => void;
}) => {
  const isBuy = order.side === 'buy';
  const estimatedTotal = order.amount * order.price;

  return (
    <div
      className="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className={`w-10 h-10 rounded-full ${isBuy ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'} flex items-center justify-center`}>
        <svg className={`w-5 h-5 ${isBuy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isBuy ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          {isBuy ? 'Buy' : 'Sell'} {order.symbol} (Pending)
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {order.amount.toFixed(6)} @ {formatCurrency(order.price, 'USD')}
          {order.type === 'stop-limit' && order.stopPrice && ` (Stop: ${formatCurrency(order.stopPrice, 'USD')})`}
        </p>
      </div>
      <div className="hidden md:block text-right">
        <p className="font-semibold text-slate-700 dark:text-slate-300">
          ~{formatCurrency(estimatedTotal, 'USD')}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {formatDate(order.timestamp)}
        </p>
      </div>
    </div>
  );
});

PendingOrderRow.displayName = 'PendingOrderRow';

// Memoized row component for closed positions
const ClosedPositionRow = memo(({
  position,
  onClick
}: {
  position: ClosedPosition;
  onClick: () => void;
}) => {
  const isLong = position.side === 'long';
  const pnl = position.pnl || 0;
  const isProfitable = pnl >= 0;

  return (
    <div
      className="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className={`w-10 h-10 rounded-full ${isProfitable ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'} flex items-center justify-center`}>
        <svg className={`w-5 h-5 ${isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isLong ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          {isLong ? 'Long' : 'Short'} {position.symbol}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {position.lot_size.toFixed(6)} @ {formatCurrency(position.entry_price, 'USD')} → {formatCurrency(position.close_price || 0, 'USD')}
        </p>
      </div>
      <div className="hidden md:block text-right">
        <p className={`font-semibold ${isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {isProfitable ? '+' : ''}{formatCurrency(pnl, 'USD')}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          P&L
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {formatDate(position.timestamp)}
        </p>
      </div>
    </div>
  );
});

ClosedPositionRow.displayName = 'ClosedPositionRow';

export default function HistoryPage() {
  // State
  const [activeTab, setActiveTab] = useState<HistoryTab>('all');
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [dateRange, setDateRange] = useState<DateRangeOption>('all');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [showFilters, setShowFilters] = useState(false);

  // Batch history data state (from new batch endpoint)
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reduxExecutedOrders, setReduxExecutedOrders] = useState<ReduxOrder[]>([]);
  const [reduxPendingOrders, setReduxPendingOrders] = useState<ReduxPendingOrder[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]); // Live accounts only
  const [demoClosedPositions, setDemoClosedPositions] = useState<Position[]>([]); // Demo accounts only
  const isFetchingRef = useRef(false);

  // Get data from Redux stores
  const accounts = useAppSelector((state) => state.account.accounts);
  const authToken = useAppSelector((state) => state.auth.token);

  // Transform Redux orders to legacy format using adapters
  const executedOrders = useMemo(() => {
    return reduxExecutedOrders.map(adaptExecutedOrder);
  }, [reduxExecutedOrders]);

  const pendingOrders = useMemo(() => {
    return reduxPendingOrders.map(adaptPendingOrder);
  }, [reduxPendingOrders]);

  // Get all live accounts
  const liveAccounts = useMemo(() => {
    return accounts.filter((acc) => acc.type === 'live');
  }, [accounts]);

  // Get all demo accounts
  const demoAccounts = useMemo(() => {
    return accounts.filter((acc) => acc.type === 'demo');
  }, [accounts]);

  // Fetch batch history data (transactions + orders + pending orders) in a single API call
  const fetchBatchHistory = useCallback(async () => {
    // Guard against no accounts or no auth token
    if (liveAccounts.length === 0 || !authToken) return;

    // Prevent concurrent fetches using ref
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;

    try {
      const response = await apiFetch('api/v1/history', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch batch history:', response.statusText);
        return;
      }

      const data = await response.json();

      // Update local state with batch data
      if (data.success) {
        // Transform backend transactions to frontend format
        const transformedTransactions = (data.transactions || []).map((txn: BackendTransaction) =>
          transformTransaction(txn)
        );
        setTransactions(transformedTransactions);
        setReduxExecutedOrders(data.orders || []);
        setReduxPendingOrders(data.pending_orders || []);
      }
    } catch (error) {
      console.error('Error fetching batch history:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [liveAccounts.length, authToken]);

  useEffect(() => {
    fetchBatchHistory();
  }, [fetchBatchHistory]);

  // Auto-refresh pending orders every 10 seconds when on open-orders or all tab
  useEffect(() => {
    // Only auto-refresh if we're on a tab that shows pending orders
    if (activeTab !== 'open-orders' && activeTab !== 'all') return;

    const intervalId = setInterval(() => {
      fetchBatchHistory();
    }, 10000); // 10 seconds

    return () => clearInterval(intervalId);
  }, [activeTab, fetchBatchHistory]);

  // Fetch closed positions history
  useEffect(() => {
    const fetchClosedPositions = async () => {
      if (liveAccounts.length === 0 || !authToken) return;

      try {
        // Fetch closed positions for all live accounts
        const positionsPromises = liveAccounts.map(async (account) => {
          const response = await apiFetch(`api/v1/contracts/history?account_id=${account.id}`, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
            },
          });

          if (!response.ok) {
            console.error(`Failed to fetch closed positions for account ${account.account_id || account.id}`);
            return { contracts: [], total_pnl: 0 };
          }

          const data = await response.json();
          return data;
        });

        const results = await Promise.all(positionsPromises);

        // Combine all closed positions from all accounts
        const allClosedPositions = results.flatMap(result => result.contracts || []);

        setClosedPositions(allClosedPositions);
      } catch (error) {
        console.error('Error fetching closed positions:', error);
      }
    };

    fetchClosedPositions();
  }, [liveAccounts, authToken]);

  // Fetch demo closed positions history
  useEffect(() => {
    const fetchDemoClosedPositions = async () => {
      if (demoAccounts.length === 0 || !authToken) return;

      try {
        // Fetch closed positions for all demo accounts
        const positionsPromises = demoAccounts.map(async (account) => {
          const response = await apiFetch(`api/v1/contracts/history?account_id=${account.id}`, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
            },
          });

          if (!response.ok) {
            console.error(`Failed to fetch demo closed positions for account ${account.account_id || account.id}`);
            return { contracts: [], total_pnl: 0 };
          }

          const data = await response.json();
          return data;
        });

        const results = await Promise.all(positionsPromises);

        // Combine all demo closed positions from all accounts
        const allDemoClosedPositions = results.flatMap(result => result.contracts || []);

        setDemoClosedPositions(allDemoClosedPositions);
      } catch (error) {
        console.error('Error fetching demo closed positions:', error);
      }
    };

    fetchDemoClosedPositions();
  }, [demoAccounts, authToken]);

  // Combined and sorted history
  const allHistory = useMemo<HistoryItem[]>(() => {
    // Get live account IDs for filtering (use both id and account_id for matching)
    const liveAccountIds = new Set(liveAccounts.map(acc => acc.id));
    const liveAccountIdsByAccountId = new Set(liveAccounts.map(acc => acc.account_id?.toString()));

    // Filter out position_close transactions as they're already shown as closed positions
    // Also filter to only show live account transactions
    // Include transfers even if account ID doesn't match (they might be for accounts not yet loaded)
    const filteredTransactions = transactions.filter(t => {
      if (t.type === 'position_close') return false;

      // For transfers, be very lenient - transfers are always between user's own accounts
      // So if we have any live accounts, show all transfers (they belong to this user)
      // This fixes the issue where transfers don't show up if account IDs don't match exactly
      if (t.type === 'transfer') {
        // If we have live accounts, show all transfers (they're always user's own accounts)
        // Only filter out if we have no live accounts at all (edge case)
        if (liveAccounts.length > 0) {
          return true; // Show all transfers for users with live accounts
        }
        // Fallback: try to match account IDs if no live accounts (shouldn't happen normally)
        return liveAccountIds.has(t.accountId) ||
          liveAccountIdsByAccountId.has(t.accountId) ||
          (t.targetAccountId && (liveAccountIds.has(t.targetAccountId) || liveAccountIdsByAccountId.has(t.targetAccountId)));
      }

      // For other transaction types, require exact account ID match
      return liveAccountIds.has(t.accountId) || liveAccountIdsByAccountId.has(t.accountId);
    });

    // Filter out CFD/Futures executed orders since they're shown as contracts
    // Only show Spot product orders in the history
    // Also filter to only show live account orders
    const filteredExecutedOrders = executedOrders.filter((o) => {
      // Check if order has a product_type field
      // If product_type is 'cfd' or 'futures', filter it out (shown as contracts instead)
      // Keep spot orders and orders without product_type
      const orderWithProductType = o as ExecutedOrder & { product_type?: string };
      const isSpot = !orderWithProductType.product_type || orderWithProductType.product_type === 'spot';
      const isLiveAccount = liveAccountIds.has(o.accountId);
      return isSpot && isLiveAccount;
    });

    // Filter pending orders to only show live account orders
    const filteredPendingOrders = pendingOrders.filter((o) => liveAccountIds.has(o.accountId));

    const items: HistoryItem[] = [
      ...filteredTransactions.map((t) => ({ ...t, itemType: 'transaction' as const })),
      ...filteredExecutedOrders.map((o) => ({ ...o, itemType: 'executedOrder' as const })),
      ...filteredPendingOrders.map((o) => ({ ...o, itemType: 'pendingOrder' as const })),
      ...closedPositions.map((p) => ({
        ...p,
        timestamp: p.closed_at ? new Date(p.closed_at).getTime() : new Date(p.created_at).getTime(),
        itemType: 'closedPosition' as const
      })),
    ];

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, executedOrders, pendingOrders, closedPositions, liveAccounts]);

  // Combined demo account history (trades, open orders, positions - no wallet transactions)
  const demoHistory = useMemo<HistoryItem[]>(() => {
    // Get demo account IDs for filtering
    const demoAccountIds = new Set(demoAccounts.map(acc => acc.id));

    // Filter executed orders for demo accounts (only spot orders)
    const demoExecutedOrders = executedOrders.filter((o) => {
      const orderWithProductType = o as ExecutedOrder & { product_type?: string };
      const isSpot = !orderWithProductType.product_type || orderWithProductType.product_type === 'spot';
      const isDemoAccount = demoAccountIds.has(o.accountId);
      return isSpot && isDemoAccount;
    });

    // Filter pending orders for demo accounts
    const demoPendingOrders = pendingOrders.filter((o) => demoAccountIds.has(o.accountId));

    const items: HistoryItem[] = [
      // No transactions (wallet) for demo accounts
      ...demoExecutedOrders.map((o) => ({ ...o, itemType: 'executedOrder' as const })),
      ...demoPendingOrders.map((o) => ({ ...o, itemType: 'pendingOrder' as const })),
      ...demoClosedPositions.map((p) => ({
        ...p,
        timestamp: p.closed_at ? new Date(p.closed_at).getTime() : new Date(p.created_at).getTime(),
        itemType: 'closedPosition' as const
      })),
    ];

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [executedOrders, pendingOrders, demoClosedPositions, demoAccounts]);

  // Calculate accurate tab counts
  const tabCounts = useMemo(() => {
    // For 'all' tab, exclude pending orders since they have their own tab
    const allWithoutPending = allHistory.filter(item => item.itemType !== 'pendingOrder');

    // Count from allHistory to ensure we only count live account items
    const openOrdersCount = allHistory.filter(item => item.itemType === 'pendingOrder').length;
    const tradesCount = allHistory.filter(item => item.itemType === 'executedOrder').length;
    const transactionsCount = allHistory.filter(item => item.itemType === 'transaction').length;
    const positionsCount = allHistory.filter(item => item.itemType === 'closedPosition').length;

    return {
      all: allWithoutPending.length,
      openOrders: openOrdersCount,
      trades: tradesCount,
      transactions: transactionsCount,
      positions: positionsCount,
      demo: demoHistory.length,
    };
  }, [allHistory, demoHistory.length]);

  // Filter by tab
  const tabFilteredHistory = useMemo(() => {
    switch (activeTab) {
      case 'open-orders':
        return allHistory.filter(item => item.itemType === 'pendingOrder');
      case 'trades':
        return allHistory.filter(item => item.itemType === 'executedOrder');
      case 'transactions':
        return allHistory.filter(item => item.itemType === 'transaction');
      case 'positions':
        return allHistory.filter(item => item.itemType === 'closedPosition');
      case 'demo':
        // Show demo account trades, open orders, and positions (no wallet transactions)
        return demoHistory;
      case 'all':
        // Exclude pending orders from 'all' tab since they have their own 'Open Orders' tab
        return allHistory.filter(item => item.itemType !== 'pendingOrder');
      default:
        return allHistory;
    }
  }, [activeTab, allHistory, demoHistory]);

  // Apply all filters
  const filteredHistory = useMemo(() => {
    let filtered = [...tabFilteredHistory];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        if (item.itemType === 'transaction') {
          const txn = item as Transaction;
          return txn.transactionNumber.toLowerCase().includes(query) ||
            txn.type.includes(query) ||
            txn.amount.toString().includes(query) ||
            txn.accountId.toString().includes(query);
        } else if (item.itemType === 'executedOrder') {
          const order = item as ExecutedOrder;
          return (order.orderNumber && order.orderNumber.toLowerCase().includes(query)) ||
            order.symbol.toLowerCase().includes(query) ||
            order.amount.toString().includes(query);
        } else if (item.itemType === 'pendingOrder') {
          const order = item as PendingOrder;
          return (order.orderNumber && order.orderNumber.toLowerCase().includes(query)) ||
            order.symbol.toLowerCase().includes(query) ||
            order.amount.toString().includes(query);
        } else {
          const position = item as ClosedPosition;
          return position.contract_number.toLowerCase().includes(query) ||
            position.symbol.toLowerCase().includes(query) ||
            position.side.toLowerCase().includes(query) ||
            (position.pnl && position.pnl.toString().includes(query));
        }
      });
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      if (dateRange === 'today') {
        const startOfDay = new Date().setHours(0, 0, 0, 0);
        filtered = filtered.filter(item => item.timestamp >= startOfDay);
      } else if (dateRange === 'week') {
        filtered = filtered.filter(item => item.timestamp >= now - (7 * oneDayMs));
      } else if (dateRange === 'month') {
        filtered = filtered.filter(item => item.timestamp >= now - (30 * oneDayMs));
      } else if (dateRange === 'custom' && customDateStart && customDateEnd) {
        const start = new Date(customDateStart).getTime();
        const end = new Date(customDateEnd).setHours(23, 59, 59, 999);
        filtered = filtered.filter(item => item.timestamp >= start && item.timestamp <= end);
      }
    }

    // Status filter (only for transactions)
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => {
        if (item.itemType === 'transaction') {
          return (item as Transaction).status === statusFilter;
        }
        return true; // Keep all orders when status filter is active
      });
    }

    // Type filter (only for transactions)
    if (typeFilter !== 'all') {
      filtered = filtered.filter(item => {
        if (item.itemType === 'transaction') {
          return (item as Transaction).type === typeFilter;
        }
        return false; // Exclude orders when type filter is active
      });
    }

    // Amount range filter
    const min = parseFloat(minAmount);
    const max = parseFloat(maxAmount);
    if (!isNaN(min) || !isNaN(max)) {
      filtered = filtered.filter(item => {
        let amount = 0;
        if (item.itemType === 'transaction') {
          amount = (item as Transaction).amount;
        } else if (item.itemType === 'executedOrder') {
          amount = (item as ExecutedOrder).total;
        } else if (item.itemType === 'pendingOrder') {
          amount = (item as PendingOrder).amount * (item as PendingOrder).price;
        } else {
          amount = Math.abs((item as ClosedPosition).pnl || 0);
        }

        if (!isNaN(min) && amount < min) return false;
        if (!isNaN(max) && amount > max) return false;
        return true;
      });
    }

    return filtered;
  }, [tabFilteredHistory, searchQuery, dateRange, customDateStart, customDateEnd, statusFilter, typeFilter, minAmount, maxAmount]);

  // Sort filtered history
  const sortedHistory = useMemo(() => {
    const sorted = [...filteredHistory];

    switch (sortOption) {
      case 'date-desc':
        return sorted.sort((a, b) => b.timestamp - a.timestamp);
      case 'date-asc':
        return sorted.sort((a, b) => a.timestamp - b.timestamp);
      case 'amount-desc':
        return sorted.sort((a, b) => {
          const amountA = a.itemType === 'transaction' ? (a as Transaction).amount :
            a.itemType === 'executedOrder' ? (a as ExecutedOrder).total :
              a.itemType === 'pendingOrder' ? (a as PendingOrder).amount * (a as PendingOrder).price :
                Math.abs((a as ClosedPosition).pnl || 0);
          const amountB = b.itemType === 'transaction' ? (b as Transaction).amount :
            b.itemType === 'executedOrder' ? (b as ExecutedOrder).total :
              b.itemType === 'pendingOrder' ? (b as PendingOrder).amount * (b as PendingOrder).price :
                Math.abs((b as ClosedPosition).pnl || 0);
          return amountB - amountA;
        });
      case 'amount-asc':
        return sorted.sort((a, b) => {
          const amountA = a.itemType === 'transaction' ? (a as Transaction).amount :
            a.itemType === 'executedOrder' ? (a as ExecutedOrder).total :
              a.itemType === 'pendingOrder' ? (a as PendingOrder).amount * (a as PendingOrder).price :
                Math.abs((a as ClosedPosition).pnl || 0);
          const amountB = b.itemType === 'transaction' ? (b as Transaction).amount :
            b.itemType === 'executedOrder' ? (b as ExecutedOrder).total :
              b.itemType === 'pendingOrder' ? (b as PendingOrder).amount * (b as PendingOrder).price :
                Math.abs((b as ClosedPosition).pnl || 0);
          return amountA - amountB;
        });
      default:
        return sorted;
    }
  }, [filteredHistory, sortOption]);

  // Pagination
  const totalPages = Math.ceil(sortedHistory.length / itemsPerPage);
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return sortedHistory.slice(start, end);
  }, [sortedHistory, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateRange, statusFilter, typeFilter, minAmount, maxAmount, activeTab]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setDateRange('all');
    setCustomDateStart('');
    setCustomDateEnd('');
    setStatusFilter('all');
    setTypeFilter('all');
    setMinAmount('');
    setMaxAmount('');
    setSortOption('date-desc');
  }, []);


  // Memoized click handlers
  const handleItemClick = useCallback((item: HistoryItem) => {
    setSelectedItem(item);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedItem(null);
  }, []);

  const handleExportCSV = useCallback(() => {
    exportToCSV(sortedHistory, `transaction-history-${Date.now()}.csv`);
  }, [sortedHistory]);

  // Stats for Summary Cards (matching PNG)
  const cardStats = useMemo(() => {
    const totalTxn = tabCounts.all; // or use transactions.length if specifically for wallet

    const totalDeposited = transactions
      .filter(t => t.type === 'deposit' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalWithdrawn = transactions
      .filter(t => {
        const isWithdraw = t.type === 'withdraw' || (t.type as string) === 'withdrawal';
        const statusStr = t.status as string;
        const isCompleted = t.status === 'completed' || statusStr === 'approved';
        return isWithdraw && isCompleted;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Pending items count (from pending orders + pending transactions)
    const pendingTxn = transactions.filter(t => t.status === 'pending').length;
    const pendingOrdersCount = tabCounts.openOrders;
    const totalPending = pendingTxn + pendingOrdersCount;

    return {
      totalTxn,
      totalDeposited,
      totalWithdrawn,
      totalPending
    };
  }, [transactions, tabCounts]);

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-61px)]">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Transaction History
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          View and manage all your trades, deposits, withdrawals, and transfers
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Vertical Summary Cards (Matching PNG) */}
        <div className="space-y-4">
          {/* Card 1: Total Transactions */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Transactions</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{cardStats.totalTxn}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
          </div>

          {/* Card 2: Total Deposited */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Deposited</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(cardStats.totalDeposited, 'USD')}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </div>
          </div>

          {/* Card 3: Total Withdrawn */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Withdrawn</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(cardStats.totalWithdrawn, 'USD')}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
            </div>
          </div>

          {/* Card 4: Pending */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{cardStats.totalPending}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
        </div>

        {/* Right Column: Main Panel with Tabs & List */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 h-fit">

          {/* Top Toolbar: Search & Actions */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input
                type="text"
                placeholder="Search instruments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-1/2 sm:w-auto"
              >
                <svg className="w-4 h-4 mr-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                Filters
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#00C0A2] hover:bg-[#00a085] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-1/2 sm:w-auto"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export CSV
              </button>
            </div>
          </div>

          {/* Filter Expansion (conditionally rendered) */}
          {showFilters && (
            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Reused filter logic from previous code */}
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Date Range</label>
                <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangeOption)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-sm"><option value="all">All Time</option><option value="today">Today</option><option value="week">Last 7 Days</option><option value="month">Last 30 Days</option></select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | 'all')} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-sm"><option value="all">All Statuses</option><option value="completed">Completed</option><option value="pending">Pending</option></select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Type</label>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'all')} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-sm"><option value="all">All Types</option><option value="deposit">Deposits</option><option value="withdraw">Withdrawals</option></select>
              </div>
              <div className="flex items-end">
                <button onClick={clearFilters} className="text-sm text-indigo-600 hover:text-indigo-800">Clear Filters</button>
              </div>
            </div>
          )}

          {/* Tabs Navigation (Border Bottom Style) */}
          <div className="border-b border-slate-200 dark:border-slate-800 overflow-x-auto hide-scrollbar">
            <nav className="flex -mb-px min-w-max" aria-label="Tabs">
              {[
                { id: 'all', label: 'All', count: tabCounts.all },
                { id: 'trades', label: 'Trades', count: tabCounts.trades },
                { id: 'transactions', label: 'Transactions', count: tabCounts.transactions },
                { id: 'positions', label: 'Positions', count: tabCounts.positions },
                { id: 'open-orders', label: 'Open Orders', count: tabCounts.openOrders },
                { id: 'demo', label: 'Demo', count: tabCounts.demo },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as HistoryTab)}
                  className={`whitespace-nowrap py-4 px-3 md:px-6 border-b-2 font-medium text-xs sm:text-sm transition-colors ${activeTab === tab.id
                    ? 'border-[#00C0A2] text-[#00C0A2] dark:text-[#00C0A2]'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content / List */}
          <div className="min-h-[400px]">
            {paginatedHistory.length === 0 ? (
              /* Empty State Matching PNG */
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <div className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No history yet</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Your transaction history will appear here.</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {paginatedHistory.map((item, index) => {
                  const key = `${item.itemType}-${item.id}-${index}`;
                  if (item.itemType === 'transaction') return <TransactionRow key={key} transaction={item as Transaction} accounts={accounts} onClick={() => handleItemClick(item)} />;
                  if (item.itemType === 'executedOrder') return <ExecutedOrderRow key={key} order={item as ExecutedOrder} onClick={() => handleItemClick(item)} />;
                  if (item.itemType === 'pendingOrder') return <PendingOrderRow key={key} order={item as PendingOrder} onClick={() => handleItemClick(item)} />;
                  return <ClosedPositionRow key={key} position={item as ClosedPosition} onClick={() => handleItemClick(item)} />;
                })}

                {/* Pagination Logic preserved inside the panel */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-sm text-slate-500">Page {currentPage} of {totalPages}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded text-sm hover:bg-slate-50 disabled:opacity-50">Prev</button>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded text-sm hover:bg-slate-50 disabled:opacity-50">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedItem && (
        <TransactionDetailModal
          item={selectedItem}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
import { apiFetch } from '../utils/api';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useAppSelector } from '../store';
import { formatCurrency } from '../utils/formatters';
import type { Transaction, TransactionStatus, TransactionType, Position } from '../types';
import { transformTransaction, type BackendTransaction } from '../store/slices/transactionSlice';
import { type Order as ReduxOrder, type PendingOrder as ReduxPendingOrder } from '../store/slices/orderSlice';
import {
  type LegacyExecutedOrder as ExecutedOrder,
  type LegacyPendingOrder as PendingOrder,
  adaptExecutedOrder,
  adaptPendingOrder
} from '../utils/orderAdapters';
import TransactionDetailModal from '../components/TransactionDetailModal';
import HistorySummaryCards from '../components/HistorySummaryCards';

type HistoryTab = 'all' | 'trades' | 'transactions' | 'positions';
type ClosedPosition = Position & { timestamp: number; itemType: 'closedPosition' };
type HistoryItem = 
  | (Transaction & { itemType: 'transaction' })
  | (ExecutedOrder & { itemType: 'executedOrder' })
  | (PendingOrder & { itemType: 'pendingOrder' })
  | ClosedPosition;
type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
type DateRangeOption = 'all' | 'today' | 'week' | 'month' | 'custom';

// Helper to get timestamp from different item types
const getItemTimestamp = (item: HistoryItem): number => {
  // All item types (Transaction, ExecutedOrder, PendingOrder, ClosedPosition) now have timestamp
  return item.timestamp;
};

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
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [showFilters, setShowFilters] = useState(false);

  // Batch history data state (from new batch endpoint)
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reduxExecutedOrders, setReduxExecutedOrders] = useState<ReduxOrder[]>([]);
  const [reduxPendingOrders, setReduxPendingOrders] = useState<ReduxPendingOrder[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
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

  // Fetch batch history data (transactions + orders + pending orders) in a single API call
  useEffect(() => {
    const fetchBatchHistory = async () => {
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
    };

    fetchBatchHistory();
  }, [liveAccounts.length, authToken]);

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

  // Combined and sorted history
  const allHistory = useMemo<HistoryItem[]>(() => {
    const items: HistoryItem[] = [
      ...transactions.map((t) => ({ ...t, itemType: 'transaction' as const })),
      ...executedOrders.map((o) => ({ ...o, itemType: 'executedOrder' as const })),
      ...pendingOrders.map((o) => ({ ...o, itemType: 'pendingOrder' as const })),
      ...closedPositions.map((p) => ({
        ...p,
        timestamp: p.closed_at ? new Date(p.closed_at).getTime() : new Date(p.created_at).getTime(),
        itemType: 'closedPosition' as const
      })),
    ];

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, executedOrders, pendingOrders, closedPositions]);

  // Filter by tab
  const tabFilteredHistory = useMemo(() => {
    switch (activeTab) {
      case 'trades':
        return allHistory.filter(item =>
          item.itemType === 'executedOrder' || item.itemType === 'pendingOrder'
        );
      case 'transactions':
        return allHistory.filter(item => item.itemType === 'transaction');
      case 'positions':
        return allHistory.filter(item => item.itemType === 'closedPosition');
      default:
        return allHistory;
    }
  }, [activeTab, allHistory]);

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
                 txn.accountId.toLowerCase().includes(query);
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
        } else {
          amount = (item as PendingOrder).amount * (item as PendingOrder).price;
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
                          (a as PendingOrder).amount * (a as PendingOrder).price;
          const amountB = b.itemType === 'transaction' ? (b as Transaction).amount :
                          b.itemType === 'executedOrder' ? (b as ExecutedOrder).total :
                          (b as PendingOrder).amount * (b as PendingOrder).price;
          return amountB - amountA;
        });
      case 'amount-asc':
        return sorted.sort((a, b) => {
          const amountA = a.itemType === 'transaction' ? (a as Transaction).amount :
                          a.itemType === 'executedOrder' ? (a as ExecutedOrder).total :
                          (a as PendingOrder).amount * (a as PendingOrder).price;
          const amountB = b.itemType === 'transaction' ? (b as Transaction).amount :
                          b.itemType === 'executedOrder' ? (b as ExecutedOrder).total :
                          (b as PendingOrder).amount * (b as PendingOrder).price;
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
  const clearFilters = () => {
    setSearchQuery('');
    setDateRange('all');
    setCustomDateStart('');
    setCustomDateEnd('');
    setStatusFilter('all');
    setTypeFilter('all');
    setMinAmount('');
    setMaxAmount('');
    setSortOption('date-desc');
  };

  // Check if any filters are active
  const hasActiveFilters = searchQuery || dateRange !== 'all' || statusFilter !== 'all' ||
                           typeFilter !== 'all' || minAmount || maxAmount;

  // Helper to render icon
  const renderIcon = (item: HistoryItem) => {
    if (item.itemType === 'transaction') {
      const txn = item as Transaction;

      // Special icon for demo adjustments
      if (txn.description?.includes('Demo Balance Adjustment')) {
        return (
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
        );
      }

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
      const account = accounts.find((a) => a.id === txn.accountId);

      switch (txn.type) {
        case 'deposit':
          return (
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {txn.description?.includes('Demo Balance Adjustment') ? 'Demo Adjustment' : 'Deposit'}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {txn.description || (txn.metadata?.cardBrand && txn.metadata?.last4
                  ? `${txn.metadata.cardBrand.toUpperCase()} •••• ${txn.metadata.last4}`
                  : 'Card payment')}
                {!txn.description && account && ` → Account ${account.account_id}`}
              </p>
            </div>
          );
        case 'withdraw':
          return (
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Withdrawal</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {txn.description || (txn.metadata?.bankName || 'Bank')}
                {!txn.description && txn.metadata?.accountLast4 && ` •••• ${txn.metadata.accountLast4}`}
                {!txn.description && account && ` ← Account ${account.account_id}`}
              </p>
            </div>
          );
        case 'transfer':
          return (
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Transfer</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {txn.description || `${txn.fromAccountId} → ${txn.toAccountId}`}
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
            {order.amount.toFixed(6)} @ {formatCurrency(order.executionPrice, 'USD')}
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
            {order.amount.toFixed(6)} @ {formatCurrency(order.price, 'USD')}
            {order.type === 'stop-limit' && order.stopPrice && ` (Stop: ${formatCurrency(order.stopPrice, 'USD')})`}
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
            {isPositive ? '+' : '-'}{formatCurrency(txn.amount, txn.currency)}
          </p>
        </div>
      );
    }

    if (item.itemType === 'executedOrder') {
      const order = item as ExecutedOrder;
      return (
        <div className="text-right">
          <p className={`font-semibold ${order.side === 'buy' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(order.total, 'USD')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fee: {formatCurrency(order.fee, 'USD')}
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
            ~{formatCurrency(estimatedTotal, 'USD')}
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="px-4 pb-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8 bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-61px)]">
      {/* Page Header */}
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Transaction History
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          View and manage all your trades, deposits, withdrawals, and transfers
        </p>
      </div>

      {/* Summary Cards */}
      <HistorySummaryCards transactions={transactions} totalItems={allHistory.length} />

      {/* Search and Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by symbol, ID, amount, or account..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <svg className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-md transition-colors flex items-center gap-2 ${
              showFilters
                ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                !
              </span>
            )}
          </button>

          {/* Export Button */}
          <button
            onClick={() => exportToCSV(sortedHistory, `transaction-history-${Date.now()}.csv`)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | 'all')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'all')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Types</option>
                  <option value="deposit">Deposits</option>
                  <option value="withdraw">Withdrawals</option>
                  <option value="transfer">Transfers</option>
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Sort By
                </label>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="date-desc">Date (Newest)</option>
                  <option value="date-asc">Date (Oldest)</option>
                  <option value="amount-desc">Amount (High to Low)</option>
                  <option value="amount-asc">Amount (Low to High)</option>
                </select>
              </div>
            </div>

            {/* Custom Date Range */}
            {dateRange === 'custom' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customDateStart}
                    onChange={(e) => setCustomDateStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customDateEnd}
                    onChange={(e) => setCustomDateEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Amount Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Min Amount
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Max Amount
                </label>
                <input
                  type="number"
                  placeholder="10000.00"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}
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
            <button
              onClick={() => setActiveTab('positions')}
              className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'positions'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
              }`}
            >
              Positions ({closedPositions.length})
            </button>
          </nav>
        </div>

        {/* History List */}
        <div className="p-5 md:p-6 lg:p-8">
          {liveAccounts.length === 0 ? (
            <div className="text-center py-16">
              <svg className="mx-auto h-16 w-16 text-purple-400 dark:text-purple-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                No Live Accounts
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-2">
                Transaction history shows only <span className="font-semibold">Live Account</span> transactions.
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                Demo account transactions are not tracked. Create a Live Account to see real transaction history.
              </p>
            </div>
          ) : paginatedHistory.length === 0 ? (
            <div className="text-center py-16">
              <svg className="mx-auto h-16 w-16 text-slate-400 dark:text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                {hasActiveFilters ? 'No results found' : 'No history yet'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                {hasActiveFilters
                  ? 'Try adjusting your filters to see more results'
                  : activeTab === 'trades'
                    ? "You haven't made any trades yet. Start trading to see your order history here."
                    : activeTab === 'transactions'
                      ? "You haven't made any deposits, withdrawals, or transfers yet."
                      : 'Your transaction history will appear here.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedHistory.map((item, index) => (
                  <div
                    key={`${item.itemType}-${item.id}-${index}`}
                    className="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedItem(item)}
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
                        {formatDate(getItemTimestamp(item))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Items per page */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-600 dark:text-slate-400">Items per page:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  {/* Page info */}
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedHistory.length)} of {sortedHistory.length} results
                  </div>

                  {/* Page navigation */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 rounded-md transition-colors ${
                              currentPage === pageNum
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedItem && (
        <TransactionDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

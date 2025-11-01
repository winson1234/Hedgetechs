import { formatBalance } from '../stores/accountStore';
import type { Transaction } from '../types';

interface HistorySummaryCardsProps {
  transactions: Transaction[];
  totalItems: number;
}

export default function HistorySummaryCards({ transactions, totalItems }: HistorySummaryCardsProps) {
  // Calculate statistics
  const stats = transactions.reduce(
    (acc, txn) => {
      if (txn.type === 'deposit' && txn.status === 'completed') {
        acc.totalDeposited += txn.amount;
      }
      if (txn.type === 'withdraw' && txn.status === 'completed') {
        acc.totalWithdrawn += txn.amount;
      }
      if (txn.status === 'pending' || txn.status === 'processing') {
        acc.pendingCount += 1;
      }
      return acc;
    },
    { totalDeposited: 0, totalWithdrawn: 0, pendingCount: 0 }
  );

  const cards = [
    {
      title: 'Total Transactions',
      value: totalItems.toString(),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Total Deposited',
      value: formatBalance(stats.totalDeposited, 'USD'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    },
    {
      title: 'Total Withdrawn',
      value: formatBalance(stats.totalWithdrawn, 'USD'),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      ),
      color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    },
    {
      title: 'Pending',
      value: stats.pendingCount.toString(),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{card.title}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{card.value}</p>
            </div>
            <div className={`p-3 rounded-lg ${card.color}`}>
              {card.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

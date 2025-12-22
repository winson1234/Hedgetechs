import { useState } from 'react';
import { formatBalance, formatAccountId } from '../../utils/formatters';
import LiveAccountDetailModal from './LiveAccountDetailModal';

interface LiveAccountCardProps {
  account: {
    id: string;
    account_id: number;
    type: 'live';
    currency: string;
    balances: Array<{ currency: string; amount: number }>;
    nickname?: string | null;
    status: 'active' | 'deactivated' | 'suspended';
  };
  isActive?: boolean;
  className?: string;
}

export default function LiveAccountCard({ account, isActive = false, className = '' }: LiveAccountCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get main balance (base currency)
  const mainBalance = account.balances.find(b => b.currency === account.currency)?.amount || 0;
  
  // Calculate total USD value (USD + USDT)
  const usdBalance = (account.balances.find(b => b.currency === 'USD')?.amount || 0) +
                     (account.balances.find(b => b.currency === 'USDT')?.amount || 0);

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className={`relative p-5 rounded-lg border-2 transition-all cursor-pointer hover:shadow-lg ${
          isActive
            ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-500/50'
            : 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 hover:border-indigo-300 dark:hover:border-indigo-700'
        } ${className}`}
      >
        {/* Header with badges */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2.5 py-1 rounded uppercase tracking-wider">
              Live
            </span>
            {isActive && (
              <span className="text-xs font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Active
              </span>
            )}
            {account.status !== 'active' && (
              <span className="text-xs font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 px-2.5 py-1 rounded uppercase tracking-wider">
                {account.status}
              </span>
            )}
          </div>
        </div>

        {/* Account ID */}
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          {account.nickname || `Account ${formatAccountId(account.account_id, 'live')}`}
        </p>

        {/* Balance Display */}
        <div className="space-y-2">
          <div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
              {account.currency} Balance
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatBalance(mainBalance, account.currency)}
            </p>
          </div>
          
          {account.currency !== 'USD' && usdBalance > 0 && (
            <div className="pt-2 border-t border-indigo-200 dark:border-indigo-800">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                USD Equivalent
              </p>
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                {formatBalance(usdBalance, 'USD')}
              </p>
            </div>
          )}
        </div>

        {/* View Details Hint */}
        <div className="mt-4 pt-3 border-t border-indigo-200 dark:border-indigo-800">
          <p className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Click to view details
          </p>
        </div>
      </div>

      {/* Detail Modal */}
      <LiveAccountDetailModal
        account={account}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

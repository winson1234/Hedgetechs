import { formatBalance, formatAccountId, formatDate } from '../../utils/formatters';

interface DemoAccountDetailModalProps {
  account: {
    id: string;
    account_id: number;
    type: 'demo';
    currency: string;
    balances: Array<{ currency: string; amount: number }>;
    nickname?: string | null;
    status: 'active' | 'deactivated' | 'suspended';
    created_at?: string;
    product_type?: 'spot' | 'cfd' | 'futures';
  };
  isOpen: boolean;
  onClose: () => void;
}

export default function DemoAccountDetailModal({
  account,
  isOpen,
  onClose,
}: DemoAccountDetailModalProps) {
  if (!isOpen) return null;

  // Get all balances
  const mainBalance = account.balances.find(b => b.currency === account.currency)?.amount || 0;
  const usdBalance = account.balances.find(b => b.currency === 'USD')?.amount || 0;
  const usdtBalance = account.balances.find(b => b.currency === 'USDT')?.amount || 0;
  const otherBalances = account.balances.filter(
    b => b.currency !== account.currency && b.currency !== 'USD' && b.currency !== 'USDT' && b.amount > 0
  );

  // Calculate total USD value
  const totalUSD = usdBalance + usdtBalance;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Demo Account Details
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {account.nickname || `Account ${formatAccountId(account.account_id, 'demo')}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Demo Account Notice */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-1">
                  Paper Trading Account
                </p>
                <p className="text-xs text-green-700 dark:text-green-400">
                  This is a demo account for practice trading. No real money is involved. All trades and balances are simulated.
                </p>
              </div>
            </div>
          </div>

          {/* Account Info Section */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Account ID</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {formatAccountId(account.account_id, 'demo')}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Account Type</p>
                <span className="inline-block text-xs font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded uppercase">
                  Demo
                </span>
              </div>
              {account.product_type && (
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Product Type</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                    {account.product_type}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Status</p>
                <span className={`inline-block text-xs font-bold px-2 py-1 rounded uppercase ${
                  account.status === 'active'
                    ? 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50'
                    : 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50'
                }`}>
                  {account.status}
                </span>
              </div>
              {account.created_at && (
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Created</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatDate(account.created_at)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Balances Section */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Balances
            </h3>
            
            <div className="space-y-4">
              {/* Main Currency Balance */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                  {account.currency} Balance
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatBalance(mainBalance, account.currency)}
                </p>
              </div>

              {/* USD/USDT Balances */}
              {(usdBalance > 0 || usdtBalance > 0) && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                    USD Equivalent
                  </p>
                  <div className="space-y-2">
                    {usdBalance > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">USD</span>
                        <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {formatBalance(usdBalance, 'USD')}
                        </span>
                      </div>
                    )}
                    {usdtBalance > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">USDT</span>
                        <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {formatBalance(usdtBalance, 'USDT')}
                        </span>
                      </div>
                    )}
                    {totalUSD > 0 && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total USD</span>
                        <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                          {formatBalance(totalUSD, 'USD')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Other Currency Balances */}
              {otherBalances.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                    Other Holdings
                  </p>
                  <div className="space-y-2">
                    {otherBalances.map((balance) => (
                      <div key={balance.currency} className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {balance.currency}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatBalance(balance.amount, balance.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

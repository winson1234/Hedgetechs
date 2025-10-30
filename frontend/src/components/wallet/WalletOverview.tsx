import type { Account } from '../../App';

type WalletOverviewProps = {
  accounts: Account[];
  formatBalance: (balance: number | undefined, currency: string | undefined) => string;
};

export default function WalletOverview({ accounts, formatBalance }: WalletOverviewProps) {
  
  const totalLiveValue = accounts
    .filter(acc => acc.type === 'live')
    .reduce((sum, acc) => sum + (acc.balances[acc.currency] ?? 0), 0);
  
  const totalDemoValue = accounts
    .filter(acc => acc.type === 'demo')
    .reduce((sum, acc) => sum + (acc.balances[acc.currency] ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">
        Portfolio Overview
      </h2>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <div className="p-5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700/50">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium text-slate-600 dark:text-slate-300">Total Live Value</span>
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded uppercase">Live</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {formatBalance(totalLiveValue, 'USD')}
          </p>
        </div>
        <div className="p-5 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/50">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium text-slate-600 dark:text-slate-300">Total Demo Value</span>
            <span className="text-xs font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded uppercase">Demo</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {formatBalance(totalDemoValue, 'USD')}
          </p>
        </div>
      </div>
      
      {/* Balances List */}
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
        Account Balances
      </h3>
      <div className="space-y-4">
        {accounts.length === 0 ? (
           <p className="text-slate-500 dark:text-slate-400 text-center py-4">No accounts found.</p>
        ) : (
          accounts.map(acc => (
            <div key={acc.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{acc.id}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                  acc.type === 'live' 
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                  : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                }`}>
                  {acc.type}
                </span>
              </div>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                {formatBalance(acc.balances[acc.currency], acc.currency)}
              </p>
              <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                {Object.entries(acc.balances).filter(([k, v]) => k !== acc.currency && v > 0).length > 0 ? (
                  Object.entries(acc.balances).filter(([k, v]) => k !== acc.currency && v > 0).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span className="font-mono">{v.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                    </div>
                  ))
                ) : (
                  <p className="italic text-slate-500 dark:text-slate-500">No other holdings</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
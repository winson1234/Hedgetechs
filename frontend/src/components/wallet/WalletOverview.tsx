import type { Account } from '../../App';
import PortfolioAllocation from './PortfolioAllocation';

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
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">
          Portfolio Overview
        </h2>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
      </div>

      <PortfolioAllocation accounts={accounts} formatBalance={formatBalance} />
    </div>
  );
}
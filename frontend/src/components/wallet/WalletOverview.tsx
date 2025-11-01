import { useMemo } from 'react';
import { useAccountStore, formatBalance } from '../../stores/accountStore';
import { useAssetPrices } from '../../hooks/useAssetPrices';
import PortfolioAllocation from './PortfolioAllocation';

export default function WalletOverview() {
  // Access stores
  const accounts = useAccountStore(state => state.accounts);
  const { prices: assetPrices, loading: pricesLoading } = useAssetPrices();

  // Calculate total portfolio value in USD
  const totalPortfolioValue = useMemo(() => {
    return accounts.reduce((total, acc) => {
      let accountValue = 0;

      // Add base currency (fiat currencies are 1:1 USD for now, can enhance later)
      accountValue += acc.balances[acc.currency] ?? 0;

      // Add crypto holdings converted to USD
      Object.entries(acc.balances).forEach(([currency, amount]) => {
        if (currency !== acc.currency && amount > 0) {
          const symbol = `${currency}USDT`;
          const price = assetPrices[symbol] || 0;
          accountValue += amount * price;
        }
      });

      return total + accountValue;
    }, 0);
  }, [accounts, assetPrices]);

  const totalLiveValue = useMemo(() => {
    return accounts.filter(acc => acc.type === 'live').reduce((total, acc) => {
      let accountValue = 0;
      accountValue += acc.balances[acc.currency] ?? 0;
      Object.entries(acc.balances).forEach(([currency, amount]) => {
        if (currency !== acc.currency && amount > 0) {
          const symbol = `${currency}USDT`;
          const price = assetPrices[symbol] || 0;
          accountValue += amount * price;
        }
      });
      return total + accountValue;
    }, 0);
  }, [accounts, assetPrices]);

  const totalDemoValue = useMemo(() => {
    return accounts.filter(acc => acc.type === 'demo').reduce((total, acc) => {
      let accountValue = 0;
      accountValue += acc.balances[acc.currency] ?? 0;
      Object.entries(acc.balances).forEach(([currency, amount]) => {
        if (currency !== acc.currency && amount > 0) {
          const symbol = `${currency}USDT`;
          const price = assetPrices[symbol] || 0;
          accountValue += amount * price;
        }
      });
      return total + accountValue;
    }, 0);
  }, [accounts, assetPrices]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">
          Portfolio Overview
        </h2>

        {/* Total Portfolio Value - Primary Card */}
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
            Total Portfolio Value
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatBalance(totalPortfolioValue, 'USD')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Across all accounts
          </p>
        </div>

        {/* Summary Cards - Live and Demo */}
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

      <PortfolioAllocation
        accounts={accounts}
        formatBalance={formatBalance}
        assetPrices={assetPrices}
        pricesLoading={pricesLoading}
        totalPortfolioValue={totalPortfolioValue}
      />
    </div>
  );
}
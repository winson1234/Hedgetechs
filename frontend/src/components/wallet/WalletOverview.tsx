import { useMemo, useEffect, useState } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { useAppSelector } from '../../store';
import { useAssetPrices } from '../../hooks/useAssetPrices';
import { getApiUrl } from '../../config/api';
import PortfolioAllocation from './PortfolioAllocation';
import AccountSwitcher from '../AccountSwitcher';

export default function WalletOverview() {
  // Access Redux state
  const accounts = useAppSelector(state => state.account.accounts);
  const { prices: assetPrices, loading: pricesLoading } = useAssetPrices();

  // FX rates for converting non-USD fiat currencies
  const [fxRates, setFxRates] = useState<Record<string, number>>({});

  // Fetch FX rates on mount
  useEffect(() => {
    const fetchFXRates = async () => {
      try {
        const response = await fetch(getApiUrl('/api/v1/fx-rates'));
        if (!response.ok) throw new Error('Failed to fetch FX rates');
        const rates = await response.json();
        setFxRates(rates);
      } catch (error) {
        console.error('Failed to fetch FX rates:', error);
      }
    };
    fetchFXRates();
  }, []);

  // Calculate total portfolio value in USD
  const totalPortfolioValue = useMemo(() => {
    return accounts.reduce((total, acc) => {
      let accountValue = 0;

      // Add base currency converted to USD using FX rates
      const baseBalance = acc.balances.find(b => b.currency === acc.currency);
      const baseCurrencyAmount = baseBalance?.amount ?? 0;
      const fxRate = fxRates[acc.currency] || 1.0; // rates are X-to-USD
      accountValue += baseCurrencyAmount * fxRate;

      // Add crypto holdings converted to USD
      acc.balances.forEach((balance) => {
        if (balance.currency !== acc.currency && balance.amount > 0) {
          const symbol = `${balance.currency}USDT`;
          const price = assetPrices[symbol] || 0;
          accountValue += balance.amount * price;
        }
      });

      return total + accountValue;
    }, 0);
  }, [accounts, assetPrices, fxRates]);

  const totalLiveValue = useMemo(() => {
    return accounts.filter(acc => acc.type === 'live').reduce((total, acc) => {
      let accountValue = 0;

      // Convert base currency to USD using FX rates
      const baseBalance = acc.balances.find(b => b.currency === acc.currency);
      const baseCurrencyAmount = baseBalance?.amount ?? 0;
      const fxRate = fxRates[acc.currency] || 1.0; // rates are X-to-USD
      accountValue += baseCurrencyAmount * fxRate;

      // Add crypto holdings converted to USD
      acc.balances.forEach((balance) => {
        if (balance.currency !== acc.currency && balance.amount > 0) {
          const symbol = `${balance.currency}USDT`;
          const price = assetPrices[symbol] || 0;
          accountValue += balance.amount * price;
        }
      });
      return total + accountValue;
    }, 0);
  }, [accounts, assetPrices, fxRates]);

  const totalDemoValue = useMemo(() => {
    return accounts.filter(acc => acc.type === 'demo').reduce((total, acc) => {
      let accountValue = 0;

      // Convert base currency to USD using FX rates
      const baseBalance = acc.balances.find(b => b.currency === acc.currency);
      const baseCurrencyAmount = baseBalance?.amount ?? 0;
      const fxRate = fxRates[acc.currency] || 1.0; // rates are X-to-USD
      accountValue += baseCurrencyAmount * fxRate;

      // Add crypto holdings converted to USD
      acc.balances.forEach((balance) => {
        if (balance.currency !== acc.currency && balance.amount > 0) {
          const symbol = `${balance.currency}USDT`;
          const price = assetPrices[symbol] || 0;
          accountValue += balance.amount * price;
        }
      });
      return total + accountValue;
    }, 0);
  }, [accounts, assetPrices, fxRates]);


  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Portfolio Overview
          </h2>
          <AccountSwitcher variant="wallet" />
        </div>

        {/* Total Portfolio Value - Primary Card */}
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
            Total Portfolio Value
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(totalPortfolioValue, 'USD')}
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
              {formatCurrency(totalLiveValue, 'USD')}
            </p>
          </div>
          <div className="p-5 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/50">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-slate-600 dark:text-slate-300">Total Demo Value</span>
              <span className="text-xs font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded uppercase">Demo</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(totalDemoValue, 'USD')}
            </p>
          </div>
        </div>

      </div>

      <PortfolioAllocation
        accounts={accounts}
        formatBalance={formatCurrency}
        assetPrices={assetPrices}
        pricesLoading={pricesLoading}
        totalPortfolioValue={totalPortfolioValue}
      />
    </div>
  );
}
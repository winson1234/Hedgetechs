import type { Account } from '../../App';

type PortfolioAllocationProps = {
  accounts: Account[];
  formatBalance: (balance: number | undefined, currency: string | undefined) => string;
};

export default function PortfolioAllocation({ accounts, formatBalance }: PortfolioAllocationProps) {

  const calculateTotalAssets = (): Record<string, number> => {
    const assetTotals: Record<string, number> = {};

    accounts.forEach(acc => {
      Object.entries(acc.balances).forEach(([currency, amount]) => {
        if (assetTotals[currency]) {
          assetTotals[currency] += amount;
        } else {
          assetTotals[currency] = amount;
        }
      });
    });

    return assetTotals;
  };

  const totalAssets = calculateTotalAssets();
  const sortedAssets = Object.entries(totalAssets)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-4xl mx-auto">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
        Portfolio Allocation
      </h3>

      {sortedAssets.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-center py-8 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
          No assets found in portfolio.
        </p>
      ) : (
        <div className="space-y-3">
          {sortedAssets.map(([currency, amount]) => {
            const isFiat = ['USD', 'EUR', 'MYR', 'JPY'].includes(currency);

            return (
              <div
                key={currency}
                className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      isFiat
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      {currency.substring(0, 3)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {currency}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isFiat ? 'Fiat Currency' : 'Cryptocurrency'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {isFiat
                        ? formatBalance(amount, currency)
                        : amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6,
                          })
                      }
                    </p>
                    {!isFiat && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {currency}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
          Total Assets
        </p>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {sortedAssets.length} {sortedAssets.length === 1 ? 'Asset' : 'Assets'}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Aggregated across all accounts
        </p>
      </div>
    </div>
  );
}

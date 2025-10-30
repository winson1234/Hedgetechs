import { useState, useEffect } from 'react';
import type { Account } from '../../App';

type TransferTabProps = {
  accounts: Account[];
  activeAccount: Account | null;
  onTransfer: (fromAccountId: string, toAccountId: string, amount: number, currency: string) => { success: boolean; message: string };
  formatBalance: (balance: number | undefined, currency: string | undefined) => string;
};

export default function TransferTab({ accounts, activeAccount, onTransfer, formatBalance }: TransferTabProps) {
  const [fromAccountId, setFromAccountId] = useState(activeAccount?.id || accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const fromAccount = accounts.find(a => a.id === fromAccountId);
  const transferCurrency = fromAccount?.currency || 'USD';

  useEffect(() => {
    if (activeAccount) {
      setFromAccountId(activeAccount.id);
    }
  }, [activeAccount]);

  const toAccounts = accounts.filter(acc => 
    acc.id !== fromAccountId && 
    acc.currency === transferCurrency
  );

  useEffect(() => {
    if (toAccountId && !toAccounts.some(a => a.id === toAccountId)) {
      setToAccountId('');
    }
  }, [fromAccountId, toAccounts, toAccountId]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!fromAccountId) {
      setError('Please select an account to transfer from.');
      return;
    }
    if (!toAccountId) {
      setError('Please select an account to transfer to.');
      return;
    }
    if (fromAccountId === toAccountId) {
      setError('Cannot transfer to the same account.');
      return;
    }
    
    const toAccount = accounts.find(a => a.id === toAccountId);
    if (fromAccount?.currency !== toAccount?.currency) {
      setError('Account currencies do not match. Cross-currency transfers are not supported.');
      return;
    }

    const result = onTransfer(fromAccountId, toAccountId, amountNum, transferCurrency);
    if (result.success) {
      setAmount(''); // Clear form
      setToAccountId('');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
        Internal Transfer
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        Move funds between your trading accounts.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="fromAccount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            From Account
          </label>
          <select
            id="fromAccount"
            value={fromAccountId}
            onChange={(e) => setFromAccountId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={accounts.length === 0}
          >
            {accounts.length === 0 ? (
                <option>No accounts available</option>
            ) : (
                accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                    {acc.id} ({acc.type}) - {formatBalance(acc.balances[acc.currency], acc.currency)}
                </option>
                ))
            )}
          </select>
        </div>

        <div>
          <label htmlFor="toAccount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            To Account
          </label>
          <select
            id="toAccount"
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={toAccounts.length === 0}
          >
            <option value="" disabled>
              {fromAccountId ? (toAccounts.length > 0 ? 'Select an account (same currency)' : 'No accounts with same currency') : 'Select account'}
            </option>
            {toAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.id} ({acc.type}) - {formatBalance(acc.balances[acc.currency], acc.currency)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="transferAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Amount to Transfer
          </label>
          <div className="relative">
            <input
              type="number"
              id="transferAmount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="any"
              className="w-full px-3 py-2 pr-16 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="absolute right-3 top-2.5 text-sm font-medium text-slate-500 dark:text-slate-400">
              {transferCurrency}
            </span>
          </div>
        </div>
        
        {error && (
          <p className="text-sm text-red-600 dark:text-red-500">{error}</p>
        )}

        <button
          type="submit"
          className="w-full px-4 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!fromAccountId || !toAccountId || amount === ''}
        >
          Confirm Transfer
        </button>
      </form>
    </div>
  );
}
import { useState, useEffect } from 'react';
import type { Account } from '../../App';

type DepositTabProps = {
  accounts: Account[];
  activeAccount: Account | null;
  onDeposit: (accountId: string, amount: number, currency: string) => { success: boolean; message: string };
  formatBalance: (balance: number | undefined, currency: string | undefined) => string;
  showToast: (message: string, type: 'success' | 'error') => void;
};

// Simple icon for the payment method
const VisaIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 38 24" xmlns="http://www.w3.org/2000/svg" role="img">
    <path fill="#282828" d="M35 0H3C1.3 0 0 1.3 0 3v18c0 1.7 1.4 3 3 3h32c1.7 0 3-1.3 3-3V3c0-1.7-1.4-3-3-3z"/>
    <path fill="#fff" d="M12.9 6.6c0-.5.4-.8.9-.8.4 0 .9.3 1.3.8l2.1 4.3c.3.5.3 1 0 1.5l-2.1 4.3c-.4.5-.9.8-1.3.8-.5 0-.9-.3-.9-.8s.4-.8.9-.8c.4 0 .9.3 1.2.7l1.5-3.1-1.5-3.1c-.3.4-.8.7-1.2.7-.5 0-.9-.3-.9-.8zm6 0c0-.5.4-.8.9-.8.4 0 .9.3 1.3.8l2.1 4.3c.3.5.3 1 0 1.5l-2.1 4.3c-.4.5-.9.8-1.3.8-.5 0-.9-.3-.9-.8s.4-.8.9-.8c.4 0 .9.3 1.2.7l1.5-3.1-1.5-3.1c-.3.4-.8.7-1.2.7-.5 0-.9-.3-.9-.8zm-6.1 0c0-.5.4-.8.9-.8.4 0 .9.3 1.3.8l2.1 4.3c.3.5.3 1 0 1.5l-2.1 4.3c-.4.5-.9.8-1.3.8-.5 0-.9-.3-.9-.8s.4-.8.9-.8c.4 0 .9.3 1.2.7l1.5-3.1-1.5-3.1c-.3.4-.8.7-1.2.7-.5 0-.9-.3-.9-.8z"/>
  </svg>
);


export default function DepositTab({ accounts, activeAccount, onDeposit, formatBalance, showToast }: DepositTabProps) {
  // Default to active account, or first account
  const [selectedAccountId, setSelectedAccountId] = useState(activeAccount?.id || accounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Update selected account if active account changes
  useEffect(() => {
    if (activeAccount) {
      setSelectedAccountId(activeAccount.id);
    }
  }, [activeAccount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!selectedAccountId) {
      setError('Please select an account to deposit into.');
      return;
    }
    
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account) {
       setError('Selected account not found.');
       return;
    }

    // Simulate deposit logic
    const result = onDeposit(selectedAccountId, amountNum, account.currency);
    if (result.success) {
      setAmount(''); // Clear form
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">
        Deposit Funds
      </h2>
      
      {/* Payment Method Selection (Mock) */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Payment Method
        </label>
        <div className="p-4 border border-indigo-500 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center gap-4">
          <VisaIcon />
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200">Visa / Master Card</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Fee: Free, Instant</p>
          </div>
        </div>
        {/* We would add other methods like FPX here */}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="depositAccount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Trading Account
          </label>
          <select
            id="depositAccount"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.id} ({acc.type}) - {formatBalance(acc.balances[acc.currency], acc.currency)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="depositAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Amount of Deposit
          </label>
          <div className="relative">
            <input
              type="number"
              id="depositAmount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="any"
              className="w-full px-3 py-2 pr-16 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="absolute right-3 top-2.5 text-sm font-medium text-slate-500 dark:text-slate-400">
              {accounts.find(a => a.id === selectedAccountId)?.currency || 'USD'}
            </span>
          </div>
        </div>
        
        {/* Simple mock of Card Info */}
        <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Card Information (Mock)</p>
          <input type="text" placeholder="XXXX XXXX XXXX XXXX" className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700" />
          <div className="flex gap-2">
            <input type="text" placeholder="MM/YY" className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700" />
            <input type="text" placeholder="CVV" className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700" />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-500">{error}</p>
        )}

        <button
          type="submit"
          className="w-full px-4 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition shadow-sm"
        >
          Confirm Deposit
        </button>
      </form>
    </div>
  );
}
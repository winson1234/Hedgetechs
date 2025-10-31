import { useState, useEffect } from 'react';
import { useAccountStore, formatBalance } from '../../stores/accountStore';
import { useUIStore } from '../../stores/uiStore';

export default function WithdrawTab() {
  // Access stores
  const accounts = useAccountStore(state => state.accounts);
  const activeAccountId = useAccountStore(state => state.activeAccountId);
  const getActiveAccount = useAccountStore(state => state.getActiveAccount);
  const withdraw = useAccountStore(state => state.withdraw);
  const showToast = useUIStore(state => state.showToast);

  const activeAccount = getActiveAccount();

  const [selectedAccountId, setSelectedAccountId] = useState(activeAccount?.id || accounts.find(a => a.type === 'live')?.id || '');
  const [amount, setAmount] = useState('');

  // Update selected account if active account changes
  useEffect(() => {
    if (activeAccount) {
      setSelectedAccountId(activeAccount.id);
    }
  }, [activeAccountId, activeAccount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Please enter a valid amount.', 'error');
      return;
    }
    if (!selectedAccountId) {
      showToast('Please select an account to withdraw from.', 'error');
      return;
    }
    
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account) {
       showToast('Selected account not found.', 'error');
       return;
    }
    
    // Execute withdrawal
    const result = withdraw(selectedAccountId, amountNum, account.currency);
    if (result.success) {
      setAmount(''); // Clear form
    } else {
      showToast(result.message, 'error');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">
        Withdraw Funds
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="withdrawAccount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            From Trading Account
          </label>
          <select
            id="withdrawAccount"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {accounts.filter(acc => acc.type === 'live').map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.id} ({acc.type}) - {formatBalance(acc.balances[acc.currency], acc.currency)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="withdrawAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Amount to Withdraw
          </label>
          <div className="relative">
            <input
              type="number"
              id="withdrawAmount"
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
        
        {/* Simple mock of Bank Info */}
        <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Bank Details (Mock)</p>
          <input type="text" placeholder="Bank Account Holder's Name" className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700" />
          <input type="text" placeholder="Bank Account Number" className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700" />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition shadow-sm"
        >
          Confirm Withdrawal
        </button>
      </form>
    </div>
  );
}
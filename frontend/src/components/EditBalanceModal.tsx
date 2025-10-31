import { useState, useEffect } from 'react';
import type { Account } from '../types';

// Define expected return type from edit function
type EditBalanceResult = { success: boolean; message?: string };

type EditBalanceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null | undefined; // The demo account to edit
  editDemoBalance: (accountId: string, newBalance: number) => EditBalanceResult;
  onBalanceEdited: (message: string) => void; // Callback for success toast
};

// Define balance limits (can be same as creation limits or different)
const MIN_DEMO_BALANCE = 100;
const MAX_DEMO_BALANCE = 1000000;

export default function EditBalanceModal({
  isOpen,
  onClose,
  account,
  editDemoBalance,
  onBalanceEdited,
}: EditBalanceModalProps) {
  const [newBalance, setNewBalance] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Pre-fill balance when modal opens with a valid account
  useEffect(() => {
    if (isOpen && account) {
      // Pre-fill with current base currency balance
      setNewBalance(String(account.balances[account.currency] ?? ''));
      setError(null);
      setBalanceError(null);
      setIsLoading(false);
    } else if (!isOpen) {
      // Clear state when closing
      setNewBalance('');
      setError(null);
      setBalanceError(null);
      setIsLoading(false);
    }
  }, [isOpen, account]);

  // Validate new balance input
  useEffect(() => {
    if (!isOpen || !account) return; // Only validate when open and account exists

    const balanceNum = parseFloat(newBalance);
    if (newBalance === '') {
         setBalanceError('Please enter a new balance.'); // Require input
    } else if (isNaN(balanceNum)) {
      setBalanceError('Please enter a valid number.');
    } else if (balanceNum < MIN_DEMO_BALANCE || balanceNum > MAX_DEMO_BALANCE) {
      setBalanceError(`Balance must be between ${MIN_DEMO_BALANCE} and ${MAX_DEMO_BALANCE}.`);
    } else {
      setBalanceError(null); // Clear error if valid
    }
  }, [newBalance, isOpen, account]);


  const handleSubmit = async () => {
    if (!account || balanceError) {
      return; // Don't submit if no account or validation error
    }
    setError(null);
    setIsLoading(true);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const balanceNum = parseFloat(newBalance);
    const result = editDemoBalance(account.id, balanceNum);

    if (result.success) {
      onBalanceEdited(result.message || 'Demo balance updated successfully!');
      // onClose(); // Let parent handle closing via onBalanceEdited if needed
    } else {
      setError(result.message || 'Failed to update balance. Please try again.');
    }
    setIsLoading(false);
  };

  if (!isOpen || !account) return null; // Don't render if closed or no account provided

  return (
    // Modal backdrop
    <div
      className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 transition-opacity duration-150" // Higher z-index than account page, lower than toast
      onClick={onClose}
    >
      {/* Modal Content */}
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-sm w-full overflow-hidden" // Smaller modal
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Edit Demo Balance ({account.id})
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
           {/* Current Balance Display */}
           <div className="text-sm">
             <span className="text-slate-500 dark:text-slate-400">Current Balance: </span>
             <span className="font-semibold text-slate-700 dark:text-slate-200">
                {
                 (account.balances[account.currency] ?? 0).toLocaleString('en-US', {
                    style: 'currency',
                    currency: account.currency,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                }
            </span>
           </div>

          {/* New Balance Input */}
          <div>
            <label htmlFor="newBalance" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              New Balance ({account.currency})
            </label>
            <input
              type="number"
              id="newBalance"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              min={MIN_DEMO_BALANCE}
              max={MAX_DEMO_BALANCE}
              step="100"
              disabled={isLoading}
              className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 text-sm disabled:opacity-70 ${
                balanceError ? 'border-red-500 dark:border-red-600 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-indigo-500'
              }`}
              autoFocus // Focus input when modal opens
            />
            {/* Validation Error Message */}
            {balanceError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-500">{balanceError}</p>
            )}
             <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Enter a value between {MIN_DEMO_BALANCE.toLocaleString()} and {MAX_DEMO_BALANCE.toLocaleString()}.
            </p>
          </div>

          {/* General Error Message */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
              {error}
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !!balanceError} // Disable if loading or any balance error
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
          >
            {isLoading ? (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Update Balance'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
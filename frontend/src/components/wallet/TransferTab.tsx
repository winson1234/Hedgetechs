import { useState, useEffect, useMemo, memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatCurrency, formatAccountId } from '../../utils/formatters';
import { useAppSelector, useAppDispatch } from '../../store';
import { addToast } from '../../store/slices/uiSlice';
import { createTransfer } from '../../store/slices/transactionSlice';
import { fetchAccounts } from '../../store/slices/accountSlice';

// Base validation schema
const transferSchemaBase = z.object({
  fromAccountId: z.string().min(1, 'Please select a source account'),
  toAccountId: z.string().min(1, 'Please select a destination account'),
  amount: z.number().positive('Amount must be positive'),
});

type TransferFormData = z.infer<typeof transferSchemaBase>;

function TransferTab() {
  const dispatch = useAppDispatch();
  
  // Access Redux state
  const accounts = useAppSelector(state => state.account.accounts);
  const activeAccountId = useAppSelector(state => state.account.activeAccountId);
  
  // Get active account
  const activeAccount = useMemo(() => 
    accounts.find(a => a.id === activeAccountId) || null,
    [accounts, activeAccountId]
  );

  // Helper function to show toast
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    dispatch(addToast({ message, type }));
  };

  // Helper function to process transfer
  const processTransfer = async (fromAccountId: string, toAccountId: string, amount: number, currency: string) => {
    try {
      await dispatch(createTransfer({
        fromAccountId,
        toAccountId,
        amount,
        currency
      })).unwrap();

      // Refresh account balances to show updated balance
      dispatch(fetchAccounts());
    } catch (error) {
      console.error('Transfer failed:', error);
      throw error;
    }
  };

  // State
  const [isProcessing, setIsProcessing] = useState(false);

  // React Hook Form
  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchemaBase),
    defaultValues: {
      fromAccountId: activeAccount?.id || accounts[0]?.id || '',
      toAccountId: '',
      amount: 0,
    },
  });

  const fromAccountId = watch('fromAccountId');
  const toAccountId = watch('toAccountId');

  // Get selected accounts
  const fromAccount = useMemo(() =>
    accounts.find(a => a.id === fromAccountId),
    [accounts, fromAccountId]
  );

  const toAccount = useMemo(() =>
    accounts.find(a => a.id === toAccountId),
    [accounts, toAccountId]
  );

  const availableBalance = useMemo(() => {
    if (!fromAccount) return 0;
    const balance = fromAccount.balances.find(b => b.currency === fromAccount.currency);
    return balance?.amount || 0;
  }, [fromAccount]);

  const transferCurrency = fromAccount?.currency || 'USD';

  // Filter "From" accounts - only Live accounts for transfers
  const fromAccounts = useMemo(() =>
    accounts.filter(acc => acc.type === 'live'),
    [accounts]
  );

  // Filter "To" accounts: same currency, same type, not the same account
  const toAccounts = useMemo(() =>
    accounts.filter(acc =>
      acc.id !== fromAccountId &&
      acc.currency === transferCurrency &&
      acc.type === fromAccount?.type
    ),
    [accounts, fromAccountId, transferCurrency, fromAccount?.type]
  );

  // Create dynamic schema with validation rules
  const transferSchema = useMemo(() =>
    transferSchemaBase
      .refine(
        (data) => data.fromAccountId !== data.toAccountId,
        {
          message: 'Cannot transfer to the same account',
          path: ['toAccountId'],
        }
      )
      .refine(
        (data) => data.amount <= availableBalance,
        {
          message: `Insufficient funds. Available: ${formatCurrency(availableBalance, fromAccount?.currency || 'USD')}`,
          path: ['amount'],
        }
      ),
    [availableBalance, fromAccount?.currency]
  );

  // Update from account when active account changes
  useEffect(() => {
    if (activeAccount) {
      setValue('fromAccountId', activeAccount.id);
    }
  }, [activeAccountId, activeAccount, setValue]);

  // Reset "To" account if it becomes invalid after "From" account change
  useEffect(() => {
    if (toAccountId && !toAccounts.some(a => a.id === toAccountId)) {
      setValue('toAccountId', '');
    }
  }, [fromAccountId, toAccounts, toAccountId, setValue]);

  // Reset "From" account if current selection is invalid
  useEffect(() => {
    if (fromAccountId && !fromAccounts.some(a => a.id === fromAccountId)) {
      const firstAccount = fromAccounts[0];
      setValue('fromAccountId', firstAccount?.id || '');
    }
  }, [fromAccounts, fromAccountId, setValue]);

  const onSubmit = async (data: TransferFormData) => {
    const fromAcc = accounts.find(a => a.id === data.fromAccountId);
    const toAcc = accounts.find(a => a.id === data.toAccountId);

    if (!fromAcc || !toAcc) {
      showToast('One or both accounts not found.', 'error');
      return;
    }

    // Validate against dynamic schema
    const validation = transferSchema.safeParse(data);
    if (!validation.success) {
      const error = validation.error.issues[0];
      showToast(error.message, 'error');
      return;
    }

    // Check currency match
    if (fromAcc.currency !== toAcc.currency) {
      showToast('Cross-currency transfers are not supported.', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      // Process transfer
      await processTransfer(
        fromAcc.id,
        toAcc.id,
        data.amount,
        fromAcc.currency
      );

      // Clear form
      reset({
        fromAccountId: data.fromAccountId,
        toAccountId: '',
        amount: 0,
      });
      showToast('Transfer completed successfully!', 'success');
    } catch (error) {
      console.error('Transfer error:', error);
      showToast(error instanceof Error ? error.message : 'Transfer failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-8">
        <p className="text-slate-500 dark:text-slate-400">
          No accounts available. Please create an account first.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
        Internal Transfer
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        Move funds between your Live trading accounts (same currency only).
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* From Account */}
        <div>
          <label htmlFor="fromAccount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            From Account
          </label>
          <select
            id="fromAccount"
            {...register('fromAccountId')}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {fromAccounts.map(acc => {
              const balance = acc.balances.find(b => b.currency === acc.currency);
              return (
                <option key={acc.id} value={acc.id}>
                  {formatAccountId(acc.account_id, acc.type)} - {formatCurrency(balance?.amount || 0, acc.currency)}
                </option>
              );
            })}
          </select>
          {errors.fromAccountId && (
            <p className="text-xs text-red-500 mt-1">{errors.fromAccountId.message}</p>
          )}
        </div>

        {/* To Account */}
        <div>
          <label htmlFor="toAccount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            To Account
          </label>
          <select
            id="toAccount"
            {...register('toAccountId')}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={toAccounts.length === 0}
          >
            <option value="">
              {fromAccountId
                ? toAccounts.length > 0
                  ? 'Select an account (same currency & type)'
                  : 'No matching accounts available'
                : 'Select source account first'}
            </option>
            {toAccounts.map(acc => {
              const balance = acc.balances.find(b => b.currency === acc.currency);
              return (
                <option key={acc.id} value={acc.id}>
                  {formatAccountId(acc.account_id, acc.type)} - {formatCurrency(balance?.amount || 0, acc.currency)}
                </option>
              );
            })}
          </select>
          {errors.toAccountId && (
            <p className="text-xs text-red-500 mt-1">{errors.toAccountId.message}</p>
          )}
          {toAccounts.length === 0 && fromAccount && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              No other {fromAccount.type} accounts with {fromAccount.currency} currency found.
            </p>
          )}
        </div>

        {/* Amount */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <label htmlFor="transferAmount" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Amount to Transfer
            </label>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Available: {formatCurrency(availableBalance, fromAccount?.currency || 'USD')}
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              id="transferAmount"
              {...register('amount', { valueAsNumber: true })}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 pr-16 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="absolute right-3 top-2.5 text-sm font-medium text-slate-500 dark:text-slate-400">
              {transferCurrency}
            </span>
          </div>
          {errors.amount && (
            <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>
          )}
        </div>

        {/* Transfer Summary */}
        {fromAccount && toAccount && (
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md p-3">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Transfer Summary</p>
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between items-start gap-2">
                <span className="flex-shrink-0">From:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100 text-right break-words">
                  {formatAccountId(fromAccount.account_id, fromAccount.type)}
                </span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="flex-shrink-0">To:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100 text-right break-words">
                  {formatAccountId(toAccount.account_id, toAccount.type)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Fee:</span>
                <span className="font-medium text-green-600 dark:text-green-400">Free</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Processing:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">Instant</span>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isProcessing || toAccounts.length === 0}
          className="w-full px-4 py-2.5 text-sm font-medium bg-[#00C0A2] hover:bg-[#00a085] text-white rounded-md transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : 'Confirm Transfer'}
        </button>
      </form>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders from WebSocket updates
export default memo(TransferTab);

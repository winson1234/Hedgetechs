import { useState, useEffect, useMemo, memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatBalance } from '../../utils/format';
import { useAppSelector, useAppDispatch } from '../../store';
import { addToast } from '../../store/slices/uiSlice';
import { createWithdrawal } from '../../store/slices/transactionSlice';
import { fetchAccounts } from '../../store/slices/accountSlice';
import type { PaymentMethodMetadata } from '../../types';

// Validation schema (will add .refine for balance check)
const withdrawSchemaBase = z.object({
  accountId: z.string().min(1, 'Please select an account'),
  amount: z.number().positive('Amount must be positive'),
  accountHolderName: z.string().min(2, 'Account holder name is required'),
  accountNumber: z.string().min(8, 'Account number must be at least 8 digits'),
  routingNumber: z.string().length(9, 'Routing number must be exactly 9 digits').regex(/^\d+$/, 'Routing number must contain only digits'),
  bankName: z.string().optional(),
});

type WithdrawFormData = z.infer<typeof withdrawSchemaBase>;

function WithdrawTab() {
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

  // Helper function to process withdrawal
  const processWithdrawal = async (accountId: string, amount: number, currency: string, bankDetails: PaymentMethodMetadata) => {
    try {
      await dispatch(createWithdrawal({
        accountId,
        amount,
        currency,
        metadata: bankDetails
      })).unwrap();

      // Refresh account balances to show updated balance
      dispatch(fetchAccounts());
    } catch (error) {
      console.error('Withdrawal failed:', error);
      throw error;
    }
  };

  // State
  const [isProcessing, setIsProcessing] = useState(false);

  // React Hook Form (dynamic schema with balance validation)
  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<WithdrawFormData>({
    resolver: zodResolver(withdrawSchemaBase),
    defaultValues: {
      accountId: activeAccount?.id || accounts.find(a => a.type === 'live')?.id || '',
      amount: 0,
      accountHolderName: '',
      accountNumber: '',
      routingNumber: '',
      bankName: '',
    },
  });

  const selectedAccountId = watch('accountId');

  // Get selected account and available balance
  const selectedAccount = useMemo(() =>
    accounts.find(a => a.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  const availableBalance = useMemo(() => {
    if (!selectedAccount) return 0;
    const balance = selectedAccount.balances.find(b => b.currency === selectedAccount.currency);
    return balance?.amount || 0;
  }, [selectedAccount]);

  // Create dynamic schema with balance validation
  const withdrawSchema = useMemo(() =>
    withdrawSchemaBase.refine(
      (data) => data.amount <= availableBalance,
      {
        message: `Insufficient funds. Available: ${formatBalance(availableBalance, selectedAccount?.currency || 'USD')}`,
        path: ['amount'],
      }
    ),
    [availableBalance, selectedAccount?.currency]
  );

  // Update selected account when active account changes
  useEffect(() => {
    if (activeAccount) {
      setValue('accountId', activeAccount.id);
    }
  }, [activeAccountId, activeAccount, setValue]);

  const onSubmit = async (data: WithdrawFormData) => {
    const account = accounts.find(a => a.id === data.accountId);
    if (!account) {
      showToast('Selected account not found.', 'error');
      return;
    }

    // Validate against dynamic schema (balance check)
    const validation = withdrawSchema.safeParse(data);
    if (!validation.success) {
      const error = validation.error.issues[0];
      showToast(error.message, 'error');
      return;
    }

    setIsProcessing(true);

    try {
      // Process withdrawal with bank details
      await processWithdrawal(
        data.accountId,
        data.amount,
        account.currency,
        {
          bankName: data.bankName || 'Unknown Bank',
          accountLast4: data.accountNumber.slice(-4),
          routingNumber: data.routingNumber,
        }
      );

      // Clear form
      reset();
      showToast('Withdrawal initiated successfully!', 'success');
    } catch (error) {
      console.error('Withdrawal error:', error);
      showToast(error instanceof Error ? error.message : 'Withdrawal failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const liveAccounts = accounts.filter(acc => acc.type === 'live');

  if (liveAccounts.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-8">
        <p className="text-slate-500 dark:text-slate-400">
          No live accounts available. Please create a live account first.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">
        Withdraw Funds
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Account Selection */}
        <div>
          <label htmlFor="withdrawAccount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            From Trading Account
          </label>
          <select
            id="withdrawAccount"
            {...register('accountId')}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {liveAccounts.map(acc => {
              const balance = acc.balances.find(b => b.currency === acc.currency);
              return (
                <option key={acc.id} value={acc.id}>
                  {acc.id} - {formatBalance(balance?.amount || 0, acc.currency)}
                </option>
              );
            })}
          </select>
          {errors.accountId && (
            <p className="text-xs text-red-500 mt-1">{errors.accountId.message}</p>
          )}
        </div>

        {/* Amount */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <label htmlFor="withdrawAmount" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Amount to Withdraw
            </label>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Available: {formatBalance(availableBalance, selectedAccount?.currency || 'USD')}
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              id="withdrawAmount"
              {...register('amount', { valueAsNumber: true })}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 pr-16 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="absolute right-3 top-2.5 text-sm font-medium text-slate-500 dark:text-slate-400">
              {selectedAccount?.currency || 'USD'}
            </span>
          </div>
          {errors.amount && (
            <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>
          )}
        </div>

        {/* Bank Details */}
        <div className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Bank Details</p>

          {/* Account Holder Name */}
          <div>
            <input
              type="text"
              {...register('accountHolderName')}
              placeholder="Account Holder's Name"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {errors.accountHolderName && (
              <p className="text-xs text-red-500 mt-1">{errors.accountHolderName.message}</p>
            )}
          </div>

          {/* Bank Name (Optional) */}
          <div>
            <input
              type="text"
              {...register('bankName')}
              placeholder="Bank Name (Optional)"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Account Number */}
          <div>
            <input
              type="text"
              {...register('accountNumber')}
              placeholder="Bank Account Number (min 8 digits)"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {errors.accountNumber && (
              <p className="text-xs text-red-500 mt-1">{errors.accountNumber.message}</p>
            )}
          </div>

          {/* Routing Number */}
          <div>
            <input
              type="text"
              {...register('routingNumber')}
              placeholder="Routing Number (9 digits)"
              maxLength={9}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {errors.routingNumber && (
              <p className="text-xs text-red-500 mt-1">{errors.routingNumber.message}</p>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Withdrawals typically take 1-3 business days to process.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isProcessing}
          className="w-full px-4 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : 'Confirm Withdrawal'}
        </button>
      </form>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders from WebSocket updates
export default memo(WithdrawTab);

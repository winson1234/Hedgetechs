import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getApiUrl } from '../../config/api';
import { formatCurrency, formatAccountId } from '../../utils/formatters';
import { useAppSelector, useAppDispatch } from '../../store';
import { addToast } from '../../store/slices/uiSlice';
import { fetchAccounts } from '../../store/slices/accountSlice';
import { memo } from 'react';
import { getToken } from '../../services/auth';

// Saved withdrawal method interface
interface SavedWithdrawalMethod {
  id: string;
  withdrawal_method: WithdrawalMethod;
  nickname?: string;
  withdrawal_details: Record<string, any>;
  is_default: boolean;
  last_used_at?: string;
  created_at: string;
}

// Withdrawal methods
type WithdrawalMethod = 'tron' | 'bank_transfer' | 'wire';

// Fee structure (must match backend)
const WITHDRAWAL_FEES: Record<WithdrawalMethod, { type: 'fixed' | 'percentage'; amount: number; min?: number; max?: number }> = {
  tron: { type: 'fixed', amount: 1.0 },
  bank_transfer: { type: 'percentage', amount: 0.005, min: 5.0, max: 50.0 }, // 0.5%
  wire: { type: 'fixed', amount: 25.0 },
};

// Calculate fee based on method and amount
const calculateFee = (method: WithdrawalMethod, amount: number): number => {
  const feeConfig = WITHDRAWAL_FEES[method];
  if (feeConfig.type === 'fixed') {
    return feeConfig.amount;
  } else {
    const fee = amount * feeConfig.amount;
    return Math.max(feeConfig.min || 0, Math.min(feeConfig.max || Infinity, fee));
  }
};

// Validation schemas for different withdrawal methods
const tronWithdrawalSchema = z.object({
  accountId: z.string().min(1, 'Please select an account'),
  amount: z.number()
    .min(10, 'Minimum withdrawal amount is $10.00')
    .max(100000, 'Maximum withdrawal amount is $100,000.00')
    .positive('Amount must be positive'),
  walletAddress: z.string()
    .min(34, 'Invalid Tron address')
    .max(34, 'Invalid Tron address')
    .regex(/^T[A-Za-z0-9]{33}$/, 'Invalid Tron wallet address format'),
  saveForReuse: z.boolean().optional(),
});

const bankWithdrawalSchema = z.object({
  accountId: z.string().min(1, 'Please select an account'),
  amount: z.number()
    .min(10, 'Minimum withdrawal amount is $10.00')
    .max(100000, 'Maximum withdrawal amount is $100,000.00')
    .positive('Amount must be positive'),
  accountHolderName: z.string().min(2, 'Account holder name is required'),
  accountNumber: z.string().min(8, 'Account number must be at least 8 digits'),
  routingNumber: z.string()
    .length(9, 'Routing number must be exactly 9 digits')
    .regex(/^\d+$/, 'Routing number must contain only digits'),
  bankName: z.string().optional(),
  saveForReuse: z.boolean().optional(),
});

type TronWithdrawalFormData = z.infer<typeof tronWithdrawalSchema>;
type BankWithdrawalFormData = z.infer<typeof bankWithdrawalSchema>;
type WithdrawalFormData = TronWithdrawalFormData | BankWithdrawalFormData;

function WithdrawTab() {
  const dispatch = useAppDispatch();

  // Access Redux state
  const accounts = useAppSelector(state => state.account.accounts);
  const activeAccountId = useAppSelector(state => state.account.activeAccountId);
  const token = useAppSelector(state => state.auth.token);

  // Get active account
  const activeAccount = useMemo(() =>
    accounts.find(a => a.id === activeAccountId) || null,
    [accounts, activeAccountId]
  );

  // Helper function to show toast
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    dispatch(addToast({ message, type }));
  }, [dispatch]);

  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [withdrawalMethod, setWithdrawalMethod] = useState<WithdrawalMethod>('tron');
  const [savedMethods, setSavedMethods] = useState<SavedWithdrawalMethod[]>([]);
  const [selectedSavedMethod, setSelectedSavedMethod] = useState<string>('new');
  const [isLoadingSavedMethods, setIsLoadingSavedMethods] = useState(false);

  // React Hook Form (dynamic schema based on withdrawal method)
  const currentSchema = withdrawalMethod === 'tron' ? tronWithdrawalSchema : bankWithdrawalSchema;
  
  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<WithdrawalFormData>({
    resolver: zodResolver(currentSchema),
    defaultValues: {
      accountId: activeAccount?.id || accounts.find(a => a.type === 'live')?.id || '',
      amount: 0,
      ...(withdrawalMethod === 'tron' 
        ? { walletAddress: '', saveForReuse: false }
        : { accountHolderName: '', accountNumber: '', routingNumber: '', bankName: '', saveForReuse: false }
      ),
    },
  });

  const selectedAccountId = watch('accountId');
  const withdrawalAmount = watch('amount') || 0;

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

  // Calculate fees and net amount
  const feeAmount = useMemo(() => {
    if (!withdrawalAmount || withdrawalAmount <= 0) return 0;
    return calculateFee(withdrawalMethod, withdrawalAmount);
  }, [withdrawalMethod, withdrawalAmount]);

  const netAmount = useMemo(() => {
    return Math.max(0, withdrawalAmount - feeAmount);
  }, [withdrawalAmount, feeAmount]);

  // Fetch saved withdrawal methods
  const fetchSavedMethods = useCallback(async () => {
    setIsLoadingSavedMethods(true);
    try {
      const authToken = token || getToken();
      if (!authToken) return;

      const response = await fetch(getApiUrl('/api/v1/withdrawals/saved-methods'), {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSavedMethods(data.methods || []);
      }
    } catch (error) {
      console.error('Failed to fetch saved methods:', error);
    } finally {
      setIsLoadingSavedMethods(false);
    }
  }, [token]);

  // Load saved methods on mount
  useEffect(() => {
    fetchSavedMethods();
  }, [fetchSavedMethods]);

  // Update selected account when active account changes
  useEffect(() => {
    if (activeAccount) {
      setValue('accountId', activeAccount.id);
    }
  }, [activeAccountId, activeAccount, setValue]);

  // Reset form when withdrawal method changes
  useEffect(() => {
    reset({
      accountId: selectedAccountId,
      amount: 0,
      ...(withdrawalMethod === 'tron' 
        ? { walletAddress: '', saveForReuse: false }
        : { accountHolderName: '', accountNumber: '', routingNumber: '', bankName: '', saveForReuse: false }
      ),
    });
    setSelectedSavedMethod('new');
  }, [withdrawalMethod, selectedAccountId, reset]);

  // Populate form when saved method is selected
  useEffect(() => {
    if (selectedSavedMethod === 'new') return;

    const savedMethod = savedMethods.find(m => m.id === selectedSavedMethod);
    if (!savedMethod) return;

    if (savedMethod.withdrawal_method === 'tron') {
      setValue('walletAddress' as any, savedMethod.withdrawal_details.wallet_address || '');
    } else {
      setValue('accountHolderName' as any, savedMethod.withdrawal_details.account_holder_name || '');
      setValue('bankName' as any, savedMethod.withdrawal_details.bank_name || '');
      setValue('routingNumber' as any, savedMethod.withdrawal_details.routing_number || '');
      // For account number, we only have last 4 digits, show placeholder
      const last4 = savedMethod.withdrawal_details.account_last4;
      if (last4) {
        setValue('accountNumber' as any, '****' + last4);
      }
    }
  }, [selectedSavedMethod, savedMethods, setValue]);

  const onSubmit = async (data: WithdrawalFormData) => {
    const account = accounts.find(a => a.id === data.accountId);
    if (!account) {
      showToast('Selected account not found.', 'error');
      return;
    }

    // Check if account is live
    if (account.type !== 'live') {
      showToast('Only live accounts can withdraw funds.', 'error');
      return;
    }

    // Validate available balance (including fee)
    if (availableBalance < data.amount) {
      showToast(
        `Insufficient balance. Available: ${formatCurrency(availableBalance, account.currency)}, Required: ${formatCurrency(data.amount, account.currency)} (includes ${formatCurrency(feeAmount, account.currency)} fee)`,
        'error'
      );
      return;
    }

    setIsProcessing(true);

    try {
      // Get auth token from Redux or localStorage
      const authToken = token || getToken();

      if (!authToken) {
        showToast('Authentication required. Please log in again.', 'error');
        return;
      }

      // Prepare withdrawal details based on method
      let withdrawalDetails: Record<string, any>;
      if (withdrawalMethod === 'tron') {
        const tronData = data as TronWithdrawalFormData;
        withdrawalDetails = {
          wallet_address: tronData.walletAddress,
          network: 'TRC20',
        };
      } else {
        const bankData = data as BankWithdrawalFormData;
        withdrawalDetails = {
          account_holder_name: bankData.accountHolderName,
          account_number: bankData.accountNumber,
          routing_number: bankData.routingNumber,
          bank_name: bankData.bankName || 'Unknown Bank',
        };
      }

      // Create withdrawal request
      const response = await fetch(getApiUrl('/api/v1/withdrawals'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          account_id: data.accountId,
          withdrawal_method: withdrawalMethod,
          amount: data.amount,
          currency: account.currency,
          withdrawal_details: withdrawalDetails,
          save_for_reuse: data.saveForReuse || false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create withdrawal request');
      }

      const result = await response.json();
      showToast(
        result.message || 'Withdrawal request submitted successfully! Your withdrawal is pending admin approval.',
        'success'
      );

      // Reset form
      reset();

      // Refresh accounts to show updated balance
      dispatch(fetchAccounts());

      // Refresh saved methods if this was saved
      if (data.saveForReuse) {
        fetchSavedMethods();
      }

    } catch (error) {
      console.error('Withdrawal error:', error);
      showToast(error instanceof Error ? error.message : 'Failed to submit withdrawal request', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const liveAccounts = useMemo(() => accounts.filter(acc => acc.type === 'live'), [accounts]);

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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
      {/* --- INFO COLUMN (LEFT) --- */}
      <div className="lg:col-span-5 lg:border-r lg:border-slate-300 dark:lg:border-slate-700 lg:pr-8">
        <div className="lg:sticky lg:top-8">
          <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-xl font-bold mb-5 text-slate-900 dark:text-slate-100">
              Withdrawal Information
            </h3>

            {/* Withdrawal Method */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                WITHDRAWAL METHOD
              </label>
              <div className="px-4 py-2.5 rounded-lg font-semibold text-sm bg-[#00C0A2] text-white shadow-md text-center">
                Tron (USDT)
              </div>
            </div>

            {/* Fee Breakdown */}
            {withdrawalAmount > 0 && (
              <div className="mb-6 p-4 bg-white dark:bg-slate-900 border-2 border-[#00C0A2]/30 dark:border-[#00C0A2]/70 rounded-lg">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Fee Breakdown
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Withdrawal Amount:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      ${withdrawalAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      Fee {WITHDRAWAL_FEES[withdrawalMethod].type === 'percentage' ? '(0.5%)' : ''}:
                    </span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      -${feeAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t border-slate-300 dark:border-slate-600 pt-2 flex justify-between">
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">You Receive:</span>
                    <span className="font-bold text-lg text-green-600 dark:text-green-400">
                      ${netAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions */}
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400 mb-6">
              <li className="flex items-start gap-2">
                <span className="text-[#00C0A2] mt-0.5 font-bold">1.</span>
                <span>Enter your Tron (USDT) wallet address</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00C0A2] mt-0.5 font-bold">2.</span>
                <span>Enter the withdrawal amount and destination details</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00C0A2] mt-0.5 font-bold">3.</span>
                <span>Review the fee and final amount you'll receive</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00C0A2] mt-0.5 font-bold">4.</span>
                <span>Submit your withdrawal request for admin approval</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00C0A2] mt-0.5 font-bold">5.</span>
                <span>Receive your funds once approved (typically 24-48 hours)</span>
              </li>
            </ul>

            {/* Important Notes */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">
                    Important
                  </h4>
                  <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                    <li>• Funds are reserved immediately upon request</li>
                    <li>• Minimum withdrawal: $10.00 | Maximum: $100,000.00</li>
                    <li>• Double-check your wallet address</li>
                    <li>• Processing time: 24-48 hours after approval</li>
                    <li>• Withdrawals are subject to admin verification</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-300 dark:border-slate-600">
              <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
                Your funds are protected under financial regulations. All withdrawal requests
                are reviewed for security and compliance.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- FORM COLUMN (RIGHT) --- */}
      <div className="lg:col-span-7">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">
          Submit Withdrawal Request
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Account Selection */}
          <div>
            <label htmlFor="withdrawAccount" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              From Trading Account
            </label>
            <select
              id="withdrawAccount"
              {...register('accountId')}
              className="w-full px-4 py-3.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00C0A2] focus:border-[#00C0A2] transition-all text-base font-medium"
            >
              {liveAccounts.map(acc => {
                const balance = acc.balances.find(b => b.currency === acc.currency);
                return (
                  <option key={acc.id} value={acc.id}>
                    {formatAccountId(acc.account_id, acc.type)} - {formatCurrency(balance?.amount || 0, acc.currency)}
                  </option>
                );
              })}
            </select>
            {errors.accountId && (
              <p className="text-xs text-red-500 mt-1">{errors.accountId.message}</p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Available Balance: {formatCurrency(availableBalance, selectedAccount?.currency || 'USD')}
            </p>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="withdrawAmount" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Withdrawal Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-4 text-base font-bold text-slate-500 dark:text-slate-400">
                $
              </span>
              <input
                type="number"
                id="withdrawAmount"
                {...register('amount', { valueAsNumber: true })}
                placeholder="0.00"
                min="10"
                max="100000"
                step="0.01"
                className="w-full pl-8 pr-4 py-3.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00C0A2] focus:border-[#00C0A2] transition-all text-lg font-semibold"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Min: $10.00 | Max: $100,000.00
            </p>
            {errors.amount && (
              <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>
            )}
          </div>

          {/* Saved Methods Selector */}
          {savedMethods.filter(m => m.withdrawal_method === withdrawalMethod).length > 0 && (
            <div>
              <label htmlFor="savedMethod" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Use Saved {withdrawalMethod === 'tron' ? 'Wallet' : 'Bank Account'}
              </label>
              <select
                id="savedMethod"
                value={selectedSavedMethod}
                onChange={(e) => setSelectedSavedMethod(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00C0A2] focus:border-[#00C0A2] transition-all text-sm"
              >
                <option value="new">+ Enter New Details</option>
                {savedMethods
                  .filter(m => m.withdrawal_method === withdrawalMethod)
                  .map(method => {
                    let displayName = method.nickname || 'Saved Method';
                    if (withdrawalMethod === 'tron' && method.withdrawal_details.wallet_address) {
                      const addr = method.withdrawal_details.wallet_address;
                      displayName = method.nickname || `${addr.slice(0, 6)}...${addr.slice(-4)}`;
                    } else if (method.withdrawal_details.account_last4) {
                      displayName = method.nickname || `****${method.withdrawal_details.account_last4}`;
                    }
                    return (
                      <option key={method.id} value={method.id}>
                        {displayName} {method.is_default ? '(Default)' : ''}
                      </option>
                    );
                  })}
              </select>
            </div>
          )}

          {/* Tron Withdrawal Fields */}
          {withdrawalMethod === 'tron' && (
            <>
              <div>
                <label htmlFor="walletAddress" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Your Tron Wallet Address (TRC20) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="walletAddress"
                  {...register('walletAddress' as any)}
                  placeholder="Enter your Tron wallet address (starts with T)"
                  disabled={selectedSavedMethod !== 'new'}
                  className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00C0A2] focus:border-[#00C0A2] transition-all text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  USDT will be sent to this TRC20 address
                </p>
                {errors.walletAddress && (
                  <p className="text-xs text-red-500 mt-1">{(errors as any).walletAddress?.message}</p>
                )}
              </div>
            </>
          )}

          {/* Save for Reuse - only show for new entries */}
          {selectedSavedMethod === 'new' && (
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="saveForReuse"
                {...register('saveForReuse' as any)}
                className="w-4 h-4 text-[#00C0A2] border-slate-300 dark:border-slate-600 rounded focus:ring-[#00C0A2]"
              />
              <label htmlFor="saveForReuse" className="text-sm text-slate-700 dark:text-slate-300">
                💾 Save this wallet address for future withdrawals
              </label>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isProcessing || withdrawalAmount <= 0 || availableBalance < withdrawalAmount}
              className="w-full px-6 py-4 text-base font-semibold bg-[#00C0A2] hover:bg-[#00a085] text-white rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing Withdrawal...
                </span>
              ) : (
                `Withdraw ${withdrawalAmount > 0 ? `$${netAmount.toFixed(2)}` : 'Funds'}`
              )}
            </button>
            {withdrawalAmount > 0 && availableBalance < withdrawalAmount && (
              <p className="text-xs text-red-600 dark:text-red-400 text-center mt-2">
                Insufficient balance for this withdrawal
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default memo(WithdrawTab);

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getApiUrl } from '../../config/api';
import { formatCurrency } from '../../utils/formatters';
import { useAppSelector, useAppDispatch } from '../../store';
import { addToast } from '../../store/slices/uiSlice';
import { fetchAccounts } from '../../store/slices/accountSlice';
import { memo } from 'react';
import { getToken } from '../../services/auth';

// Platform's Tron wallet address for receiving USDT (TRC20)
// TODO: Replace with your actual Tron wallet address
const PLATFORM_TRON_ADDRESS = 'TestingHedgetechWalletAddress';

// Validation schema
const depositSchema = z.object({
  accountId: z.string().min(1, 'Please select an account'),
  amount: z.number()
    .min(5, 'Minimum deposit amount is $5.00')
    .max(100000, 'Maximum deposit amount is $100,000.00')
    .positive('Amount must be positive'),
  transactionHash: z.string().optional(),
  walletAddress: z.string().optional(),
});

type DepositFormData = z.infer<typeof depositSchema>;

function DepositTab() {
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
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);

  // React Hook Form
  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      accountId: activeAccount?.id || accounts.find(a => a.type === 'live')?.id || '',
      amount: 0,
      transactionHash: '',
      walletAddress: '',
    },
  });

  const selectedAccountId = watch('accountId');

  // Update selected account when active account changes
  useEffect(() => {
    if (activeAccount) {
      setValue('accountId', activeAccount.id);
    }
  }, [activeAccountId, activeAccount, setValue]);

  // Copy address to clipboard
  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(PLATFORM_TRON_ADDRESS);
    setAddressCopied(true);
    showToast('Wallet address copied to clipboard!', 'success');
    setTimeout(() => setAddressCopied(false), 3000);
  }, [showToast]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        showToast('Invalid file type. Please upload JPG, PNG, or PDF files only.', 'error');
        return;
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        showToast('File size exceeds 10MB limit. Please upload a smaller file.', 'error');
        return;
      }

      setReceiptFile(file);
    }
  };

  // Submit deposit request with receipt
  const onSubmit = async (data: DepositFormData) => {
    const account = accounts.find(a => a.id === data.accountId);
    if (!account) {
      showToast('Selected account not found.', 'error');
      return;
    }

    // Check if account is live
    if (account.type !== 'live') {
      showToast('Only live accounts can receive deposits.', 'error');
      return;
    }

    // Validate receipt file
    if (!receiptFile) {
      showToast('Please upload payment receipt/screenshot.', 'error');
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

      // Step 1: Create deposit request
      const depositResponse = await fetch(getApiUrl('/api/v1/deposits'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          account_id: data.accountId,
          payment_method: 'tron',
          amount: data.amount,
          currency: account.currency,
          payment_details: {
            transaction_hash: data.transactionHash || undefined,
            wallet_address: data.walletAddress || undefined,
            payment_network: 'TRC20',
            payment_currency: 'USDT',
          },
        }),
      });

      if (!depositResponse.ok) {
        const error = await depositResponse.json();
        throw new Error(error.message || 'Failed to create deposit request');
      }

      const depositResult = await depositResponse.json();
      const depositId = depositResult.deposit.id;

      // Step 2: Upload receipt
      const formData = new FormData();
      formData.append('receipt', receiptFile);

      const receiptResponse = await fetch(getApiUrl(`/api/v1/deposits/${depositId}/receipt`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData,
      });

      if (!receiptResponse.ok) {
        const error = await receiptResponse.json();
        throw new Error(error.message || 'Failed to upload receipt');
      }

      const receiptResult = await receiptResponse.json();
      showToast(
        receiptResult.message || 'Deposit request submitted successfully! Your deposit is pending admin review.',
        'success'
      );

      // Reset form
      reset();
      setReceiptFile(null);

      // Refresh accounts
      dispatch(fetchAccounts());

    } catch (error) {
      console.error('Deposit error:', error);
      showToast(error instanceof Error ? error.message : 'Failed to submit deposit request', 'error');
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
              Tron (USDT TRC20) Deposit
            </h3>

            {/* Platform Wallet Address */}
            <div className="mb-6 p-4 bg-white dark:bg-slate-900 border-2 border-indigo-300 dark:border-indigo-700 rounded-lg">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                PLATFORM WALLET ADDRESS (TRC20)
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono text-slate-900 dark:text-slate-100 break-all">
                  {PLATFORM_TRON_ADDRESS}
                </code>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="flex-shrink-0 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-all text-xs font-semibold"
                >
                  {addressCopied ? (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </span>
                  ) : (
                    'Copy'
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Send USDT (TRC20) to this address only
              </p>
            </div>

            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400 mb-6">
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5 font-bold">1.</span>
                <span>Copy the platform wallet address above</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5 font-bold">2.</span>
                <span>Send USDT (TRC20) from your wallet to this address</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5 font-bold">3.</span>
                <span>Take a screenshot of the transaction confirmation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5 font-bold">4.</span>
                <span>Fill in the form and upload your payment proof</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5 font-bold">5.</span>
                <span>Submit and wait for admin approval (within 24 hours)</span>
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
                    <li>• Only send USDT on TRC20 network</li>
                    <li>• Do NOT send TRX or other tokens</li>
                    <li>• Double-check the wallet address before sending</li>
                    <li>• Minimum: $5.00 | Maximum: $100,000.00</li>
                    <li>• Keep your transaction hash for reference</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-300 dark:border-slate-600">
              <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
                Your funds are held in segregated accounts and protected under financial regulations.
                All transactions are verified and monitored for security.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- FORM COLUMN (RIGHT) --- */}
      <div className="lg:col-span-7">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">
          Submit Deposit Request
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Account Selection */}
          <div>
            <label htmlFor="depositAccount" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Trading Account
            </label>
            <select
              id="depositAccount"
              {...register('accountId')}
              className="w-full px-4 py-3.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-base font-medium"
            >
              {liveAccounts.map(acc => {
                const balance = acc.balances.find(b => b.currency === acc.currency);
                return (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_id} - {formatCurrency(balance?.amount || 0, acc.currency)}
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
            <label htmlFor="depositAmount" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Deposit Amount (USDT)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-4 text-base font-bold text-slate-500 dark:text-slate-400">
                $
              </span>
              <input
                type="number"
                id="depositAmount"
                {...register('amount', { valueAsNumber: true })}
                placeholder="0.00"
                min="5"
                max="100000"
                step="0.01"
                className="w-full pl-8 pr-4 py-3.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-lg font-semibold"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Min: $5.00 | Max: $100,000.00
            </p>
            {errors.amount && (
              <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>
            )}
          </div>

          {/* Transaction Hash (Optional) */}
          <div>
            <label htmlFor="transactionHash" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Transaction Hash (Optional)
            </label>
            <input
              type="text"
              id="transactionHash"
              {...register('transactionHash')}
              placeholder="Enter Tron transaction hash (if available)"
              className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              You can find this in your wallet after sending
            </p>
          </div>

          {/* Your Wallet Address (Optional) */}
          <div>
            <label htmlFor="walletAddress" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Your Wallet Address (Optional)
            </label>
            <input
              type="text"
              id="walletAddress"
              {...register('walletAddress')}
              placeholder="Enter your Tron wallet address (TRC20)"
              className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              The address you sent USDT from
            </p>
          </div>

          {/* Receipt Upload - REQUIRED */}
          <div>
            <label htmlFor="receiptFile" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Payment Proof / Screenshot <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              <input
                type="file"
                id="receiptFile"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                onChange={handleFileChange}
                required
                className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/20 dark:file:text-indigo-300"
              />
              {receiptFile && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100 truncate">
                      {receiptFile.name}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      {(receiptFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceiptFile(null)}
                    className="flex-shrink-0 p-1 hover:bg-green-100 dark:hover:bg-green-900/40 rounded transition-colors"
                  >
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload screenshot or PDF of your payment confirmation. Max 10MB.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isProcessing || !receiptFile}
              className="w-full px-6 py-4 text-base font-semibold bg-[#00C0A2] hover:bg-[#00a085] text-white rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting Deposit...
                </span>
              ) : (
                'Submit Deposit Request'
              )}
            </button>
            {!receiptFile && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-2">
                Please upload payment proof before submitting
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default memo(DepositTab);

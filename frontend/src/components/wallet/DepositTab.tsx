import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAccountStore, formatBalance } from '../../stores/accountStore';
import { useUIStore } from '../../stores/uiStore';
import { CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { StripeCardNumberElement } from '@stripe/stripe-js';

// Validation schema
const depositSchema = z.object({
  accountId: z.string().min(1, 'Please select an account'),
  amount: z.number()
    .min(5, 'Minimum deposit amount is $5.00')
    .positive('Amount must be positive'),
});

type DepositFormData = z.infer<typeof depositSchema>;

type PaymentTab = 'card' | 'banking' | 'ewallet';

// Stripe Elements custom styles
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '14px',
      color: '#1e293b',
      '::placeholder': {
        color: '#94a3b8',
      },
    },
    invalid: {
      color: '#ef4444',
    },
  },
};

export default function DepositTab() {
  const stripe = useStripe();
  const elements = useElements();

  // Access stores
  const accounts = useAccountStore(state => state.accounts);
  const activeAccountId = useAccountStore(state => state.activeAccountId);
  const getActiveAccount = useAccountStore(state => state.getActiveAccount);
  const processDeposit = useAccountStore(state => state.processDeposit);
  const getFXRates = useAccountStore(state => state.getFXRates);
  const showToast = useUIStore(state => state.showToast);

  const activeAccount = getActiveAccount();

  // State
  const [selectedTab, setSelectedTab] = useState<PaymentTab>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardBrand, setCardBrand] = useState<string>('');

  // Track processed payment intents to prevent duplicate deposits
  const processedPayments = useRef<Set<string>>(new Set());

  // React Hook Form
  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      accountId: activeAccount?.id || accounts.find(a => a.type === 'live')?.id || '',
      amount: 0,
    },
  });

  const selectedAccountId = watch('accountId');

  // Update selected account when active account changes
  useEffect(() => {
    if (activeAccount) {
      setValue('accountId', activeAccount.id);
    }
  }, [activeAccountId, activeAccount, setValue]);

  // Handle FPX return redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');
    const redirectStatus = urlParams.get('redirect_status');

    if (paymentIntentClientSecret && redirectStatus) {
      // User returned from FPX payment
      setIsProcessing(true);

      // Extract payment intent ID from client secret (format: pi_xxx_secret_yyy)
      const paymentIntentId = paymentIntentClientSecret.split('_secret_')[0];

      // Fetch payment intent from backend (which includes metadata)
      fetch(`/api/v1/payment/status?payment_intent_id=${paymentIntentId}`)
        .then(response => response.json())
        .then(data => {
          if (data.status === 'succeeded') {
            // Check if this payment has already been processed (de-duplication)
            if (processedPayments.current.has(paymentIntentId)) {
              console.log('Payment already processed, skipping:', paymentIntentId);
              setIsProcessing(false);
              // Clean up URL and navigate to history
              window.history.replaceState({}, document.title, '/wallet');
              useUIStore.getState().setCurrentPage('wallet');
              return;
            }

            // Mark as processed IMMEDIATELY to prevent duplicates
            processedPayments.current.add(paymentIntentId);

            // Payment succeeded, process deposit
            // Get the ORIGINAL account ID from payment intent metadata (from backend)
            const metadata = data.metadata || {};
            const accountId = metadata.account_id;
            const originalAmount = parseFloat(metadata.original_amount || '0');
            const originalCurrency = metadata.original_currency || 'USD';

            if (!accountId) {
              showToast('Unable to identify deposit account. Please contact support.', 'error');
              setIsProcessing(false);
              window.history.replaceState({}, document.title, window.location.pathname);
              return;
            }

            // Verify the account still exists
            const account = accounts.find(a => a.id === accountId);
            if (!account) {
              showToast('Deposit account not found. Please contact support.', 'error');
              setIsProcessing(false);
              window.history.replaceState({}, document.title, window.location.pathname);
              return;
            }

            // Use the original amount and currency from metadata (not the payment intent amount)
            const amount = originalAmount;
            const accountCurrency = originalCurrency;

            processDeposit(accountId, amount, accountCurrency, paymentIntentId, {
              fpxBank: redirectStatus || 'fpx',
            }).then((result) => {
              if (result.success) {
                showToast('FPX payment successful!', 'success');

                // Navigate to History page to show the transaction
                window.history.replaceState({}, document.title, '/wallet');
                useUIStore.getState().setCurrentPage('wallet');
              } else {
                showToast(result.message, 'error');
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
              }
              setIsProcessing(false);
            });
          } else {
            showToast(`Payment ${data.status}. Please try again.`, 'error');
            setIsProcessing(false);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        })
        .catch((error) => {
          console.error('Error retrieving payment intent:', error);
          showToast('Failed to verify payment status', 'error');
          setIsProcessing(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, [activeAccount, accounts, processDeposit, showToast]);

  // Handle Stripe card brand detection
  useEffect(() => {
    if (!elements) return;

    const cardElement = elements.getElement(CardNumberElement);
    if (!cardElement) return;

    cardElement.on('change', (event) => {
      setCardBrand(event.brand || '');
    });
  }, [elements]);

  const onSubmit = async (data: DepositFormData) => {
    if (!stripe || !elements) {
      showToast('Stripe is not loaded. Please refresh the page.', 'error');
      return;
    }

    if (selectedTab !== 'card' && selectedTab !== 'banking') {
      showToast('Only card and online banking payments are currently supported.', 'error');
      return;
    }

    const account = accounts.find(a => a.id === data.accountId);
    if (!account) {
      showToast('Selected account not found.', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Create payment intent on backend
      const paymentMethodTypes = selectedTab === 'banking' ? ['fpx'] : ['card'];

      // FPX requires MYR currency, convert from account currency if needed
      let paymentCurrency = account.currency.toLowerCase();
      let paymentAmount = Math.round(data.amount * 100); // Convert to cents

      if (selectedTab === 'banking') {
        // FPX only supports MYR, convert from any currency to MYR
        paymentCurrency = 'myr';

        // Fetch live FX rates
        const rates = await getFXRates();

        // Convert account currency → USD → MYR
        // Step 1: Convert to USD (rates are X-to-USD, so multiply)
        const usdAmount = data.amount * (rates[account.currency] || 1.0);

        // Step 2: Convert USD to MYR (divide by MYR rate)
        const myrRate = rates['MYR'] || 0.22;
        const myrAmount = usdAmount / myrRate;

        paymentAmount = Math.round(myrAmount * 100); // Convert to cents
      }

      const response = await fetch('/api/v1/deposit/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentAmount,
          currency: paymentCurrency,
          payment_method_types: paymentMethodTypes,
          metadata: {
            account_id: data.accountId,
            original_amount: data.amount.toString(),
            original_currency: account.currency,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment intent');
      }

      const { clientSecret } = await response.json();

      // Step 2: Confirm payment with Stripe (card or FPX)
      let stripeError;
      let paymentIntent;

      if (selectedTab === 'card') {
        // Card payment
        const cardElement = elements.getElement(CardNumberElement) as StripeCardNumberElement;
        const result = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
          },
        });
        stripeError = result.error;
        paymentIntent = result.paymentIntent;
      } else if (selectedTab === 'banking') {
        // FPX payment (redirect-based)
        const result = await stripe.confirmFpxPayment(clientSecret, {
          payment_method: {
            fpx: {
              bank: 'maybank2u', // Default to Maybank, can be made selectable
            },
          },
          return_url: window.location.origin + '/wallet?payment=fpx',
        });
        stripeError = result.error;
        paymentIntent = result.paymentIntent;

        // FPX redirects to bank, so if we get here without error, show message
        if (!stripeError) {
          showToast('Redirecting to your bank...', 'success');
          // User will be redirected, processing will continue after return
          return;
        }
      }

      if (stripeError) {
        showToast(stripeError.message || 'Payment failed', 'error');
        setIsProcessing(false);
        return;
      }

      // Step 3: Poll payment status from backend
      if (paymentIntent?.id) {
        showToast('Processing payment...', 'success');

        // Poll the backend endpoint every 3 seconds for up to 60 seconds
        const maxAttempts = 20; // 20 attempts * 3 seconds = 60 seconds
        let attempts = 0;
        let depositProcessed = false; // Flag to prevent duplicate processing

        const pollInterval = setInterval(async () => {
          attempts++;

          // Skip if deposit already processed in this session
          if (depositProcessed || processedPayments.current.has(paymentIntent.id)) {
            return;
          }

          try {
            const statusResponse = await fetch(`/api/v1/payment/status?payment_intent_id=${paymentIntent.id}`);

            if (!statusResponse.ok) {
              clearInterval(pollInterval);
              showToast('Failed to check payment status', 'error');
              setIsProcessing(false);
              return;
            }

            const statusData = await statusResponse.json();

            if (statusData.status === 'succeeded') {
              // Mark as processed IMMEDIATELY before any async operations
              depositProcessed = true;
              processedPayments.current.add(paymentIntent.id);
              clearInterval(pollInterval);

              // Process deposit in account store
              const result = await processDeposit(
                data.accountId,
                data.amount,
                account.currency,
                paymentIntent.id,
                {
                  cardBrand: cardBrand,
                  last4: '****',
                }
              );

              if (result.success) {
                reset();
                // Clear card elements only for card payments
                if (selectedTab === 'card' && elements) {
                  const cardNumberElement = elements.getElement(CardNumberElement);
                  cardNumberElement?.clear();
                  setCardBrand('');
                }
                showToast('Deposit successful!', 'success');

                // Navigate to Wallet/History page to show the transaction
                useUIStore.getState().setCurrentPage('wallet');
              } else {
                showToast(result.message, 'error');
              }
              setIsProcessing(false);
            } else if (statusData.status === 'requires_payment_method' || statusData.status === 'canceled') {
              clearInterval(pollInterval);
              showToast(`Payment ${statusData.status}. Please try again.`, 'error');
              setIsProcessing(false);
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              showToast('Payment processing timeout. Please check your transaction history.', 'error');
              setIsProcessing(false);
            }
          } catch (error) {
            clearInterval(pollInterval);
            showToast('Failed to check payment status', 'error');
            setIsProcessing(false);
          }
        }, 3000); // Poll every 3 seconds
      } else {
        showToast('Payment intent not found', 'error');
      }
    } catch (error) {
      console.error('Deposit error:', error);
      showToast(error instanceof Error ? error.message : 'Deposit failed', 'error');
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
        Deposit Funds
      </h2>

      {/* Payment Method Tabs */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Payment Method
        </label>
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setSelectedTab('card')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'card'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Card
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('banking')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'banking'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Online Banking
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('ewallet')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'ewallet'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            eWallet
          </button>
        </div>
      </div>

      {/* Card Payment Form */}
      {selectedTab === 'card' && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Account Selection */}
          <div>
            <label htmlFor="depositAccount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Trading Account
            </label>
            <select
              id="depositAccount"
              {...register('accountId')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {liveAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.id} - {formatBalance(acc.balances[acc.currency], acc.currency)}
                </option>
              ))}
            </select>
            {errors.accountId && (
              <p className="text-xs text-red-500 mt-1">{errors.accountId.message}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="depositAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Amount of Deposit (Minimum: $5.00)
            </label>
            <div className="relative">
              <input
                type="number"
                id="depositAmount"
                {...register('amount', { valueAsNumber: true })}
                placeholder="0.00"
                min="5"
                step="0.01"
                className="w-full px-3 py-2 pr-16 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="absolute right-3 top-2.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                {accounts.find(a => a.id === selectedAccountId)?.currency || 'USD'}
              </span>
            </div>
            {errors.amount && (
              <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>
            )}
          </div>

          {/* Stripe Card Elements */}
          <div className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Card Information
              {cardBrand && <span className="ml-2 text-xs text-slate-500">({cardBrand.toUpperCase()})</span>}
            </p>

            {/* Card Number */}
            <div className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700">
              <CardNumberElement options={CARD_ELEMENT_OPTIONS} />
            </div>

            {/* Expiry and CVC */}
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700">
                <CardExpiryElement options={CARD_ELEMENT_OPTIONS} />
              </div>
              <div className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700">
                <CardCvcElement options={CARD_ELEMENT_OPTIONS} />
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your payment is secured by Stripe. We never store your card details.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isProcessing || !stripe}
            className="w-full px-4 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Confirm Deposit'}
          </button>
        </form>
      )}

      {/* Online Banking - FPX (Malaysia) */}
      {selectedTab === 'banking' && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Account Selection */}
          <div>
            <label htmlFor="bankingDepositAccount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Trading Account
            </label>
            <select
              id="bankingDepositAccount"
              {...register('accountId')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {liveAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.id} - {formatBalance(acc.balances[acc.currency], acc.currency)}
                </option>
              ))}
            </select>
            {errors.accountId && (
              <p className="text-xs text-red-500 mt-1">{errors.accountId.message}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="bankingDepositAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Amount of Deposit (Minimum: $5.00)
            </label>
            <div className="relative">
              <input
                type="number"
                id="bankingDepositAmount"
                {...register('amount', { valueAsNumber: true })}
                placeholder="0.00"
                min="5"
                step="0.01"
                className="w-full px-3 py-2 pr-16 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="absolute right-3 top-2.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                {accounts.find(a => a.id === selectedAccountId)?.currency || 'USD'}
              </span>
            </div>
            {errors.amount && (
              <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>
            )}
          </div>

          {/* FPX Payment Method Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  FPX Online Banking (Malaysia)
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                  You will be redirected to your bank&apos;s website to complete the payment securely.
                  After completing the payment, you&apos;ll be redirected back to this page.
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  💱 Payment will be processed in MYR (Malaysian Ringgit) using live exchange rates.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isProcessing || !stripe || !elements}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {isProcessing ? 'Processing...' : 'Pay with FPX Online Banking'}
          </button>

          <p className="text-xs text-center text-slate-500 dark:text-slate-400">
            Secure payment powered by Stripe. Your bank details are never stored on our servers.
          </p>
        </form>
      )}

      {/* eWallet Options */}
      {selectedTab === 'ewallet' && (
        <div className="space-y-4">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Select your preferred eWallet method:
          </div>

          {/* PayPal Option */}
          <button
            disabled
            className="w-full py-4 px-6 border-2 border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed opacity-60 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                P
              </div>
              <div className="text-left">
                <div className="font-semibold text-slate-900 dark:text-slate-100">PayPal</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Fast and secure payments</div>
              </div>
            </div>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-600 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
              Coming Soon
            </span>
          </button>

          {/* Skrill Option */}
          <button
            disabled
            className="w-full py-4 px-6 border-2 border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed opacity-60 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                S
              </div>
              <div className="text-left">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Skrill</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Popular for trading</div>
              </div>
            </div>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-600 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
              Coming Soon
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

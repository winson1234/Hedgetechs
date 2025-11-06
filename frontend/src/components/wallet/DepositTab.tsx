import { useState, useEffect, useRef, memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getApiUrl } from '../../config/api';
import { useAccountStore, formatBalance } from '../../stores/accountStore';
import { useUIStore } from '../../stores/uiStore';
import { CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements, PaymentRequestButtonElement } from '@stripe/react-stripe-js';
import type { StripeCardNumberElement, PaymentRequest } from '@stripe/stripe-js';

// Validation schema
const depositSchema = z.object({
  accountId: z.string().min(1, 'Please select an account'),
  amount: z.number()
    .min(5, 'Minimum deposit amount is $5.00')
    .positive('Amount must be positive'),
});

type DepositFormData = z.infer<typeof depositSchema>;

type PaymentTab = 'card' | 'banking' | 'crypto';

function DepositTab() {
  const stripe = useStripe();
  const elements = useElements();
  
  // Get dark mode state
  const isDarkMode = useUIStore(state => state.isDarkMode);
  
  // Stripe Elements custom styles (dynamic based on dark mode)
  const CARD_ELEMENT_OPTIONS = {
    style: {
      base: {
        fontSize: '14px',
        color: isDarkMode ? '#ffffff' : '#1e293b', // White text in dark mode, dark text in light mode
        '::placeholder': {
          color: isDarkMode ? '#94a3b8' : '#94a3b8',
        },
      },
      invalid: {
        color: '#ef4444',
      },
    },
  };

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
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [selectedFpxBank, setSelectedFpxBank] = useState<string>('maybank2u');

  // Track processed payment intents to prevent duplicate deposits
  // Using localStorage to persist across page navigations (for redirect-based payments)
  const getInitialProcessedPayments = (): Set<string> => {
    try {
      const stored = localStorage.getItem('processed_payments');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Clean up old entries (older than 1 hour)
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const filtered = Object.entries(parsed)
          .filter(([, timestamp]) => (timestamp as number) > oneHourAgo)
          .reduce((acc, [id]) => acc.add(id), new Set<string>());
        return filtered;
      }
    } catch (error) {
      console.error('Error loading processed payments:', error);
    }
    return new Set<string>();
  };

  const processedPayments = useRef<Set<string>>(getInitialProcessedPayments());

  // React Hook Form
  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      accountId: activeAccount?.id || accounts.find(a => a.type === 'live')?.id || '',
      amount: 0,
    },
  });

  const selectedAccountId = watch('accountId');

  // Helper function to mark payment as processed (persists to localStorage)
  const markPaymentAsProcessed = (paymentIntentId: string) => {
    processedPayments.current.add(paymentIntentId);

    try {
      // Store in localStorage with timestamp for cleanup
      const stored = localStorage.getItem('processed_payments');
      const processed = stored ? JSON.parse(stored) : {};
      processed[paymentIntentId] = Date.now();
      localStorage.setItem('processed_payments', JSON.stringify(processed));
    } catch (error) {
      console.error('Error saving processed payment:', error);
    }
  };

  // Update selected account when active account changes
  useEffect(() => {
    if (activeAccount) {
      setValue('accountId', activeAccount.id);
    }
  }, [activeAccountId, activeAccount, setValue]);

  // Handle redirect-based payment return (FPX, eWallets)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentIntentClientSecret = urlParams.get('payment_intent_client_secret');
    const redirectStatus = urlParams.get('redirect_status');
    const payment = urlParams.get('payment');

    if (paymentIntentClientSecret && redirectStatus && payment === 'redirect') {
      // User returned from redirect-based payment
      setIsProcessing(true);

      // Extract payment intent ID from client secret (format: pi_xxx_secret_yyy)
      const paymentIntentId = paymentIntentClientSecret.split('_secret_')[0];

      // Fetch payment intent from backend (which includes metadata)
      fetch(getApiUrl(`/api/v1/payment/status?payment_intent_id=${paymentIntentId}`))
        .then(response => response.json())
        .then(data => {
          if (data.status === 'succeeded') {
            // Check if this payment has already been processed (de-duplication)
            if (processedPayments.current.has(paymentIntentId)) {
              console.log('Payment already processed, skipping:', paymentIntentId);
              setIsProcessing(false);
              window.history.replaceState({}, document.title, window.location.pathname);
              return;
            }

            // Mark as processed IMMEDIATELY to prevent duplicates
            markPaymentAsProcessed(paymentIntentId);

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
              fpxBank: redirectStatus || 'redirect',
            }).then((result) => {
              if (result.success) {
                showToast('Payment successful!', 'success');

                // Transaction processed successfully
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

  // Set up Apple Pay / Google Pay payment request
  useEffect(() => {
    if (!stripe) return;

    // Get selected account
    const account = accounts.find(a => a.id === selectedAccountId) || activeAccount;
    if (!account) return;

    // Dynamic country mapping based on currency
    const getCurrencyCountry = (currency: string): string => {
      const countryMap: Record<string, string> = {
        'USD': 'US',
        'EUR': 'GB',  // Using GB for broader Apple/Google Pay support
        'MYR': 'MY',
        'JPY': 'JP',
        'GBP': 'GB',
        'CNY': 'CN',
      };
      return countryMap[currency.toUpperCase()] || 'US';
    };

    const accountCurrency = account.currency.toLowerCase();
    const country = getCurrencyCountry(account.currency);

    const pr = stripe.paymentRequest({
      country: country,
      currency: accountCurrency,
      total: {
        label: 'Deposit to Trading Account',
        amount: 500, // $5.00 in cents (minimum deposit) - will be updated when user enters amount
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    // Check if Apple Pay / Google Pay is available
    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
      }
    });

    // Handle payment method event
    pr.on('paymentmethod', async (e) => {
      const amount = watch('amount');
      const accountId = watch('accountId');
      const account = accounts.find(a => a.id === accountId);

      if (!account || amount < 5) {
        e.complete('fail');
        showToast('Please enter a valid amount (minimum $5.00)', 'error');
        return;
      }

      try {
        // Create payment intent
        const response = await fetch(getApiUrl('/api/v1/deposit/create-payment-intent'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Math.round(amount * 100),
            currency: account.currency.toLowerCase(),
            payment_method_types: ['card'],
            metadata: {
              account_id: accountId,
              original_amount: amount.toString(),
              original_currency: account.currency,
            },
          }),
        });

        if (!response.ok) {
          e.complete('fail');
          showToast('Failed to create payment intent', 'error');
          return;
        }

        const { clientSecret } = await response.json();

        // Confirm payment
        const { error, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: e.paymentMethod.id },
          { handleActions: false }
        );

        if (error) {
          e.complete('fail');
          showToast(error.message || 'Payment failed', 'error');
          return;
        }

        e.complete('success');

        // Check if already processed
        if (paymentIntent && !processedPayments.current.has(paymentIntent.id)) {
          markPaymentAsProcessed(paymentIntent.id);

          // Process deposit
          const result = await processDeposit(
            accountId,
            amount,
            account.currency,
            paymentIntent.id,
            {
              cardBrand: e.paymentMethod.card?.brand || 'digital_wallet',
              last4: e.paymentMethod.card?.last4 || '****',
            }
          );

          if (result.success) {
            showToast('Digital wallet payment successful!', 'success');
            reset();
          } else {
            showToast(result.message, 'error');
          }
        }
      } catch (error) {
        e.complete('fail');
        console.error('Digital wallet payment error:', error);
        showToast('Payment failed. Please try again.', 'error');
      }
    });
  }, [stripe, watch, accounts, showToast, processDeposit, reset, selectedAccountId, activeAccount]);

  // Update payment request when amount changes
  useEffect(() => {
    if (!paymentRequest) return;

    const amount = watch('amount');
    if (amount && amount >= 5) {
      // Update the payment request total amount
      paymentRequest.update({
        total: {
          label: 'Deposit to Trading Account',
          amount: Math.round(amount * 100), // Convert to cents
        },
      });
    }
  }, [watch, paymentRequest]);

  const onSubmit = async (data: DepositFormData) => {
    if (!stripe || !elements) {
      showToast('Stripe is not loaded. Please refresh the page.', 'error');
      return;
    }

    if (selectedTab !== 'card' && selectedTab !== 'banking' && selectedTab !== 'crypto') {
      showToast('Only card and banking payments are currently supported.', 'error');
      return;
    }

    const account = accounts.find(a => a.id === data.accountId);
    if (!account) {
      showToast('Selected account not found.', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Determine payment method and currency requirements
      let paymentMethodTypes: string[] = ['card'];
      let paymentCurrency = account.currency.toLowerCase();
      let paymentAmount = Math.round(data.amount * 100); // Convert to cents

      // Fetch live FX rates if currency conversion needed
      const rates = await getFXRates();

      // Validate rates object exists
      if (!rates || Object.keys(rates).length === 0) {
        showToast('Unable to fetch exchange rates. Please try again.', 'error');
        setIsProcessing(false);
        return;
      }

      if (selectedTab === 'banking') {
        // FPX requires MYR
        paymentMethodTypes = ['fpx'];
        paymentCurrency = 'myr';

        // Proper currency triangulation: account currency → USD → MYR
        const accountRate = rates[account.currency] || 1.0;
        const myrRate = rates['MYR'] || 0.22;
        paymentAmount = Math.round((data.amount * accountRate / myrRate) * 100);
      }

      const response = await fetch(getApiUrl('/api/v1/deposit/create-payment-intent'), {
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

      // Step 2: Confirm payment with Stripe
      let stripeError;
      let paymentIntent;

      if (selectedTab === 'card') {
        // Card payment (non-redirect)
        const cardElement = elements.getElement(CardNumberElement) as StripeCardNumberElement;
        const result = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
          },
        });
        stripeError = result.error;
        paymentIntent = result.paymentIntent;
      } else if (selectedTab === 'banking') {
        // FPX banking payment
        const result = await stripe.confirmFpxPayment(clientSecret, {
          payment_method: {
            fpx: {
              bank: selectedFpxBank,
            },
          },
          return_url: window.location.origin + '/wallet?payment=redirect',
        });

        stripeError = result.error;
        paymentIntent = result.paymentIntent;

        // If payment requires redirect, user will be redirected automatically
        // If we get here without error and no paymentIntent, redirect is happening
        if (!stripeError && !paymentIntent) {
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
            const statusResponse = await fetch(getApiUrl(`/api/v1/payment/status?payment_intent_id=${paymentIntent.id}`));

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
              markPaymentAsProcessed(paymentIntent.id);
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

                // Transaction processed successfully
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
      {/* --- INFO COLUMN (LEFT) --- */}
      <div className="lg:col-span-5 lg:border-r lg:border-slate-300 dark:lg:border-slate-700 lg:pr-8">
        <div className="lg:sticky lg:top-8">
          <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-xl font-bold mb-5 text-slate-900 dark:text-slate-100">
              {selectedTab === 'card' && 'Card Payment'}
              {selectedTab === 'banking' && 'Online Banking'}
              {selectedTab === 'crypto' && 'Cryptocurrency'}
            </h3>

            {selectedTab === 'card' && (
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">✓</span>
                  <span>Secured by Stripe - Industry-leading payment security</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">✓</span>
                  <span>Instant processing - Funds available immediately</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">✓</span>
                  <span>Your card details are never stored on our servers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">✓</span>
                  <span>All major cards accepted: Visa, Mastercard, Amex</span>
                </li>
              </ul>
            )}

            {selectedTab === 'banking' && (
              <>
                <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">✓</span>
                    <span>Secure redirect to your bank&apos;s website</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">✓</span>
                    <span>Bank-level authentication and security</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">✓</span>
                    <span>Automatic currency conversion to MYR at live rates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">✓</span>
                    <span>FPX Online Banking - Malaysia&apos;s trusted payment method</span>
                  </li>
                </ul>

                {/* FPX-specific info box */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        FPX Online Banking (Malaysia)
                      </h4>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                        You will be redirected to your bank&apos;s website to complete the payment securely. After completing the payment, you&apos;ll be redirected back to this page.
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        💱 Payment will be processed in MYR (Malaysian Ringgit) using live exchange rates.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {selectedTab === 'crypto' && (
              <>
                <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">✓</span>
                    <span>Pay with Bitcoin, Ethereum, USDT, and more</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">✓</span>
                    <span>Blockchain-verified and secure transactions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">✓</span>
                    <span>Automatic credit after confirmation (typically 10-30 min)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">✓</span>
                    <span>Powered by NOWPayments - supports 300+ cryptocurrencies</span>
                  </li>
                </ul>

                {/* Crypto-specific info box */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Cryptocurrency Payment
                      </h4>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                        You will be redirected to NOWPayments to complete your payment with Bitcoin, Ethereum, USDT, or 300+ other supported cryptocurrencies. Choose your preferred crypto on the payment page.
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        ⚡ Your account will be credited automatically after blockchain confirmation
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="mt-6 pt-6 border-t border-slate-300 dark:border-slate-600">
              <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
                Your funds are held in segregated accounts and protected under financial regulations. All transactions are encrypted and monitored for fraud prevention.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- FORM COLUMN (RIGHT) --- */}
      <div className="lg:col-span-7">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">
          Deposit Funds
        </h2>

        {/* Payment Method Tabs */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Payment Method
          </label>
          <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSelectedTab('card')}
                className={`px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                  selectedTab === 'card'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Card
              </button>
              <button
                type="button"
                onClick={() => setSelectedTab('banking')}
                className={`px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                  selectedTab === 'banking'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Banking
              </button>
              <button
                type="button"
                onClick={() => setSelectedTab('crypto')}
                className={`px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                  selectedTab === 'crypto'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Crypto
              </button>
            </div>
          </div>

      {/* Card Payment Form */}
      {selectedTab === 'card' && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Apple Pay / Google Pay Button */}
          {paymentRequest && (
            <>
              <div className="pb-4 border-b border-slate-200 dark:border-slate-700">
                <PaymentRequestButtonElement
                  options={{
                    paymentRequest,
                    style: {
                      paymentRequestButton: {
                        theme: isDarkMode ? 'light' : 'dark',
                        height: '48px',
                        type: 'default',
                      }
                    }
                  }}
                />
              </div>

              {/* OR Divider */}
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium">
                    OR PAY WITH CARD
                  </span>
                </div>
              </div>
            </>
          )}

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
            <label htmlFor="depositAmount" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
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
                className="w-full px-4 py-3.5 pr-20 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-lg font-semibold"
              />
              <span className="absolute right-4 top-4 text-base font-bold text-slate-500 dark:text-slate-400">
                {accounts.find(a => a.id === selectedAccountId)?.currency || 'USD'}
              </span>
            </div>
            {errors.amount && (
              <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>
            )}
          </div>

          {/* Stripe Card Elements */}
          <div className="space-y-4 border-t-2 border-slate-200 dark:border-slate-700 pt-6">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Card Information
              {cardBrand && <span className="ml-2 text-xs text-slate-500 uppercase">({cardBrand})</span>}
            </p>

            {/* Card Number */}
            <div className="px-4 py-4 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 transition-all focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
              <CardNumberElement options={{
                ...CARD_ELEMENT_OPTIONS,
                style: {
                  base: {
                    ...CARD_ELEMENT_OPTIONS.style.base,
                    fontSize: '16px',
                  }
                }
              }} />
            </div>

            {/* Expiry and CVC */}
            <div className="grid grid-cols-2 gap-4">
              <div className="px-4 py-4 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 transition-all focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                <CardExpiryElement options={{
                  ...CARD_ELEMENT_OPTIONS,
                  style: {
                    base: {
                      ...CARD_ELEMENT_OPTIONS.style.base,
                      fontSize: '16px',
                    }
                  }
                }} />
              </div>
              <div className="px-4 py-4 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 transition-all focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                <CardCvcElement options={{
                  ...CARD_ELEMENT_OPTIONS,
                  style: {
                    base: {
                      ...CARD_ELEMENT_OPTIONS.style.base,
                      fontSize: '16px',
                    }
                  }
                }} />
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
            className="w-full px-6 py-4 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
          >
            {isProcessing ? 'Processing...' : 'Confirm Deposit'}
          </button>
        </form>
      )}

      {/* Online Banking - FPX */}
      {selectedTab === 'banking' && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Account Selection */}
          <div>
            <label htmlFor="bankingDepositAccount" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Trading Account
            </label>
            <select
              id="bankingDepositAccount"
              {...register('accountId')}
              className="w-full px-4 py-3.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-base font-medium"
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
            <label htmlFor="bankingDepositAmount" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
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
                className="w-full px-4 py-3.5 pr-20 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-lg font-semibold"
              />
              <span className="absolute right-4 top-4 text-base font-bold text-slate-500 dark:text-slate-400">
                {accounts.find(a => a.id === selectedAccountId)?.currency || 'USD'}
              </span>
            </div>
            {errors.amount && (
              <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>
            )}
          </div>

          {/* FPX Bank Selection */}
          <div>
            <label htmlFor="fpxBankSelect" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Select Your Bank
            </label>
            <select
              id="fpxBankSelect"
              value={selectedFpxBank}
              onChange={(e) => setSelectedFpxBank(e.target.value)}
              className="w-full px-4 py-3.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-base font-medium"
            >
              <option value="maybank2u">Maybank2u</option>
              <option value="cimb">CIMB Clicks</option>
              <option value="public_bank">Public Bank</option>
              <option value="rhb">RHB Bank</option>
              <option value="hong_leong_bank">Hong Leong Bank</option>
              <option value="ambank">AmBank</option>
              <option value="affin_bank">Affin Bank</option>
              <option value="alliance_bank">Alliance Bank</option>
              <option value="bank_islam">Bank Islam</option>
              <option value="bank_muamalat">Bank Muamalat</option>
              <option value="bank_rakyat">Bank Rakyat</option>
              <option value="bsn">BSN</option>
              <option value="hsbc">HSBC Bank</option>
              <option value="kfh">Kuwait Finance House</option>
              <option value="maybank2e">Maybank2E</option>
              <option value="ocbc">OCBC Bank</option>
              <option value="standard_chartered">Standard Chartered</option>
              <option value="uob">UOB Bank</option>
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Please select your bank to proceed with FPX payment
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isProcessing || !stripe || !elements}
            className="w-full px-6 py-4 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
          >
            {isProcessing ? 'Processing...' : 'Pay with FPX'}
          </button>
        </form>
      )}

      {/* Crypto Payment Form */}
      {selectedTab === 'crypto' && (
        <form onSubmit={async (e) => {
          e.preventDefault();

          const account = accounts.find(a => a.id === watch('accountId'));
          const amount = watch('amount');

          if (!account || amount < 5) {
            showToast('Please enter a valid amount (minimum $5.00)', 'error');
            return;
          }

          setIsProcessing(true);

          try {
            // Call backend to create NOWPayments charge
            const response = await fetch(getApiUrl('/api/v1/deposit/create-crypto-charge'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accountId: account.id,
                amount: amount,
                currency: account.currency,
              }),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Failed to create crypto charge');
            }

            const data = await response.json();

            // Store charge info in localStorage for later reference
            localStorage.setItem('pending_crypto_deposit', JSON.stringify({
              chargeId: data.charge_id,
              accountId: account.id,
              amount: amount,
              currency: account.currency,
              timestamp: Date.now(),
            }));

            // Redirect to NOWPayments hosted payment page
            window.location.href = data.hosted_url;

          } catch (error) {
            console.error('Crypto charge creation error:', error);
            showToast(error instanceof Error ? error.message : 'Failed to create crypto charge', 'error');
            setIsProcessing(false);
          }
        }} className="space-y-4">
          {/* Account Selection */}
          <div>
            <label htmlFor="cryptoDepositAccount" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Trading Account
            </label>
            <select
              id="cryptoDepositAccount"
              {...register('accountId')}
              className="w-full px-4 py-3.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-base font-medium"
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
            <label htmlFor="cryptoDepositAmount" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Amount of Deposit (Minimum: $5.00)
            </label>
            <div className="relative">
              <input
                type="number"
                id="cryptoDepositAmount"
                {...register('amount', { valueAsNumber: true })}
                placeholder="0.00"
                min="5"
                step="0.01"
                className="w-full px-4 py-3.5 pr-20 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-lg font-semibold"
              />
              <span className="absolute right-4 top-4 text-base font-bold text-slate-500 dark:text-slate-400">
                {accounts.find(a => a.id === selectedAccountId)?.currency || 'USD'}
              </span>
            </div>
            {errors.amount && (
              <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isProcessing}
            className="w-full px-6 py-4 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
          >
            {isProcessing ? 'Redirecting...' : 'Pay with Cryptocurrency'}
          </button>
        </form>
      )}
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders from WebSocket updates
export default memo(DepositTab);

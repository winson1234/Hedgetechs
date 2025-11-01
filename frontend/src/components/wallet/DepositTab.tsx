import { useState, useEffect } from 'react';
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
  const showToast = useUIStore(state => state.showToast);

  const activeAccount = getActiveAccount();

  // State
  const [selectedTab, setSelectedTab] = useState<PaymentTab>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardBrand, setCardBrand] = useState<string>('');

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

    if (selectedTab !== 'card') {
      showToast('Only card payments are currently supported.', 'error');
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
      const response = await fetch('/api/v1/deposit/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(data.amount * 100), // Convert to cents
          currency: account.currency.toLowerCase(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment intent');
      }

      const { clientSecret } = await response.json();

      // Step 2: Confirm card payment with Stripe
      const cardElement = elements.getElement(CardNumberElement) as StripeCardNumberElement;
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (stripeError) {
        showToast(stripeError.message || 'Payment failed', 'error');
        setIsProcessing(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        // Step 3: Process deposit in account store
        const result = await processDeposit(
          data.accountId,
          data.amount,
          account.currency,
          paymentIntent.id,
          {
            cardBrand: cardBrand,
            last4: '****', // Card last4 not directly available from PaymentIntent in this flow
          }
        );

        if (result.success) {
          // Clear form
          reset();
          cardElement.clear();
          setCardBrand('');
          showToast('Deposit successful!', 'success');
        } else {
          showToast(result.message, 'error');
        }
      } else {
        showToast(`Payment status: ${paymentIntent?.status}`, 'error');
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

      {/* Online Banking Placeholder */}
      {selectedTab === 'banking' && (
        <div className="text-center py-12 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
          <p className="text-slate-500 dark:text-slate-400">
            Online Banking deposits coming soon!
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            We&apos;re working on integrating FPX and other banking methods.
          </p>
        </div>
      )}

      {/* eWallet Placeholder */}
      {selectedTab === 'ewallet' && (
        <div className="text-center py-12 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
          <p className="text-slate-500 dark:text-slate-400">
            eWallet deposits coming soon!
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            We&apos;re working on integrating PayPal, Skrill, and other eWallets.
          </p>
        </div>
      )}
    </div>
  );
}

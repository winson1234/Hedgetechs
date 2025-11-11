import { useState, useEffect, memo } from 'react';

import type { Account } from '../types'

// Define expected return type from openAccount function
type OpenAccountResult = {
  success: boolean
  message?: string
  account?: Account
}

type OpenAccountModalProps = {
  isOpen: boolean
  onClose: () => void
  openAccount: (
    type: 'live' | 'demo',
    productType: 'spot' | 'cfd' | 'futures',
    currency: string,
    initialBalance: number
  ) => Promise<OpenAccountResult>
  onAccountCreated: (message: string) => void
}

// Supported Currencies
const supportedCurrencies = ['USD', 'EUR', 'MYR', 'JPY']
const demoInitialBalancePresets = [1000, 5000, 10000, 50000, 100000]
const MIN_DEMO_BALANCE = 100
const MAX_DEMO_BALANCE = 1000000

// Product types for trading accounts
const productTypes: Array<{ value: 'spot' | 'cfd' | 'futures'; label: string; description: string }> = [
  { value: 'spot', label: 'Spot', description: 'Trade assets at current market prices' },
  { value: 'cfd', label: 'CFD', description: 'Contracts for Difference trading' },
  { value: 'futures', label: 'Futures', description: 'Futures contracts trading' },
]

function OpenAccountModal({
  isOpen,
  onClose,
  openAccount,
  onAccountCreated,
}: OpenAccountModalProps) {
  const [accountType, setAccountType] = useState<'live' | 'demo'>('live')
  const [productType, setProductType] = useState<'spot' | 'cfd' | 'futures'>('spot')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD')
  const [initialBalance, setInitialBalance] = useState<string>('10000')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balanceError, setBalanceError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setProductType('spot')
      setSelectedCurrency('USD')
      setInitialBalance('10000')
      setError(null)
      setBalanceError(null)
      setIsLoading(false)
    }
  }, [isOpen])

   // Validate demo balance
  useEffect(() => {
    if (accountType === 'demo') {
      const balanceNum = parseFloat(initialBalance);
      if (isNaN(balanceNum)) {
        setBalanceError('Please enter a valid number.');
      } else if (balanceNum < MIN_DEMO_BALANCE || balanceNum > MAX_DEMO_BALANCE) {
        setBalanceError(`Balance must be between ${MIN_DEMO_BALANCE} and ${MAX_DEMO_BALANCE}.`);
      } else {
        setBalanceError(null); // Clear error if valid
      }
    } else {
       setBalanceError(null); // No balance validation for live accounts here
    }
  }, [initialBalance, accountType]);


  const handleSubmit = async () => {
    setError(null)
    // Ensure demo balance is valid before proceeding
    if (accountType === 'demo' && balanceError) {
      return
    }

    setIsLoading(true)

    try {
      const balanceNum = accountType === 'demo' ? parseFloat(initialBalance) : 0

      const result = await openAccount(
        accountType,
        productType,
        selectedCurrency,
        balanceNum
      )

      if (result.success) {
        onAccountCreated(result.message || 'Account created successfully!')
        onClose() // Close modal on success
      } else {
        setError(result.message || 'Failed to open account. Please try again.')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to open account. Please try again.'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null;

  return (
    // Modal backdrop
    <div
      className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 transition-opacity duration-150" // High z-index
      onClick={onClose} // Close on backdrop click
    >
      {/* Modal Content */}
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Open New Account
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
        <div className="p-6 space-y-5">
          {/* Account Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Account Type
            </label>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
              <button
                onClick={() => setAccountType('live')}
                disabled={isLoading}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  accountType === 'live'
                    ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                }`}
              >
                Live
              </button>
              <button
                onClick={() => setAccountType('demo')}
                disabled={isLoading}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  accountType === 'demo'
                    ? 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                }`}
              >
                Demo
              </button>
            </div>
          </div>

          {/* Product Type Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Product Type
            </label>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
              {productTypes.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => setProductType(pt.value)}
                  disabled={isLoading}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                    productType === pt.value
                      ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {productTypes.find(pt => pt.value === productType)?.description}
            </p>
          </div>

          {/* Currency Selection */}
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Base Currency
            </label>
            <select
              id="currency"
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm disabled:opacity-70"
            >
              {supportedCurrencies.map(curr => (
                <option key={curr} value={curr}>{curr}</option>
              ))}
            </select>
            {accountType === 'live' && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Live accounts start with a 0 balance. Use the Deposit function after creation.
              </p>
            )}
          </div>

          {/* Initial Balance (Demo Only) */}
          {accountType === 'demo' && (
            <div>
              <label htmlFor="initialBalance" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Starting Balance ({selectedCurrency})
              </label>
               {/* Preset Buttons */}
               <div className="flex flex-wrap gap-2 mb-2">
                 {demoInitialBalancePresets.map(preset => (
                   <button
                     key={preset}
                     onClick={() => setInitialBalance(String(preset))}
                     disabled={isLoading}
                     className={`px-3 py-1 text-xs font-medium rounded border transition ${
                       initialBalance === String(preset)
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                     }`}
                   >
                     {preset.toLocaleString()}
                   </button>
                 ))}
               </div>
              <input
                type="number"
                id="initialBalance"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                min={MIN_DEMO_BALANCE}
                max={MAX_DEMO_BALANCE}
                step="100"
                disabled={isLoading}
                className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 text-sm disabled:opacity-70 ${
                    balanceError ? 'border-red-500 dark:border-red-600 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-indigo-500'
                }`}
              />
              {/* Validation Error Message */}
              {balanceError && (
                 <p className="mt-1 text-xs text-red-600 dark:text-red-500">{balanceError}</p>
              )}
            </div>
          )}

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
            disabled={isLoading || (accountType === 'demo' && !!balanceError)} // Disable if loading or balance error
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]" // Min width to prevent size change
          >
            {isLoading ? (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : (
                'Create Account'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Memoize to prevent re-renders when modal is not open
export default memo(OpenAccountModal);
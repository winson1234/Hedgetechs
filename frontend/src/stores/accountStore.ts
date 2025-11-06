import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Account, AccountStatus, PaymentMethodMetadata } from '../types'
import { useUIStore } from './uiStore'
import { useTransactionStore } from './transactionStore'
import { getApiUrl } from '../config/api'

// Helper Functions
const generateAccountId = (type: 'live' | 'demo'): string => {
  const prefix = type === 'live' ? 'L' : 'D'
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
}

const getDefaultAccounts = (): Account[] => [
  {
    id: generateAccountId('live'),
    type: 'live',
    currency: 'USD',
    balances: { USD: 10000, BTC: 1, ETH: 5, SOL: 100 },
    createdAt: Date.now() - 200000,
    status: 'active',
    platformType: 'integrated',
    platform: 'Brokerage Web',
    server: 'Primary Server',
  },
  {
    id: generateAccountId('demo'),
    type: 'demo',
    currency: 'USD',
    balances: { USD: 50000 },
    createdAt: Date.now(),
    status: 'active',
    platformType: 'integrated',
    platform: 'Brokerage Web',
    server: 'Primary Server',
  },
  {
    id: 'M-8032415',
    type: 'live',
    currency: 'USD',
    balances: { USD: 2500 },
    createdAt: Date.now() - 500000,
    status: 'active',
    platformType: 'external',
    platform: 'MetaTrader 5',
    server: 'Exness-MT5Real21',
  },
]

export const formatBalance = (balance: number | undefined, currency: string | undefined): string => {
  const numBalance = balance ?? 0
  const displayCurrency = currency || 'USD'

  // Custom symbols for currencies that don't render well with Intl
  const customSymbols: Record<string, string> = {
    'MYR': 'RM',  // Malaysian Ringgit
    'JPY': '¥',   // Japanese Yen
    'CNY': '¥',   // Chinese Yuan
  }

  // If we have a custom symbol, use it
  if (customSymbols[displayCurrency.toUpperCase()]) {
    return `${customSymbols[displayCurrency.toUpperCase()]} ${numBalance.toFixed(2)}`
  }

  try {
    return numBalance.toLocaleString('en-US', {
      style: 'currency',
      currency: displayCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  } catch (e) {
    console.warn(`Could not format currency for code: ${displayCurrency}. Falling back.`)
    return `${numBalance.toFixed(2)} ${displayCurrency}`
  }
}

interface AccountStore {
  // State
  accounts: Account[]
  activeAccountId: string | null

  // Selectors (computed properties)
  getActiveAccount: () => Account | undefined
  getActiveUsdBalance: () => number
  getActiveAccountCurrency: () => string
  getActiveCryptoHoldings: () => Record<string, number>

  // FX Rates Helper
  getFXRates: () => Promise<Record<string, number>>

  // Account Management Actions
  setActiveAccount: (id: string) => void
  openAccount: (
    type: 'live' | 'demo',
    currency: string,
    initialBalance?: number,
    platformType?: 'integrated' | 'external',
    platform?: string,
    server?: string
  ) => { success: boolean; message?: string }
  editDemoBalance: (accountId: string, newBalance: number) => { success: boolean; message?: string }
  toggleAccountStatus: (accountId: string) => void

  // Wallet Operations (internal - called by async wrappers)
  _executeDeposit: (accountId: string, amount: number, currency: string) => { success: boolean; message: string }
  _executeWithdraw: (accountId: string, amount: number, currency: string) => { success: boolean; message: string }
  _executeTransfer: (fromAccountId: string, toAccountId: string, amount: number, currency: string) => { success: boolean; message: string }

  // Async Wallet Operations (for UI - creates transactions)
  processDeposit: (accountId: string, amount: number, currency: string, paymentIntentId?: string, metadata?: PaymentMethodMetadata) => Promise<{ success: boolean; message: string; transactionId?: string }>
  processWithdrawal: (accountId: string, amount: number, currency: string, bankDetails?: PaymentMethodMetadata) => Promise<{ success: boolean; message: string; transactionId?: string }>
  processTransfer: (fromAccountId: string, toAccountId: string, amount: number, currency: string) => Promise<{ success: boolean; message: string; transactionId?: string }>

  // Trading Operations
  executeBuy: (symbol: string, amount: number, price: number) => { success: boolean; message: string }
  executeSell: (symbol: string, amount: number, price: number) => { success: boolean; message: string }
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set, get) => ({
      // Initial State
      accounts: [],
      activeAccountId: null,

      // Selectors
      getActiveAccount: () => {
        const { accounts, activeAccountId } = get()
        return accounts.find(acc => acc.id === activeAccountId)
      },

      getActiveUsdBalance: () => {
        const activeAccount = get().getActiveAccount()
        return activeAccount?.balances[activeAccount.currency] ?? 0
      },

      getActiveAccountCurrency: () => {
        const activeAccount = get().getActiveAccount()
        return activeAccount?.currency ?? 'USD'
      },

      getActiveCryptoHoldings: () => {
        const activeAccount = get().getActiveAccount()
        if (!activeAccount) return {}
        return Object.entries(activeAccount.balances)
          .filter(([key]) => key !== activeAccount.currency)
          .reduce((obj, [key, value]) => {
            obj[key] = value
            return obj
          }, {} as Record<string, number>)
      },

      // FX Rates Helper
      getFXRates: async () => {
        const fxRates: Record<string, number> = { USD: 1.0 } // USD to USD is always 1:1

        // Cache for 5 minutes
        const cacheKey = 'fx_rates_cache'
        const cacheTimeKey = 'fx_rates_cache_time'
        const cacheExpiry = 5 * 60 * 1000 // 5 minutes in milliseconds

        // Check if we have valid cached data
        const cachedTime = localStorage.getItem(cacheTimeKey)
        const cachedData = localStorage.getItem(cacheKey)

        if (cachedTime && cachedData) {
          const timeElapsed = Date.now() - parseInt(cachedTime)
          if (timeElapsed < cacheExpiry) {
            // Return cached data
            return JSON.parse(cachedData) as Record<string, number>
          }
        }

        // Fetch fresh FX rates from backend
        const currenciesToFetch = ['EUR', 'JPY', 'MYR'] // Add more currencies as needed

        try {
          await Promise.all(
            currenciesToFetch.map(async (currency) => {
              try {
                const response = await fetch(getApiUrl(`/api/v1/analytics?type=fx_rate&from=${currency}&to=USD`))
                const data = await response.json()

                if (data.status === 'success' && data.data?.rate) {
                  fxRates[currency] = data.data.rate
                }
              } catch (error) {
                console.error(`Failed to fetch ${currency}/USD rate:`, error)
                // Use fallback rates if API fails
                const fallbackRates: Record<string, number> = {
                  EUR: 1.08,
                  JPY: 0.0067,
                  MYR: 0.22,
                }
                fxRates[currency] = fallbackRates[currency] || 1.0
                console.warn(`Using fallback rate for ${currency}: ${fxRates[currency]}`)
              }
            })
          )

          // Cache the results
          localStorage.setItem(cacheKey, JSON.stringify(fxRates))
          localStorage.setItem(cacheTimeKey, Date.now().toString())
        } catch (error) {
          console.error('Failed to fetch FX rates:', error)
        }

        return fxRates
      },

      // Account Management Actions
      setActiveAccount: (id: string) => {
        const { accounts } = get()
        const showToast = useUIStore.getState().showToast
        const accountToSet = accounts.find(acc => acc.id === id)

        if (!accountToSet) {
          console.error(`Attempted switch to non-existent account: ${id}`)
          showToast(`Could not find account ${id}`, 'error')
          return
        }

        if (accountToSet.status !== 'active') {
          showToast('Deactivated or suspended accounts cannot be set as active.', 'error')
          return
        }

        if (accountToSet.platformType === 'external') {
          showToast('External platform accounts cannot be used for integrated trading.', 'error')
          return
        }

        set({ activeAccountId: id })
        showToast(`Switched to account ${id}`, 'success')
      },

      openAccount: (type, currency, initialBalance, platformType, platform, server) => {
        const { accounts } = get()
        const showToast = useUIStore.getState().showToast

        if (type === 'demo') {
          const demoCount = accounts.filter(acc => acc.type === 'demo').length
          if (demoCount >= 5) {
            showToast('Maximum number of demo accounts reached (5).', 'error')
            return { success: false, message: 'Maximum number of demo accounts reached (5).' }
          }
          if (initialBalance === undefined || initialBalance < 100 || initialBalance > 1000000) {
            showToast('Invalid starting balance for demo account.', 'error')
            return { success: false, message: 'Invalid starting balance.' }
          }
        }

        const newAccount: Account = {
          id: generateAccountId(type),
          type,
          currency,
          balances: { [currency]: type === 'demo' ? initialBalance! : 0 },
          createdAt: Date.now(),
          status: 'active',
          platformType: platformType || 'integrated',
          platform: platform || 'Brokerage Web',
          server: server || 'Primary Server',
        }

        set(state => ({ accounts: [...state.accounts, newAccount] }))
        showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} account ${newAccount.id} created.`, 'success')
        return { success: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} account created successfully!` }
      },

      editDemoBalance: (accountId, newBalance) => {
        const showToast = useUIStore.getState().showToast

        if (isNaN(newBalance) || newBalance < 100 || newBalance > 1000000) {
          showToast('Invalid balance amount provided.', 'error')
          return { success: false, message: 'Invalid balance amount.' }
        }

        let updated = false
        set(state => ({
          accounts: state.accounts.map(acc => {
            if (acc.id === accountId && acc.type === 'demo') {
              updated = true
              return { ...acc, balances: { ...acc.balances, [acc.currency]: newBalance } }
            }
            return acc
          })
        }))

        if (updated) {
          showToast(`Demo account ${accountId} balance updated.`, 'success')
          return { success: true, message: 'Balance updated successfully!' }
        } else {
          showToast(`Could not find Demo account ${accountId} to update.`, 'error')
          return { success: false, message: 'Account not found or is not a Demo account.' }
        }
      },

      toggleAccountStatus: (accountId) => {
        const { activeAccountId } = get()
        const showToast = useUIStore.getState().showToast

        if (accountId === activeAccountId) {
          showToast('Cannot deactivate the active trading account.', 'error')
          return
        }

        set(state => ({
          accounts: state.accounts.map(acc => {
            if (acc.id === accountId) {
              const newStatus: AccountStatus = acc.status === 'active' ? 'deactivated' : 'active'
              showToast(`Account ${accountId} ${newStatus === 'active' ? 'reactivated' : 'deactivated'}.`, 'success')
              return { ...acc, status: newStatus }
            }
            return acc
          })
        }))
      },

      // Wallet Operations (internal)
      _executeDeposit: (accountId, amount, currency) => {
        if (amount <= 0) {
          return { success: false, message: 'Invalid amount.' }
        }

        let accountFound = false
        set(state => ({
          accounts: state.accounts.map(acc => {
            if (acc.id === accountId) {
              accountFound = true
              const currentBalance = acc.balances[currency] ?? 0
              return {
                ...acc,
                balances: { ...acc.balances, [currency]: currentBalance + amount }
              }
            }
            return acc
          })
        }))

        if (accountFound) {
          return { success: true, message: 'Deposit successful!' }
        } else {
          return { success: false, message: 'Account not found.' }
        }
      },

      _executeWithdraw: (accountId, amount, currency) => {
        if (amount <= 0) {
          return { success: false, message: 'Invalid amount.' }
        }

        let success = false
        let message = 'Withdrawal failed.'

        set(state => ({
          accounts: state.accounts.map(acc => {
            if (acc.id === accountId) {
              const currentBalance = acc.balances[currency] ?? 0
              if (currentBalance < amount) {
                message = `Insufficient funds. You only have ${formatBalance(currentBalance, currency)}.`
                return acc
              }

              success = true
              message = 'Withdrawal successful!'

              return {
                ...acc,
                balances: { ...acc.balances, [currency]: currentBalance - amount }
              }
            }
            return acc
          })
        }))

        return { success, message }
      },

      _executeTransfer: (fromAccountId, toAccountId, amount, currency) => {
        const { accounts } = get()

        if (amount <= 0) {
          return { success: false, message: 'Invalid amount.' }
        }

        if (fromAccountId === toAccountId) {
          return { success: false, message: 'Cannot transfer to the same account.' }
        }

        const fromAcc = accounts.find(a => a.id === fromAccountId)
        const toAcc = accounts.find(a => a.id === toAccountId)

        if (!fromAcc || !toAcc) {
          return { success: false, message: 'One or both accounts not found.' }
        }

        if (fromAcc.currency !== toAcc.currency) {
          return { success: false, message: 'Cross-currency transfers are not supported.' }
        }

        const fromBalance = fromAcc.balances[currency] ?? 0
        if (fromBalance < amount) {
          return { success: false, message: `Insufficient funds in account ${fromAccountId}.` }
        }

        set(state => ({
          accounts: state.accounts.map(acc => {
            if (acc.id === fromAccountId) {
              return { ...acc, balances: { ...acc.balances, [currency]: fromBalance - amount } }
            }
            if (acc.id === toAccountId) {
              const toBalance = acc.balances[currency] ?? 0
              return { ...acc, balances: { ...acc.balances, [currency]: toBalance + amount } }
            }
            return acc
          })
        }))

        return { success: true, message: 'Transfer successful!' }
      },

      // Async Wallet Operations (for UI)
      processDeposit: async (accountId, amount, currency, paymentIntentId, metadata) => {
        const showToast = useUIStore.getState().showToast
        const addTransaction = useTransactionStore.getState().addTransaction
        const updateTransactionStatus = useTransactionStore.getState().updateTransactionStatus

        // Create pending transaction
        const transaction = addTransaction({
          type: 'deposit',
          status: 'pending',
          accountId,
          amount,
          currency,
          paymentIntentId,
          metadata,
        })

        try {
          // Simulate async processing (Stripe payment confirmation)
          await new Promise(resolve => setTimeout(resolve, 1500))

          // Execute the deposit
          const result = get()._executeDeposit(accountId, amount, currency)

          if (result.success) {
            // Update transaction to completed
            updateTransactionStatus(transaction.id, 'completed')
            showToast(`${formatBalance(amount, currency)} deposited to ${accountId}.`, 'success')
            return { success: true, message: result.message, transactionId: transaction.id }
          } else {
            // Update transaction to failed
            updateTransactionStatus(transaction.id, 'failed', result.message)
            showToast(result.message, 'error')
            return { success: false, message: result.message, transactionId: transaction.id }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Deposit failed'
          updateTransactionStatus(transaction.id, 'failed', errorMessage)
          showToast(errorMessage, 'error')
          return { success: false, message: errorMessage, transactionId: transaction.id }
        }
      },

      processWithdrawal: async (accountId, amount, currency, bankDetails) => {
        const showToast = useUIStore.getState().showToast
        const addTransaction = useTransactionStore.getState().addTransaction
        const updateTransactionStatus = useTransactionStore.getState().updateTransactionStatus

        // CRITICAL: Execute the withdrawal IMMEDIATELY to prevent double-spending
        // This debits the user's balance and places a "hold" on the funds
        const result = get()._executeWithdraw(accountId, amount, currency)

        if (!result.success) {
          // If withdrawal fails (e.g., insufficient funds), don't create transaction
          showToast(result.message, 'error')
          return { success: false, message: result.message }
        }

        // Balance is now debited. Create pending transaction to track the withdrawal
        const transaction = addTransaction({
          type: 'withdraw',
          status: 'pending',
          accountId,
          amount,
          currency,
          metadata: bankDetails,
        })

        showToast(`Withdrawal request for ${formatBalance(amount, currency)} is being processed.`, 'success')

        try {
          // Auto-approval after 45 seconds (simulates admin review)
          setTimeout(() => {
            // Update transaction status to completed
            // Do NOT call _executeWithdraw again - balance was already debited
            updateTransactionStatus(transaction.id, 'completed')
            showToast(`Withdrawal of ${formatBalance(amount, currency)} completed.`, 'success')
          }, 45000) // 45 seconds

          return { success: true, message: 'Withdrawal is being processed', transactionId: transaction.id }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Withdrawal processing error'
          // Note: Balance has already been debited, so we still mark as completed
          // In a real system, you'd need to refund if processing fails
          updateTransactionStatus(transaction.id, 'failed', errorMessage)
          showToast(errorMessage, 'error')
          return { success: false, message: errorMessage, transactionId: transaction.id }
        }
      },

      processTransfer: async (fromAccountId, toAccountId, amount, currency) => {
        const showToast = useUIStore.getState().showToast
        const addTransaction = useTransactionStore.getState().addTransaction
        const updateTransactionStatus = useTransactionStore.getState().updateTransactionStatus

        // Create pending transaction
        const transaction = addTransaction({
          type: 'transfer',
          status: 'pending',
          accountId: fromAccountId,
          amount,
          currency,
          fromAccountId,
          toAccountId,
        })

        try {
          // Simulate async processing
          await new Promise(resolve => setTimeout(resolve, 1000))

          // Execute the transfer
          const result = get()._executeTransfer(fromAccountId, toAccountId, amount, currency)

          if (result.success) {
            // Update transaction to completed
            updateTransactionStatus(transaction.id, 'completed')
            showToast(`Transferred ${formatBalance(amount, currency)} from ${fromAccountId} to ${toAccountId}.`, 'success')
            return { success: true, message: result.message, transactionId: transaction.id }
          } else {
            // Update transaction to failed
            updateTransactionStatus(transaction.id, 'failed', result.message)
            showToast(result.message, 'error')
            return { success: false, message: result.message, transactionId: transaction.id }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Transfer failed'
          updateTransactionStatus(transaction.id, 'failed', errorMessage)
          showToast(errorMessage, 'error')
          return { success: false, message: errorMessage, transactionId: transaction.id }
        }
      },

      // Trading Operations
      executeBuy: (symbol, amount, price) => {
        const activeAccount = get().getActiveAccount()
        const { activeAccountId } = get()
        const showToast = useUIStore.getState().showToast

        if (!activeAccount) {
          return { success: false, message: 'No active account selected.' }
        }

        const totalCost = amount * price
        const baseCurrency = symbol.replace(/USDT?$/, '')
        const quoteCurrency = activeAccount.currency
        const currentQuoteBalance = activeAccount.balances[quoteCurrency] ?? 0

        if (totalCost > currentQuoteBalance) {
          showToast('Insufficient funds to place buy order.', 'error')
          return { success: false, message: `Insufficient ${quoteCurrency} balance.` }
        }

        set(state => ({
          accounts: state.accounts.map(acc => {
            if (acc.id === activeAccountId) {
              const currentBaseBalance = acc.balances[baseCurrency] ?? 0
              return {
                ...acc,
                balances: {
                  ...acc.balances,
                  [quoteCurrency]: currentQuoteBalance - totalCost,
                  [baseCurrency]: currentBaseBalance + amount
                }
              }
            }
            return acc
          })
        }))

        showToast(`Bought ${amount.toFixed(6)} ${baseCurrency} on ${activeAccount.id}.`, 'success')
        return { success: true, message: 'Buy order executed.' }
      },

      executeSell: (symbol, amount, price) => {
        const activeAccount = get().getActiveAccount()
        const { activeAccountId } = get()
        const showToast = useUIStore.getState().showToast

        if (!activeAccount) {
          return { success: false, message: 'No active account selected.' }
        }

        const totalValue = amount * price
        const baseCurrency = symbol.replace(/USDT?$/, '')
        const quoteCurrency = activeAccount.currency
        const currentBaseBalance = activeAccount.balances[baseCurrency] ?? 0

        if (amount > currentBaseBalance) {
          showToast(`Insufficient ${baseCurrency} to place sell order.`, 'error')
          return { success: false, message: `Insufficient ${baseCurrency} balance.` }
        }

        set(state => ({
          accounts: state.accounts.map(acc => {
            if (acc.id === activeAccountId) {
              const currentQuoteBalance = acc.balances[quoteCurrency] ?? 0
              return {
                ...acc,
                balances: {
                  ...acc.balances,
                  [quoteCurrency]: currentQuoteBalance + totalValue,
                  [baseCurrency]: currentBaseBalance - amount
                }
              }
            }
            return acc
          })
        }))

        showToast(`Sold ${amount.toFixed(6)} ${baseCurrency} on ${activeAccount.id}.`, 'success')
        return { success: true, message: 'Sell order executed.' }
      },
    }),
    {
      name: 'account-store',
      // Persist accounts and activeAccountId
      partialize: (state) => ({
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
      }),
      // Initialize with default accounts if empty
      onRehydrateStorage: () => (state) => {
        if (state && state.accounts.length === 0) {
          state.accounts = getDefaultAccounts()
          if (state.accounts.length > 0) {
            state.activeAccountId = state.accounts[0].id
          }
        }
      },
    }
  )
)

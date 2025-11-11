import { create } from 'zustand'
import type {
  Account,
  AccountStatus,
  PaymentMethodMetadata,
  BackendAccount,
  BackendBalance,
} from '../types'
import { useUIStore } from './uiStore'
import { useTransactionStore } from './transactionStore'
import { useAuthStore } from './authStore'
import { getApiUrl } from '../config/api'

// ============================================================
// API INTEGRATION - Server-authoritative account management
// ============================================================

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
  isLoading: boolean

  // Selectors (computed properties)
  getActiveAccount: () => Account | undefined
  getActiveUsdBalance: () => number
  getActiveAccountCurrency: () => string
  getActiveCryptoHoldings: () => Record<string, number>

  // FX Rates Helper
  getFXRates: () => Promise<Record<string, number>>

  // Account Management Actions (Server-authoritative)
  fetchAccounts: () => Promise<void>
  setActiveAccount: (id: string) => void
  openAccount: (
    type: 'live' | 'demo',
    productType: 'spot' | 'cfd' | 'futures',
    currency: string,
    initialBalance: number
  ) => Promise<{ success: boolean; message?: string; account?: Account }>
  editDemoBalance: (accountId: string, newBalance: number) => Promise<{ success: boolean; message?: string }>
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
  executeBuy: (symbol: string, amount: number, price: number) => Promise<{ success: boolean; message: string }>
  executeSell: (symbol: string, amount: number, price: number) => Promise<{ success: boolean; message: string }>
}

export const useAccountStore = create<AccountStore>()((set, get) => ({
  // Initial State
  accounts: [],
  activeAccountId: null,
  isLoading: false,

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

      // Fetch accounts from backend API
      fetchAccounts: async () => {
        set({ isLoading: true })
        try {
          // Get JWT token from auth store
          const token = await useAuthStore.getState().getAccessToken()
          if (!token) {
            console.error('No access token available')
            set({ accounts: [], isLoading: false })
            return
          }

          // Call backend API
          const response = await fetch(getApiUrl('/api/v1/accounts'), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch accounts: ${response.statusText}`)
          }

          const data = await response.json()

          if (data.success && data.accounts) {
            // Transform backend accounts to frontend Account type
            const accounts: Account[] = data.accounts.map((acc: BackendAccount) => ({
              id: acc.id, // Use UUID as the ID for API calls
              accountNumber: acc.account_number, // Display number for UI
              type: acc.type,
              productType: acc.product_type,
              currency: acc.currency,
              status: acc.status,
              balances: acc.balances.reduce((obj: Record<string, number>, bal: BackendBalance) => {
                obj[bal.currency] = bal.amount
                return obj
              }, {} as Record<string, number>),
              createdAt: new Date(acc.created_at).getTime(),
              platformType: 'integrated', // All server accounts are integrated
              platform: 'Brokerage Web',
              server: 'Primary Server',
            }))

            set({ accounts, isLoading: false })

            // Set first active account if none is set
            if (!get().activeAccountId && accounts.length > 0) {
              const firstActive = accounts.find(acc => acc.status === 'active')
              if (firstActive) {
                set({ activeAccountId: firstActive.id })
              }
            }
          } else {
            set({ accounts: [], isLoading: false })
          }
        } catch (error) {
          console.error('Error fetching accounts:', error)
          const showToast = useUIStore.getState().showToast
          showToast('Failed to load accounts from server', 'error')
          set({ accounts: [], isLoading: false })
        }
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

      openAccount: async (type, productType, currency, initialBalance) => {
        const { accounts } = get()
        const showToast = useUIStore.getState().showToast

        // Validation
        if (type === 'demo') {
          const demoCount = accounts.filter(acc => acc.type === 'demo').length
          if (demoCount >= 5) {
            showToast('Maximum number of demo accounts reached (5).', 'error')
            return { success: false, message: 'Maximum number of demo accounts reached (5).' }
          }
          if (initialBalance < 100 || initialBalance > 1000000) {
            showToast('Demo account balance must be between $100 and $1,000,000.', 'error')
            return { success: false, message: 'Invalid starting balance.' }
          }
        }

        try {
          // Get JWT token
          const token = await useAuthStore.getState().getAccessToken()
          if (!token) {
            showToast('You must be logged in to create an account', 'error')
            return { success: false, message: 'Not authenticated' }
          }

          // Call backend API to create account
          const response = await fetch(getApiUrl('/api/v1/accounts'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type,
              product_type: productType,
              currency,
              initial_balance: initialBalance,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to create account' }))
            throw new Error(errorData.message || 'Failed to create account')
          }

          const data = await response.json()

          if (data.success && data.account) {
            // Transform backend account to frontend Account type
            const backendAccount: BackendAccount = data.account
            const newAccount: Account = {
              id: backendAccount.id, // Use UUID as the ID for API calls
              accountNumber: backendAccount.account_number, // Display number for UI
              type: backendAccount.type,
              productType: backendAccount.product_type,
              currency: backendAccount.currency,
              status: backendAccount.status,
              balances: backendAccount.balances.reduce((obj: Record<string, number>, bal: BackendBalance) => {
                obj[bal.currency] = bal.amount
                return obj
              }, {} as Record<string, number>),
              createdAt: new Date(backendAccount.created_at).getTime(),
              platformType: 'integrated',
              platform: 'Brokerage Web',
              server: 'Primary Server',
            }

            // Add to local state
            set(state => ({ accounts: [...state.accounts, newAccount] }))

            showToast(
              `${type.charAt(0).toUpperCase() + type.slice(1)} ${productType.toUpperCase()} account ${newAccount.accountNumber} created successfully!`,
              'success'
            )

            return {
              success: true,
              message: 'Account created successfully!',
              account: newAccount,
            }
          } else {
            throw new Error('Invalid response from server')
          }
        } catch (error) {
          console.error('Error creating account:', error)
          const errorMessage = error instanceof Error ? error.message : 'Failed to create account'
          showToast(errorMessage, 'error')
          return {
            success: false,
            message: errorMessage,
          }
        }
      },

      editDemoBalance: async (accountId, newBalance) => {
        const showToast = useUIStore.getState().showToast

        if (isNaN(newBalance) || newBalance < 100 || newBalance > 1000000) {
          showToast('Invalid balance amount provided.', 'error')
          return { success: false, message: 'Invalid balance amount.' }
        }

        const account = get().accounts.find(acc => acc.id === accountId)
        if (!account || account.type !== 'demo') {
          showToast('Could not find Demo account to update.', 'error')
          return { success: false, message: 'Account not found or is not a Demo account.' }
        }

        const currentBalance = account.balances[account.currency] || 0
        const difference = newBalance - currentBalance

        if (difference === 0) {
          return { success: true, message: 'Balance unchanged.' }
        }

        try {
          // Get JWT token
          const token = await useAuthStore.getState().getAccessToken()
          if (!token) {
            showToast('You must be logged in to edit balance', 'error')
            return { success: false, message: 'Not authenticated' }
          }

          // Call backend API to create adjustment transaction
          const response = await fetch(getApiUrl('/api/v1/transactions'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              account_id: accountId,
              type: 'deposit', // Always use deposit for demo adjustments
              currency: account.currency,
              amount: Math.abs(difference),
              description: difference > 0
                ? `Demo Balance Adjustment (Added ${formatBalance(difference, account.currency)})`
                : `Demo Balance Adjustment (Removed ${formatBalance(Math.abs(difference), account.currency)})`,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to update balance' }))
            throw new Error(errorData.message || 'Failed to update balance')
          }

          const data = await response.json()

          if (data.success) {
            // Refetch accounts to get updated balances
            await get().fetchAccounts()

            showToast(`Demo account balance updated to ${formatBalance(newBalance, account.currency)}`, 'success')
            return { success: true, message: 'Balance updated successfully!' }
          } else {
            throw new Error('Invalid response from server')
          }
        } catch (error) {
          console.error('Edit balance error:', error)
          const errorMessage = error instanceof Error ? error.message : 'Failed to update balance'
          showToast(errorMessage, 'error')
          return { success: false, message: errorMessage }
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

        try {
          // Get JWT token
          const token = await useAuthStore.getState().getAccessToken()
          if (!token) {
            showToast('You must be logged in to make deposits', 'error')
            return { success: false, message: 'Not authenticated' }
          }

          // Call backend API to create transaction
          const response = await fetch(getApiUrl('/api/v1/transactions'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              account_id: accountId,
              type: 'deposit',
              currency: currency,
              amount: amount,
              description: paymentIntentId ? `Deposit via ${metadata?.cardBrand || metadata?.fpxBank || 'payment gateway'} - ${paymentIntentId}` : 'Manual deposit',
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to process deposit' }))
            throw new Error(errorData.message || 'Failed to process deposit')
          }

          const data = await response.json()

          if (data.success && data.transaction) {
            // Refetch accounts to get updated balances
            await get().fetchAccounts()

            showToast(`${formatBalance(amount, currency)} deposited successfully!`, 'success')
            return { success: true, message: 'Deposit successful', transactionId: data.transaction.id }
          } else {
            throw new Error('Invalid response from server')
          }
        } catch (error) {
          console.error('Deposit error:', error)
          const errorMessage = error instanceof Error ? error.message : 'Deposit failed'
          showToast(errorMessage, 'error')
          return { success: false, message: errorMessage }
        }
      },

      processWithdrawal: async (accountId, amount, currency, bankDetails) => {
        const showToast = useUIStore.getState().showToast

        try {
          // Get JWT token
          const token = await useAuthStore.getState().getAccessToken()
          if (!token) {
            showToast('You must be logged in to make withdrawals', 'error')
            return { success: false, message: 'Not authenticated' }
          }

          // Call backend API to create transaction
          const response = await fetch(getApiUrl('/api/v1/transactions'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              account_id: accountId,
              type: 'withdrawal',
              currency: currency,
              amount: amount,
              description: bankDetails ? `Withdrawal to ${bankDetails.fpxBank || 'bank account'}` : 'Manual withdrawal',
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to process withdrawal' }))
            throw new Error(errorData.message || 'Failed to process withdrawal')
          }

          const data = await response.json()

          if (data.success && data.transaction) {
            // Refetch accounts to get updated balances
            await get().fetchAccounts()

            showToast(`${formatBalance(amount, currency)} withdrawn successfully!`, 'success')
            return { success: true, message: 'Withdrawal successful', transactionId: data.transaction.id }
          } else {
            throw new Error('Invalid response from server')
          }
        } catch (error) {
          console.error('Withdrawal error:', error)
          const errorMessage = error instanceof Error ? error.message : 'Withdrawal failed'
          showToast(errorMessage, 'error')
          return { success: false, message: errorMessage }
        }
      },

      processTransfer: async (fromAccountId, toAccountId, amount, currency) => {
        const showToast = useUIStore.getState().showToast

        try {
          // Get JWT token
          const token = await useAuthStore.getState().getAccessToken()
          if (!token) {
            showToast('You must be logged in to make transfers', 'error')
            return { success: false, message: 'Not authenticated' }
          }

          // Call backend API to create transaction
          const response = await fetch(getApiUrl('/api/v1/transactions'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              account_id: fromAccountId,
              type: 'transfer',
              currency: currency,
              amount: amount,
              target_account_id: toAccountId,
              description: `Transfer from ${fromAccountId} to ${toAccountId}`,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to process transfer' }))
            throw new Error(errorData.message || 'Failed to process transfer')
          }

          const data = await response.json()

          if (data.success && data.transaction) {
            // Refetch accounts to get updated balances
            await get().fetchAccounts()

            showToast(`${formatBalance(amount, currency)} transferred successfully!`, 'success')
            return { success: true, message: 'Transfer successful', transactionId: data.transaction.id }
          } else {
            throw new Error('Invalid response from server')
          }
        } catch (error) {
          console.error('Transfer error:', error)
          const errorMessage = error instanceof Error ? error.message : 'Transfer failed'
          showToast(errorMessage, 'error')
          return { success: false, message: errorMessage }
        }
      },

      // Trading Operations
      executeBuy: async (symbol, amount, price) => {
        const activeAccount = get().getActiveAccount()
        const { activeAccountId } = get()
        const showToast = useUIStore.getState().showToast

        if (!activeAccount) {
          return { success: false, message: 'No active account selected.' }
        }

        try {
          // Get JWT token
          const token = await useAuthStore.getState().getAccessToken()
          if (!token) {
            showToast('You must be logged in to trade', 'error')
            return { success: false, message: 'Not authenticated' }
          }

          // Call backend API to create order
          const response = await fetch(getApiUrl('/api/v1/orders'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              account_id: activeAccountId,
              symbol: symbol,
              side: 'buy',
              type: 'market',
              amount_base: amount,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to execute buy order' }))
            throw new Error(errorData.message || 'Failed to execute buy order')
          }

          const data = await response.json()

          if (data.success && data.order) {
            // Refetch accounts to get updated balances
            await get().fetchAccounts()

            const baseCurrency = symbol.replace(/USDT?$/, '')
            showToast(`Bought ${amount.toFixed(6)} ${baseCurrency}`, 'success')
            return { success: true, message: 'Buy order executed.', orderId: data.order.id }
          } else {
            throw new Error('Invalid response from server')
          }
        } catch (error) {
          console.error('Buy order error:', error)
          const errorMessage = error instanceof Error ? error.message : 'Buy order failed'
          showToast(errorMessage, 'error')
          return { success: false, message: errorMessage }
        }
      },

      executeSell: async (symbol, amount, price) => {
        const activeAccount = get().getActiveAccount()
        const { activeAccountId } = get()
        const showToast = useUIStore.getState().showToast

        if (!activeAccount) {
          return { success: false, message: 'No active account selected.' }
        }

        try {
          // Get JWT token
          const token = await useAuthStore.getState().getAccessToken()
          if (!token) {
            showToast('You must be logged in to trade', 'error')
            return { success: false, message: 'Not authenticated' }
          }

          // Call backend API to create order
          const response = await fetch(getApiUrl('/api/v1/orders'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              account_id: activeAccountId,
              symbol: symbol,
              side: 'sell',
              type: 'market',
              amount_base: amount,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to execute sell order' }))
            throw new Error(errorData.message || 'Failed to execute sell order')
          }

          const data = await response.json()

          if (data.success && data.order) {
            // Refetch accounts to get updated balances
            await get().fetchAccounts()

            const baseCurrency = symbol.replace(/USDT?$/, '')
            showToast(`Sold ${amount.toFixed(6)} ${baseCurrency}`, 'success')
            return { success: true, message: 'Sell order executed.', orderId: data.order.id }
          } else {
            throw new Error('Invalid response from server')
          }
        } catch (error) {
          console.error('Sell order error:', error)
          const errorMessage = error instanceof Error ? error.message : 'Sell order failed'
          showToast(errorMessage, 'error')
          return { success: false, message: errorMessage }
        }
      },
}))

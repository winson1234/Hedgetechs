import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Account, AccountStatus } from '../types'
import { useUIStore } from './uiStore'

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

  // Wallet Operations
  deposit: (accountId: string, amount: number, currency: string) => { success: boolean; message: string }
  withdraw: (accountId: string, amount: number, currency: string) => { success: boolean; message: string }
  transfer: (fromAccountId: string, toAccountId: string, amount: number, currency: string) => { success: boolean; message: string }

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

      // Wallet Operations
      deposit: (accountId, amount, currency) => {
        const showToast = useUIStore.getState().showToast

        if (amount <= 0) {
          showToast('Deposit amount must be positive.', 'error')
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
          showToast(`${formatBalance(amount, currency)} deposited to ${accountId}.`, 'success')
          return { success: true, message: 'Deposit successful!' }
        } else {
          showToast(`Account ${accountId} not found.`, 'error')
          return { success: false, message: 'Account not found.' }
        }
      },

      withdraw: (accountId, amount, currency) => {
        const showToast = useUIStore.getState().showToast

        if (amount <= 0) {
          showToast('Withdrawal amount must be positive.', 'error')
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
                showToast(message, 'error')
                return acc
              }

              success = true
              message = `Withdrew ${formatBalance(amount, currency)} from ${accountId}.`
              showToast(message, 'success')

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

      transfer: (fromAccountId, toAccountId, amount, currency) => {
        const { accounts } = get()
        const showToast = useUIStore.getState().showToast

        if (amount <= 0) {
          showToast('Transfer amount must be positive.', 'error')
          return { success: false, message: 'Invalid amount.' }
        }

        if (fromAccountId === toAccountId) {
          showToast('Cannot transfer to the same account.', 'error')
          return { success: false, message: 'Cannot transfer to the same account.' }
        }

        const fromAcc = accounts.find(a => a.id === fromAccountId)
        const toAcc = accounts.find(a => a.id === toAccountId)

        if (!fromAcc || !toAcc) {
          const message = 'One or both accounts not found.'
          showToast(message, 'error')
          return { success: false, message }
        }

        if (fromAcc.currency !== toAcc.currency) {
          const message = 'Cross-currency transfers are not supported.'
          showToast(message, 'error')
          return { success: false, message }
        }

        const fromBalance = fromAcc.balances[currency] ?? 0
        if (fromBalance < amount) {
          const message = `Insufficient funds in account ${fromAccountId}.`
          showToast(message, 'error')
          return { success: false, message }
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

        const message = `Transferred ${formatBalance(amount, currency)} from ${fromAccountId} to ${toAccountId}.`
        showToast(message, 'success')
        return { success: true, message }
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

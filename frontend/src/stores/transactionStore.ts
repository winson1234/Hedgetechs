import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Transaction, TransactionStatus, TransactionType } from '../types'
import { useAuthStore } from './authStore'
import { getApiUrl } from '../config/api'

// Helper function to generate unique transaction ID
const generateTransactionId = (): string => {
  return `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
}

interface TransactionStore {
  // State
  transactions: Transaction[]
  isLoading: boolean

  // Actions
  fetchTransactions: (accountId: string) => Promise<void>
  fetchAllTransactionsForLiveAccounts: (accountIds: string[]) => Promise<void>
  addTransaction: (transaction: Omit<Transaction, 'id' | 'timestamp'>) => Transaction
  updateTransactionStatus: (id: string, status: TransactionStatus, errorMessage?: string) => void
  getTransactionsByAccount: (accountId: string) => Transaction[]
  getTransactionsByType: (type: TransactionType) => Transaction[]
  getAllTransactions: () => Transaction[]
  getTransactionById: (id: string) => Transaction | undefined
}

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set, get) => ({
      // Initial State
      transactions: [],
      isLoading: false,

      // Fetch transactions from database
      fetchTransactions: async (accountId) => {
        set({ isLoading: true })

        try {
          // Get JWT token
          const token = await useAuthStore.getState().getAccessToken()
          if (!token) {
            console.error('Not authenticated')
            set({ isLoading: false })
            return
          }

          // Call backend API to get transactions
          const response = await fetch(getApiUrl(`/api/v1/transactions?account_id=${accountId}`), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            throw new Error('Failed to fetch transactions')
          }

          const data = await response.json()

          if (data.success && data.transactions) {
            // Transform backend transactions to frontend format
            const transactions: Transaction[] = data.transactions.map((tx: any) => ({
              id: tx.transaction_number || tx.id,
              accountId: tx.account_id,
              type: tx.type,
              currency: tx.currency,
              amount: tx.amount,
              status: tx.status,
              timestamp: new Date(tx.created_at).getTime(),
              targetAccountId: tx.target_account_id,
              description: tx.description,
              metadata: {},
            }))

            set({ transactions, isLoading: false })
          } else {
            set({ isLoading: false })
          }
        } catch (error) {
          console.error('Failed to fetch transactions:', error)
          set({ isLoading: false })
        }
      },

      // Fetch all transactions for multiple live accounts
      fetchAllTransactionsForLiveAccounts: async (accountIds) => {
        if (accountIds.length === 0) {
          set({ transactions: [], isLoading: false })
          return
        }

        set({ isLoading: true })

        try {
          // Get JWT token
          const token = await useAuthStore.getState().getAccessToken()
          if (!token) {
            console.error('Not authenticated')
            set({ isLoading: false })
            return
          }

          // Fetch transactions for all live accounts in parallel
          const fetchPromises = accountIds.map(accountId =>
            fetch(getApiUrl(`/api/v1/transactions?account_id=${accountId}`), {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }).then(res => res.json())
          )

          const results = await Promise.all(fetchPromises)

          // Combine all transactions from all accounts
          const allTransactions: Transaction[] = []

          results.forEach(data => {
            if (data.success && data.transactions) {
              const transactions: Transaction[] = data.transactions.map((tx: any) => ({
                id: tx.transaction_number || tx.id,
                accountId: tx.account_id,
                type: tx.type,
                currency: tx.currency,
                amount: tx.amount,
                status: tx.status,
                timestamp: new Date(tx.created_at).getTime(),
                targetAccountId: tx.target_account_id,
                description: tx.description,
                metadata: {},
              }))
              allTransactions.push(...transactions)
            }
          })

          // Sort by timestamp (newest first)
          allTransactions.sort((a, b) => b.timestamp - a.timestamp)

          set({ transactions: allTransactions, isLoading: false })
        } catch (error) {
          console.error('Failed to fetch transactions:', error)
          set({ isLoading: false })
        }
      },

      // Add new transaction
      addTransaction: (transactionData) => {
        const newTransaction: Transaction = {
          ...transactionData,
          id: generateTransactionId(),
          timestamp: Date.now(),
        }

        set((state) => ({
          transactions: [newTransaction, ...state.transactions], // Add to beginning for latest-first
        }))

        return newTransaction
      },

      // Update transaction status
      updateTransactionStatus: (id, status, errorMessage) => {
        set((state) => ({
          transactions: state.transactions.map((txn) =>
            txn.id === id
              ? { ...txn, status, ...(errorMessage && { errorMessage }) }
              : txn
          ),
        }))
      },

      // Get transactions by account ID
      getTransactionsByAccount: (accountId) => {
        const { transactions } = get()
        return transactions.filter(
          (txn) =>
            txn.accountId === accountId ||
            txn.fromAccountId === accountId ||
            txn.toAccountId === accountId
        )
      },

      // Get transactions by type
      getTransactionsByType: (type) => {
        const { transactions } = get()
        return transactions.filter((txn) => txn.type === type)
      },

      // Get all transactions sorted by timestamp (newest first)
      getAllTransactions: () => {
        const { transactions } = get()
        return [...transactions].sort((a, b) => b.timestamp - a.timestamp)
      },

      // Get transaction by ID
      getTransactionById: (id) => {
        const { transactions } = get()
        return transactions.find((txn) => txn.id === id)
      },
    }),
    {
      name: 'transaction-storage', // localStorage key
    }
  )
)

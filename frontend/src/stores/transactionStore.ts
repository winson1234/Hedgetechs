import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Transaction, TransactionStatus, TransactionType } from '../types'

// Helper function to generate unique transaction ID
const generateTransactionId = (): string => {
  return `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
}

interface TransactionStore {
  // State
  transactions: Transaction[]

  // Actions
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

// Shared type definitions used across the application

export type AccountStatus = 'active' | 'deactivated' | 'suspended'

export type Account = {
  id: string
  type: 'live' | 'demo'
  currency: string
  balances: Record<string, number>
  createdAt: number
  status: AccountStatus
  platformType: 'integrated' | 'external'
  platform?: string
  server?: string
}

export type Page = 'trading' | 'account' | 'wallet' | 'history'

export type WalletTab = 'overview' | 'deposit' | 'withdraw' | 'transfer'

export type ToastState = {
  id: number
  message: string
  type: 'success' | 'error'
} | null

// Transaction types for wallet operations
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type TransactionType = 'deposit' | 'withdraw' | 'transfer'

export type PaymentMethodMetadata = {
  // For card payments
  cardBrand?: string // e.g., 'visa', 'mastercard'
  last4?: string // Last 4 digits of card
  expiryMonth?: number
  expiryYear?: number
  // For bank transfers
  bankName?: string
  accountLast4?: string
  routingNumber?: string
}

export type Transaction = {
  id: string
  type: TransactionType
  status: TransactionStatus
  accountId: string
  amount: number
  currency: string
  timestamp: number
  // Payment processor info
  paymentIntentId?: string // Stripe Payment Intent ID
  metadata?: PaymentMethodMetadata
  // For transfers
  fromAccountId?: string
  toAccountId?: string
  // Error information
  errorMessage?: string
}

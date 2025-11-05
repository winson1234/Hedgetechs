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

export type Page = 'dashboard' | 'trading' | 'account' | 'wallet' | 'history'

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
  // For FPX payments (Malaysia online banking)
  fpxBank?: string // e.g., 'maybank2u', 'cimbclicks', etc.
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

// Chart drawing types
export type DrawingType = 'horizontal-line' | 'vertical-line' | 'trendline' | 'rectangle' | 'text'
export type LineStyle = 'solid' | 'dashed' | 'dotted'

export type DrawingPoint = {
  time: number
  price: number
}

// Tagged union for different drawing types
export type Drawing =
  | {
      id: string
      type: 'horizontal-line'
      price: number
      color: string
      lineWidth: number
      lineStyle: LineStyle
      lineRef?: unknown // IPriceLine from lightweight-charts, stored at runtime only
    }
  | {
      id: string
      type: 'vertical-line'
      time: number
      color: string
      lineWidth: number
      lineStyle: LineStyle
    }
  | {
      id: string
      type: 'trendline'
      point1: DrawingPoint
      point2: DrawingPoint
      color: string
      lineWidth: number
      lineStyle: LineStyle
    }
  | {
      id: string
      type: 'rectangle'
      point1: DrawingPoint
      point2: DrawingPoint
      color: string
      lineWidth: number
      lineStyle: LineStyle
    }
  | {
      id: string
      type: 'text'
      point: DrawingPoint
      text: string
      color: string
      fontSize?: number
    }

export type DrawingState = {
  type: DrawingType
  point1: DrawingPoint
} | null

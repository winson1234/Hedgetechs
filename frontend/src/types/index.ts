// Shared type definitions used across the application

export type AccountStatus = 'active' | 'deactivated' | 'suspended'

export type ProductType = 'spot' | 'cfd' | 'futures'

export type Account = {
  id: string
  accountNumber?: string
  type: 'live' | 'demo'
  productType?: ProductType
  currency: string
  balances: Record<string, number>
  createdAt: number
  status: AccountStatus
  platformType: 'integrated' | 'external'
  platform?: string
  server?: string
}

// Backend API response types
export type BackendAccount = {
  id: string
  user_id: string
  account_id: number
  type: 'live' | 'demo'
  product_type: ProductType
  currency: string
  status: AccountStatus
  created_at: string
  updated_at: string
  balances: BackendBalance[]
}

export type BackendBalance = {
  id: string
  account_id: string  // UUID reference to accounts.id, not the numeric account_id
  currency: string
  amount: number
  created_at: string
  updated_at: string
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
export type TransactionType = 'deposit' | 'withdraw' | 'transfer' | 'position_close'

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
  transactionNumber: string  // Human-readable: TXN-00001
  type: TransactionType
  status: TransactionStatus
  accountId: string  // UUID reference to accounts.id
  amount: number
  currency: string
  timestamp: number
  // Payment processor info
  paymentIntentId?: string // Stripe Payment Intent ID
  metadata?: PaymentMethodMetadata
  // For transfers
  fromAccountId?: string  // UUID reference to accounts.id
  toAccountId?: string  // UUID reference to accounts.id
  targetAccountId?: string  // UUID reference to accounts.id - Backend uses this field for transfers
  // Description from backend
  description?: string
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

// Position/Contract types for CFD trading
export type ContractSide = 'long' | 'short'
export type ContractStatus = 'open' | 'closed' | 'liquidated'

export type Position = {
  id: string
  user_id: string
  account_id: string  // UUID reference to accounts.id
  symbol: string
  contract_number: string
  side: ContractSide
  status: ContractStatus
  lot_size: number
  entry_price: number
  margin_used: number
  leverage: number
  product_type?: ProductType
  tp_price?: number | null
  sl_price?: number | null
  close_price?: number | null
  pnl?: number | null
  liquidation_price?: number | null
  swap: number
  commission: number
  pair_id?: string | null // Links to hedged pair
  created_at: string
  closed_at?: string | null
  updated_at: string
  // Transient fields calculated on frontend
  unrealized_pnl?: number
  current_price?: number
  roe?: number // Return on Equity (%)
}

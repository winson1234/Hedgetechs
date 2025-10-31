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

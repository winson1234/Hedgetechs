import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useUIStore } from './uiStore'
import { useAccountStore } from './accountStore'

// Order Types
export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop-limit'

export type PendingOrder = {
  id: string
  accountId: string // The account this order belongs to
  type: 'limit' | 'stop-limit'
  side: OrderSide
  symbol: string
  price: number // The limit price for execution
  amount: number
  stopPrice?: number // The trigger price for stop-limit orders
  timestamp: number
}

export type ExecutedOrder = {
  id: string
  accountId: string
  symbol: string
  side: OrderSide
  type: OrderType
  amount: number
  executionPrice: number
  fee: number
  total: number
  timestamp: number
  wasFromPending: boolean
  pendingOrderId?: string
}

interface OrderStore {
  // State
  pendingOrders: PendingOrder[]
  orderHistory: ExecutedOrder[]

  // Selectors
  getPendingOrdersBySymbol: (symbol: string) => PendingOrder[]
  getPendingOrdersByAccount: (accountId: string) => PendingOrder[]
  getOrderHistoryBySymbol: (symbol: string) => ExecutedOrder[]
  getOrderHistoryByAccount: (accountId: string) => ExecutedOrder[]

  // Pending Order Management
  addPendingOrder: (order: Omit<PendingOrder, 'id' | 'timestamp'>) => { success: boolean; message: string }
  cancelPendingOrder: (orderId: string) => { success: boolean; message: string }

  // Order Execution
  executePendingOrder: (orderId: string, executionPrice: number, fee?: number) => { success: boolean; message: string }
  recordExecutedOrder: (order: Omit<ExecutedOrder, 'id' | 'timestamp'>) => { success: boolean; message: string }

  // Auto-execution Logic
  processPendingOrders: (symbol: string, currentPrice: number) => void
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      // Initial State
      pendingOrders: [],
      orderHistory: [],

      // Selectors
      getPendingOrdersBySymbol: (symbol: string) => {
        return get().pendingOrders.filter(order => order.symbol === symbol)
      },

      getPendingOrdersByAccount: (accountId: string) => {
        return get().pendingOrders.filter(order => order.accountId === accountId)
      },

      getOrderHistoryBySymbol: (symbol: string) => {
        return get().orderHistory.filter(order => order.symbol === symbol)
      },

      getOrderHistoryByAccount: (accountId: string) => {
        return get().orderHistory.filter(order => order.accountId === accountId)
      },

      // Add Pending Order
      addPendingOrder: (orderData) => {
        const showToast = useUIStore.getState().showToast

        // Validate account exists
        const accountStore = useAccountStore.getState()
        const account = accountStore.accounts.find(acc => acc.id === orderData.accountId)

        if (!account) {
          showToast('Account not found', 'error')
          return { success: false, message: 'Account not found' }
        }

        // Generate unique ID
        const newOrder: PendingOrder = {
          ...orderData,
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          timestamp: Date.now(),
        }

        set(state => ({
          pendingOrders: [...state.pendingOrders, newOrder]
        }))

        const orderTypeDisplay = orderData.type.toUpperCase()
        const sideDisplay = orderData.side.toUpperCase()
        const baseCurrency = orderData.symbol.replace(/USDT?$/, '')
        const quoteCurrency = orderData.symbol.match(/USDT?$/)?.[0] || 'USDT'

        let message = `${orderTypeDisplay} ${sideDisplay} order placed!\n`
        message += `${orderData.amount.toFixed(6)} ${baseCurrency} @ `

        if (orderData.type === 'stop-limit' && orderData.stopPrice) {
          message += `Stop: ${orderData.stopPrice.toFixed(2)}, `
        }
        message += `${orderData.price.toFixed(2)} ${quoteCurrency}`

        showToast(message, 'success')
        return { success: true, message }
      },

      // Cancel Pending Order
      cancelPendingOrder: (orderId) => {
        const showToast = useUIStore.getState().showToast
        const order = get().pendingOrders.find(o => o.id === orderId)

        if (!order) {
          showToast('Order not found', 'error')
          return { success: false, message: 'Order not found' }
        }

        set(state => ({
          pendingOrders: state.pendingOrders.filter(o => o.id !== orderId)
        }))

        showToast(`Pending order ${orderId} cancelled`, 'success')
        return { success: true, message: 'Order cancelled successfully' }
      },

      // Execute Pending Order
      executePendingOrder: (orderId, executionPrice, fee = 0) => {
        const showToast = useUIStore.getState().showToast
        const { pendingOrders } = get()
        const order = pendingOrders.find(o => o.id === orderId)

        if (!order) {
          showToast('Pending order not found', 'error')
          return { success: false, message: 'Pending order not found' }
        }

        // Execute the trade using accountStore
        const accountStore = useAccountStore.getState()
        const result = order.side === 'buy'
          ? accountStore.executeBuy(order.symbol, order.amount, executionPrice)
          : accountStore.executeSell(order.symbol, order.amount, executionPrice)

        if (!result.success) {
          // Execution failed - keep the order pending
          return result
        }

        // Remove from pending orders
        set(state => ({
          pendingOrders: state.pendingOrders.filter(o => o.id !== orderId)
        }))

        // Record in order history
        const total = order.amount * executionPrice
        const executedOrder: ExecutedOrder = {
          id: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          accountId: order.accountId,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          amount: order.amount,
          executionPrice,
          fee,
          total,
          timestamp: Date.now(),
          wasFromPending: true,
          pendingOrderId: orderId,
        }

        set(state => ({
          orderHistory: [...state.orderHistory, executedOrder]
        }))

        const baseCurrency = order.symbol.replace(/USDT?$/, '')
        const quoteCurrency = order.symbol.match(/USDT?$/)?.[0] || 'USDT'
        const message = `Pending ${order.type.toUpperCase()} ${order.side.toUpperCase()} order filled!\n` +
                       `${order.amount.toFixed(6)} ${baseCurrency} @ ${executionPrice.toFixed(2)} ${quoteCurrency}`

        showToast(message, 'success')
        return { success: true, message }
      },

      // Record Executed Order (for market orders)
      recordExecutedOrder: (orderData) => {
        const newOrder: ExecutedOrder = {
          ...orderData,
          id: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          timestamp: Date.now(),
        }

        set(state => ({
          orderHistory: [...state.orderHistory, newOrder]
        }))

        return { success: true, message: 'Order recorded' }
      },

      // Process Pending Orders (Auto-execution based on price)
      processPendingOrders: (symbol, currentPrice) => {
        const { pendingOrders } = get()

        // Validate price
        if (isNaN(currentPrice) || currentPrice <= 0) {
          return
        }

        // Filter orders for the current symbol
        const relevantOrders = pendingOrders.filter(order => order.symbol === symbol)

        if (relevantOrders.length === 0) {
          return
        }

        // Check each order to see if it should execute
        relevantOrders.forEach(order => {
          let shouldExecute = false

          switch (order.type) {
            case 'limit':
              // Buy limit: execute when price drops to or below limit price
              // Sell limit: execute when price rises to or above limit price
              if (order.side === 'buy' && currentPrice <= order.price) {
                shouldExecute = true
              } else if (order.side === 'sell' && currentPrice >= order.price) {
                shouldExecute = true
              }
              break

            case 'stop-limit':
              // Stop-limit orders have two prices: stop price and limit price
              // Buy stop-limit: triggers when price rises to stop price, executes at limit price
              // Sell stop-limit: triggers when price falls to stop price, executes at limit price
              if (order.stopPrice) {
                if (order.side === 'buy' && currentPrice >= order.stopPrice) {
                  // Stop triggered for buy, execute at limit price
                  shouldExecute = true
                } else if (order.side === 'sell' && currentPrice <= order.stopPrice) {
                  // Stop triggered for sell, execute at limit price
                  shouldExecute = true
                }
              }
              break
          }

          if (shouldExecute) {
            // Execute the order at its limit price
            console.log(
              `Auto-executing pending order ID: ${order.id}, ` +
              `Type: ${order.type}, Side: ${order.side}, ` +
              `Limit Price: ${order.price}, Current Market Price: ${currentPrice}`
            )

            get().executePendingOrder(order.id, order.price)
          }
        })
      },
    }),
    {
      name: 'order-store',
      // Persist both pending orders and order history
      partialize: (state) => ({
        pendingOrders: state.pendingOrders,
        orderHistory: state.orderHistory,
      }),
    }
  )
)

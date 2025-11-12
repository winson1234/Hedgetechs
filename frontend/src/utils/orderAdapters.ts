/**
 * Adapter functions to transform Redux Order/PendingOrder types to legacy format
 * This bridges the gap between new backend schema and old component expectations
 */

import type { Order as ReduxOrder, PendingOrder as ReduxPendingOrder } from '../store/slices/orderSlice';

/**
 * Legacy Order format expected by UI components
 */
export interface LegacyExecutedOrder {
  id: string;
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  amount: number;
  executionPrice: number;
  total: number;
  fee: number;
  timestamp: number;
  wasFromPending: boolean;
  status: string;
}

/**
 * Legacy PendingOrder format expected by UI components
 */
export interface LegacyPendingOrder {
  id: string;
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'stop-limit';
  amount: number;
  price: number;
  stopPrice?: number;
  timestamp: number;
  status: string;
}

/**
 * Adapter: Redux Order -> Legacy ExecutedOrder
 */
export function adaptExecutedOrder(order: ReduxOrder): LegacyExecutedOrder {
  const executionPrice = order.average_fill_price || 0;
  const amount = order.amount_base || 0;
  const total = amount * executionPrice;

  // Calculate fee (0.1% for now, should come from backend in future)
  const fee = total * 0.001;

  return {
    id: order.id,
    accountId: order.account_id,
    symbol: order.symbol,
    side: order.side,
    type: order.type,
    amount: amount,
    executionPrice: executionPrice,
    total: total,
    fee: fee,
    timestamp: new Date(order.created_at).getTime(),
    wasFromPending: false, // Could be enhanced based on order metadata
    status: order.status,
  };
}

/**
 * Adapter: Redux PendingOrder -> Legacy PendingOrder
 */
export function adaptPendingOrder(order: ReduxPendingOrder): LegacyPendingOrder {
  return {
    id: order.id,
    accountId: order.account_id,
    symbol: order.symbol,
    side: order.side,
    type: order.type === 'stop_limit' ? 'stop-limit' : 'limit',
    amount: order.quantity,
    price: order.limit_price || order.trigger_price,
    stopPrice: order.type === 'stop_limit' ? order.trigger_price : undefined,
    timestamp: new Date(order.created_at).getTime(),
    status: order.status,
  };
}

/**
 * Helper to determine if an order has a stop price
 */
export function hasStopPrice(order: LegacyPendingOrder): boolean {
  return order.type === 'stop-limit' && order.stopPrice !== undefined;
}

/**
 * Helper to format order amount with symbol
 */
export function formatOrderAmount(amount: number, symbol: string): string {
  const baseCurrency = symbol.replace('USDT', '').replace('USDC', '');
  return `${amount.toFixed(8)} ${baseCurrency}`;
}

/**
 * Helper to calculate total value for pending order
 */
export function calculatePendingOrderTotal(order: LegacyPendingOrder): number {
  return order.amount * order.price;
}

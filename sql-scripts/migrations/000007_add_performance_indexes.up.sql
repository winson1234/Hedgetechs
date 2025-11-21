-- Migration 000007: Add Performance Indexes for Order Processing
-- These indexes optimize the slow queries identified in order execution and exposure calculation

-- Index for contracts table - optimize exposure calculations by symbol and status
-- Used in routing_service.go:getNetExposure() and getTotalNetExposure()
-- Partial index only on 'open' contracts since that's what queries filter on
CREATE INDEX IF NOT EXISTS idx_contracts_symbol_status
ON contracts(symbol, status)
WHERE status = 'open';

-- Index for contracts table - optimize position aggregation by status and side
-- Used for grouping open positions by long/short
CREATE INDEX IF NOT EXISTS idx_contracts_status_side
ON contracts(status, side)
WHERE status = 'open';

-- Index for pending_orders table - optimize pending order lookups by status and symbol
-- Used in order_processor.go when fetching pending orders to execute
CREATE INDEX IF NOT EXISTS idx_pending_orders_status_symbol
ON pending_orders(status, symbol)
WHERE status = 'pending';

-- Index for orders table - optimize order history queries by account and created_at
-- Used when fetching user's order history
CREATE INDEX IF NOT EXISTS idx_orders_account_created
ON orders(account_id, created_at DESC);

-- Index for transactions table - optimize transaction history queries
CREATE INDEX IF NOT EXISTS idx_transactions_account_created
ON transactions(account_id, created_at DESC);

-- Analyze tables to update query planner statistics
ANALYZE contracts;
ANALYZE pending_orders;
ANALYZE orders;
ANALYZE transactions;

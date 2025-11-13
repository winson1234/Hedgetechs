-- Migration 000005 Rollback: Hybrid Brokerage V2

-- ============================================================
-- STEP 1: Drop configuration table
-- ============================================================
DROP TABLE IF EXISTS lp_routing_config;

-- ============================================================
-- STEP 2: Remove new instruments
-- ============================================================
DELETE FROM instruments WHERE symbol IN (
    'CADJPYUSDT', 'AUDNZDUSDT', 'EURGBPUSDT',
    'WTIUSDT', 'BRENTUSDT', 'NATGASUSDT'
);

-- ============================================================
-- STEP 3: Drop indexes
-- ============================================================
DROP INDEX IF EXISTS idx_pending_orders_product_type;
DROP INDEX IF EXISTS idx_contracts_pair_id;
DROP INDEX IF EXISTS idx_orders_execution_strategy;
DROP INDEX IF EXISTS idx_orders_product_type;
DROP INDEX IF EXISTS idx_reconciliation_queue_next_attempt;
DROP INDEX IF EXISTS idx_reconciliation_queue_status;
DROP INDEX IF EXISTS idx_lp_routes_lp_provider;
DROP INDEX IF EXISTS idx_lp_routes_status;
DROP INDEX IF EXISTS idx_lp_routes_order_id;

-- ============================================================
-- STEP 4: Drop LP infrastructure tables
-- ============================================================
DROP TABLE IF EXISTS reconciliation_queue;
DROP TABLE IF EXISTS lp_routes;

-- ============================================================
-- STEP 5: Remove execution_strategy from orders
-- ============================================================
ALTER TABLE orders DROP COLUMN IF EXISTS execution_strategy;

-- Drop execution_strategy enum (only if not used elsewhere)
DROP TYPE IF EXISTS execution_strategy;

-- ============================================================
-- STEP 6: Remove dual-position hedging support
-- ============================================================
ALTER TABLE contracts DROP COLUMN IF EXISTS pair_id;

-- ============================================================
-- STEP 7: Remove product_type from order tables
-- ============================================================
ALTER TABLE pending_orders DROP COLUMN IF EXISTS product_type;
ALTER TABLE orders DROP COLUMN IF EXISTS product_type;

-- ============================================================
-- STEP 8: Re-enforce product_type constraint on accounts
-- ============================================================

-- First, ensure all NULL values have a default
UPDATE accounts SET product_type = 'spot' WHERE product_type IS NULL;

-- Then re-add NOT NULL constraint
ALTER TABLE accounts ALTER COLUMN product_type SET NOT NULL;

-- Remove deprecation comment
COMMENT ON COLUMN accounts.product_type IS NULL;

-- ============================================================
-- DONE
-- ============================================================

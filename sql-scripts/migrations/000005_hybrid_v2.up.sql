-- Migration 000005: Hybrid Brokerage V2 - Universal Accounts with Dual-Position Hedging
-- This migration implements:
-- 1. Universal accounts (product_type becomes optional at account level)
-- 2. Product selection at trade level (add product_type to orders/pending_orders)
-- 3. Dual-position hedging support (pair_id for linked contracts)
-- 4. A-Book/LP routing infrastructure (execution_strategy, lp_routes, reconciliation_queue)
-- 5. Expanded instruments (new forex and commodity pairs)

-- ============================================================
-- STEP 1: Deprecate product_type at account level
-- ============================================================
ALTER TABLE accounts ALTER COLUMN product_type DROP NOT NULL;

COMMENT ON COLUMN accounts.product_type IS
'DEPRECATED: Product type selection moved to order level for universal accounts.
Legacy accounts may have this set. New accounts should leave this NULL.';

-- ============================================================
-- STEP 2: Add product_type to order tables
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_type product_type NOT NULL DEFAULT 'spot';
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS product_type product_type NOT NULL DEFAULT 'spot';

-- ============================================================
-- STEP 3: Add dual-position hedging support
-- ============================================================
-- pair_id links two contracts (long + short) opened simultaneously
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS pair_id UUID;

COMMENT ON COLUMN contracts.pair_id IS
'Links two contracts that were opened as a hedged pair (dual-position).
Both the long and short positions will share the same pair_id.
NULL for non-hedged positions.';

-- ============================================================
-- STEP 4: Add LP routing infrastructure
-- ============================================================

-- Create execution_strategy enum
DO $$ BEGIN
    CREATE TYPE execution_strategy AS ENUM ('b_book', 'a_book');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add execution_strategy to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS execution_strategy execution_strategy NOT NULL DEFAULT 'b_book';

COMMENT ON COLUMN orders.execution_strategy IS
'Execution routing strategy:
- b_book: Executed internally (default)
- a_book: Routed to external liquidity provider';

-- Create LP routes tracking table
CREATE TABLE IF NOT EXISTS lp_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    lp_provider TEXT NOT NULL,
    lp_order_id TEXT NOT NULL,
    lp_fill_price DECIMAL(20, 8),
    lp_fill_quantity DECIMAL(20, 8),
    lp_fee DECIMAL(20, 8),
    status TEXT NOT NULL DEFAULT 'pending',
    routed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    filled_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lp_routes_order_id ON lp_routes(order_id);
CREATE INDEX IF NOT EXISTS idx_lp_routes_status ON lp_routes(status);
CREATE INDEX IF NOT EXISTS idx_lp_routes_lp_provider ON lp_routes(lp_provider);

COMMENT ON TABLE lp_routes IS
'Tracks orders routed to external liquidity providers (A-Book execution).
Records fill details, timing, and reconciliation status.';

-- Create reconciliation queue
CREATE TABLE IF NOT EXISTS reconciliation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lp_route_id UUID NOT NULL REFERENCES lp_routes(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    discrepancy_details JSONB,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_queue_status ON reconciliation_queue(status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_queue_next_attempt ON reconciliation_queue(next_attempt_at) WHERE status = 'pending';

COMMENT ON TABLE reconciliation_queue IS
'Queue for reconciling LP-executed orders. Background worker processes pending items
to verify fills, detect discrepancies, and ensure internal positions match LP execution.';

-- ============================================================
-- STEP 5: Add performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_product_type ON orders(product_type);
CREATE INDEX IF NOT EXISTS idx_orders_execution_strategy ON orders(execution_strategy);
CREATE INDEX IF NOT EXISTS idx_contracts_pair_id ON contracts(pair_id) WHERE pair_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_orders_product_type ON pending_orders(product_type);

-- ============================================================
-- STEP 6: Add new instruments (Forex + Commodities)
-- ============================================================

-- New Forex Pairs
INSERT INTO instruments (
    symbol, name, base_currency, quote_currency,
    instrument_type, min_order_size, max_order_size,
    tick_size, leverage_cap, is_tradeable, category
) VALUES
    ('CADJPYUSDT', 'CAD/JPY / Tether', 'CADJPY', 'USDT', 'forex', 0.01, 10000.00, 0.00001, 100, true, 'forex'),
    ('AUDNZDUSDT', 'AUD/NZD / Tether', 'AUDNZD', 'USDT', 'forex', 0.01, 10000.00, 0.00001, 100, true, 'forex'),
    ('EURGBPUSDT', 'EUR/GBP / Tether', 'EURGBP', 'USDT', 'forex', 0.01, 10000.00, 0.00001, 100, true, 'forex')
ON CONFLICT (symbol) DO NOTHING;

-- New Commodity Pairs
INSERT INTO instruments (
    symbol, name, base_currency, quote_currency,
    instrument_type, min_order_size, max_order_size,
    tick_size, leverage_cap, is_tradeable, category
) VALUES
    ('WTIUSDT', 'WTI Crude Oil / Tether', 'WTI', 'USDT', 'commodity', 0.01, 1000.00, 0.01, 50, true, 'commodity'),
    ('BRENTUSDT', 'Brent Crude Oil / Tether', 'BRENT', 'USDT', 'commodity', 0.01, 1000.00, 0.01, 50, true, 'commodity'),
    ('NATGASUSDT', 'Natural Gas / Tether', 'NATGAS', 'USDT', 'commodity', 0.1, 10000.00, 0.01, 50, true, 'commodity')
ON CONFLICT (symbol) DO NOTHING;

-- ============================================================
-- STEP 7: Update existing data (backwards compatibility)
-- ============================================================

-- For existing orders, infer product_type from their account
-- This ensures no NULL product_type values for historical orders
UPDATE orders o
SET product_type = a.product_type
FROM accounts a
WHERE o.account_id = a.id
  AND o.product_type = 'spot'  -- Only update defaults
  AND a.product_type IS NOT NULL;

-- Same for pending orders
UPDATE pending_orders po
SET product_type = a.product_type
FROM accounts a
WHERE po.account_id = a.id
  AND po.product_type = 'spot'  -- Only update defaults
  AND a.product_type IS NOT NULL;

-- ============================================================
-- STEP 8: Add configuration table for LP routing
-- ============================================================

CREATE TABLE IF NOT EXISTS lp_routing_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insert default routing configuration
INSERT INTO lp_routing_config (config_key, config_value, description) VALUES
    ('enabled', '{"value": false}'::jsonb, 'Master switch for LP routing. Set to true to enable A-Book execution.'),
    ('size_threshold', '{"value": 100000, "currency": "USD"}'::jsonb, 'Minimum notional value (in USD) to route to LP. Orders below this are B-Book.'),
    ('exposure_limits', '{"per_instrument": 500000, "total": 5000000}'::jsonb, 'Max net exposure (USD) before forcing LP routing. Per-instrument and total limits.'),
    ('lp_providers', '{"primary": "mock_lp", "fallback": null}'::jsonb, 'LP provider configuration. Primary and optional fallback provider names.')
ON CONFLICT (config_key) DO NOTHING;

COMMENT ON TABLE lp_routing_config IS
'Configuration for LP routing decision engine. Supports feature flags,
thresholds, and provider selection.';

-- ============================================================
-- DONE
-- ============================================================

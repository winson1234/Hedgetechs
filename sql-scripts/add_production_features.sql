-- ================================================================
-- PRODUCTION FEATURES MIGRATION
-- Description: Adds account metadata, audit logging, and pending orders
-- Date: 2025-11-11
-- ================================================================

-- ================================================================
-- 1. ENHANCE ACCOUNTS TABLE - Add UX Metadata
-- ================================================================

-- Add account personalization columns
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS nickname TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'wallet',
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.accounts.nickname IS 'User-defined account nickname (e.g., "My Trading Account")';
COMMENT ON COLUMN public.accounts.color IS 'Hex color code for account visual identification';
COMMENT ON COLUMN public.accounts.icon IS 'Icon identifier for account (e.g., "wallet", "chart", "piggy-bank")';
COMMENT ON COLUMN public.accounts.last_accessed_at IS 'Last time account was accessed by user';
COMMENT ON COLUMN public.accounts.access_count IS 'Total number of times account was accessed';

-- ================================================================
-- 2. AUDIT LOGS TABLE - Security & Compliance
-- ================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- e.g., "account_created", "account_viewed", "transaction_created"
    resource_type TEXT NOT NULL, -- e.g., "account", "transaction", "order"
    resource_id UUID, -- ID of the resource being acted upon
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB, -- Additional contextual data
    status TEXT DEFAULT 'success', -- "success" or "failure"
    error_message TEXT, -- If status is "failure"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own audit logs
CREATE POLICY "Users can read own audit logs" ON public.audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert audit logs (backend inserts via service key)
CREATE POLICY "Service role can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.audit_logs IS 'Audit trail for all user actions (security & compliance)';

-- ================================================================
-- 3. PENDING ORDERS TABLE - Event-Driven Order Execution
-- ================================================================

-- Order types enum
DO $$ BEGIN
    CREATE TYPE order_execution_type AS ENUM ('limit', 'stop_limit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Order side enum
DO $$ BEGIN
    CREATE TYPE order_side AS ENUM ('buy', 'sell');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Pending order status enum
DO $$ BEGIN
    CREATE TYPE pending_order_status AS ENUM ('pending', 'executed', 'cancelled', 'expired', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.pending_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL, -- e.g., "BTCUSDT", "ETHUSDT"
    type order_execution_type NOT NULL, -- "limit" or "stop_limit"
    side order_side NOT NULL, -- "buy" or "sell"
    quantity DECIMAL(20, 8) NOT NULL CHECK (quantity > 0),
    trigger_price DECIMAL(20, 8) NOT NULL CHECK (trigger_price > 0), -- Price at which order triggers
    limit_price DECIMAL(20, 8), -- For limit orders (can be NULL for market execution)
    status pending_order_status NOT NULL DEFAULT 'pending',
    executed_at TIMESTAMP WITH TIME ZONE, -- When order was executed
    executed_price DECIMAL(20, 8), -- Actual execution price
    failure_reason TEXT, -- If status is "failed"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_limit_price CHECK (
        (type = 'limit' AND limit_price IS NOT NULL) OR
        (type = 'stop_limit')
    )
);

-- Critical indexes for event-driven processing
CREATE INDEX IF NOT EXISTS idx_pending_orders_user_id ON public.pending_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_account_id ON public.pending_orders(account_id);
-- CRITICAL: Fast lookup by symbol and status for real-time processing
CREATE INDEX IF NOT EXISTS idx_pending_orders_symbol_status ON public.pending_orders(symbol, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_orders_created_at ON public.pending_orders(created_at DESC);

-- Enable RLS
ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;

-- Users can read their own pending orders
CREATE POLICY "Users can read own pending orders" ON public.pending_orders
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own pending orders
CREATE POLICY "Users can insert own pending orders" ON public.pending_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update/cancel their own pending orders
CREATE POLICY "Users can update own pending orders" ON public.pending_orders
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own pending orders
CREATE POLICY "Users can delete own pending orders" ON public.pending_orders
    FOR DELETE USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE public.pending_orders IS 'Pending limit/stop-limit orders awaiting execution by event-driven processor';
COMMENT ON COLUMN public.pending_orders.trigger_price IS 'Price threshold at which order should be triggered';
COMMENT ON COLUMN public.pending_orders.limit_price IS 'Maximum buy/minimum sell price for limit orders';
COMMENT ON INDEX idx_pending_orders_symbol_status IS 'CRITICAL INDEX: Enables fast O(1) lookup for event-driven order processing';

-- ================================================================
-- 4. TRIGGER FUNCTIONS - Auto-update timestamps
-- ================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to pending_orders table
DROP TRIGGER IF EXISTS update_pending_orders_updated_at ON public.pending_orders;
CREATE TRIGGER update_pending_orders_updated_at
    BEFORE UPDATE ON public.pending_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to accounts table (for metadata updates)
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 5. HELPER FUNCTIONS
-- ================================================================

-- Function to log audit events (can be called from backend or triggers)
CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id UUID DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_status TEXT DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        user_id, action, resource_type, resource_id,
        ip_address, user_agent, metadata, status, error_message
    ) VALUES (
        p_user_id, p_action, p_resource_type, p_resource_id,
        p_ip_address, p_user_agent, p_metadata, p_status, p_error_message
    ) RETURNING id INTO audit_id;

    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 6. DATA VALIDATION
-- ================================================================

-- Verify migration completed successfully
DO $$
DECLARE
    accounts_cols INTEGER;
    audit_table_exists BOOLEAN;
    pending_table_exists BOOLEAN;
BEGIN
    -- Check if new columns were added to accounts
    SELECT COUNT(*) INTO accounts_cols
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name IN ('nickname', 'color', 'icon', 'last_accessed_at', 'access_count');

    -- Check if audit_logs table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
    ) INTO audit_table_exists;

    -- Check if pending_orders table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'pending_orders'
    ) INTO pending_table_exists;

    -- Report results
    RAISE NOTICE '=== MIGRATION VALIDATION ===';
    RAISE NOTICE 'Accounts table new columns: % of 5', accounts_cols;
    RAISE NOTICE 'Audit logs table exists: %', audit_table_exists;
    RAISE NOTICE 'Pending orders table exists: %', pending_table_exists;

    IF accounts_cols = 5 AND audit_table_exists AND pending_table_exists THEN
        RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY';
    ELSE
        RAISE WARNING '⚠️  MIGRATION INCOMPLETE - Please review errors above';
    END IF;
END $$;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================

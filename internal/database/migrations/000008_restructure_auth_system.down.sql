-- Migration Rollback: 000008_restructure_auth_system
-- Description: Rollback authentication restructure to Supabase auth system
-- Date: 2025-01-18
-- WARNING: This rollback will restore Supabase auth integration but may lose custom auth data

-- ============================================================================
-- STEP 1: Drop New Tables
-- ============================================================================

DROP TRIGGER IF EXISTS update_order_history_updated_at ON order_history;
DROP TABLE IF EXISTS order_history CASCADE;
DROP FUNCTION IF EXISTS generate_order_history_id();
DROP SEQUENCE IF EXISTS order_history_id_seq;

DROP TRIGGER IF EXISTS update_pending_registrationss_updated_at ON pending_registrationss;
DROP TABLE IF EXISTS pending_registrationss CASCADE;

-- ============================================================================
-- STEP 2: Drop Account Balance Sync Trigger
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_sync_account_balance ON balances;
DROP FUNCTION IF EXISTS sync_account_balance();

-- ============================================================================
-- STEP 3: Revert Accounts Table Structure
-- ============================================================================

-- Drop new columns
ALTER TABLE accounts DROP COLUMN IF EXISTS account_id;
ALTER TABLE accounts DROP COLUMN IF EXISTS balance;
ALTER TABLE accounts DROP COLUMN IF EXISTS last_updated;
ALTER TABLE accounts DROP COLUMN IF EXISTS last_login;

-- Drop new indexes
DROP INDEX IF EXISTS idx_accounts_account_id;
DROP INDEX IF EXISTS idx_accounts_status;

-- Revert status enum from (online, offline) to (active, deactivated, suspended)
ALTER TYPE account_status RENAME TO account_status_new;
CREATE TYPE account_status AS ENUM ('active', 'deactivated', 'suspended');

-- Migrate status values back
UPDATE accounts SET status = 'active'::text WHERE status::text = 'online';
UPDATE accounts SET status = 'deactivated'::text WHERE status::text = 'offline';

ALTER TABLE accounts ALTER COLUMN status TYPE account_status USING
    CASE
        WHEN status::text = 'online' THEN 'active'::account_status
        ELSE 'deactivated'::account_status
    END;
DROP TYPE account_status_new;

-- Revert account_type enum from (live, demo, deactivate) to (live, demo)
ALTER TYPE account_type RENAME TO account_type_new;
CREATE TYPE account_type AS ENUM ('live', 'demo');

-- Migrate type values back
UPDATE accounts SET type = 'demo'::text WHERE type::text = 'deactivate';

ALTER TABLE accounts ALTER COLUMN type TYPE account_type USING
    CASE
        WHEN type::text = 'deactivate' THEN 'demo'::account_type
        ELSE type::text::account_type
    END;
DROP TYPE account_type_new;

-- Restore columns (if they were dropped in up migration, you'll need to recreate them)
-- ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_number TEXT;
-- ALTER TABLE accounts ADD COLUMN IF NOT EXISTS product_type product_type;
-- ALTER TABLE accounts ADD COLUMN IF NOT EXISTS nickname TEXT;
-- ALTER TABLE accounts ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6366f1';
-- ALTER TABLE accounts ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'wallet';
-- ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP;
-- ALTER TABLE accounts ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- ============================================================================
-- STEP 4: Revert Users Table Structure
-- ============================================================================

-- Drop new indexes
DROP INDEX IF EXISTS idx_users_user_id;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_is_active;

-- Drop new columns
ALTER TABLE users DROP COLUMN IF EXISTS user_id;
ALTER TABLE users DROP COLUMN IF EXISTS first_name;
ALTER TABLE users DROP COLUMN IF EXISTS last_name;
ALTER TABLE users DROP COLUMN IF EXISTS hash_password;
ALTER TABLE users DROP COLUMN IF EXISTS phone_number;
ALTER TABLE users DROP COLUMN IF EXISTS is_active;
ALTER TABLE users DROP COLUMN IF EXISTS last_login;

-- Rename last_updated_at back to updated_at
ALTER TABLE users RENAME COLUMN last_updated_at TO updated_at;

-- Restore full_name column
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;

-- ============================================================================
-- STEP 5: Restore Supabase Auth Integration
-- ============================================================================

-- Restore foreign key to auth.users
-- Note: This assumes auth.users table still exists in Supabase
-- ALTER TABLE users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Restore trigger functions for auth integration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, country, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'country', ''),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM auth.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_auth_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restore triggers
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW
--     EXECUTE FUNCTION handle_new_user();

-- CREATE TRIGGER on_public_user_deleted
--     AFTER DELETE ON users
--     FOR EACH ROW
--     EXECUTE FUNCTION handle_user_delete();

-- CREATE TRIGGER on_auth_user_deleted
--     AFTER DELETE ON auth.users
--     FOR EACH ROW
--     EXECUTE FUNCTION handle_auth_user_delete();

-- ============================================================================
-- STEP 6: Restore RLS Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;

-- Restore RLS policies for users
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Restore RLS policies for accounts
CREATE POLICY "Users can read own accounts" ON accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON accounts
    FOR UPDATE USING (auth.uid() = user_id);

-- Restore RLS policies for balances
CREATE POLICY "Users can read own balances" ON balances
    FOR SELECT USING (
        auth.uid() IN (SELECT user_id FROM accounts WHERE id = account_id)
    );

CREATE POLICY "Users can insert own balances" ON balances
    FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT user_id FROM accounts WHERE id = account_id)
    );

CREATE POLICY "Users can update own balances" ON balances
    FOR UPDATE USING (
        auth.uid() IN (SELECT user_id FROM accounts WHERE id = account_id)
    );

-- Restore RLS policies for orders
CREATE POLICY "Users can read own orders" ON orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders" ON orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders" ON orders
    FOR UPDATE USING (auth.uid() = user_id);

-- Restore RLS policies for pending_orders
CREATE POLICY "Users can read own pending orders" ON pending_orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pending orders" ON pending_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending orders" ON pending_orders
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pending orders" ON pending_orders
    FOR DELETE USING (auth.uid() = user_id);

-- Restore RLS policies for contracts
CREATE POLICY "Users can read own contracts" ON contracts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contracts" ON contracts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contracts" ON contracts
    FOR UPDATE USING (auth.uid() = user_id);

-- Restore RLS policies for transactions
CREATE POLICY "Users can read own transactions" ON transactions
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM accounts WHERE id = account_id OR id = target_account_id
        )
    );

CREATE POLICY "Users can insert own transactions" ON transactions
    FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT user_id FROM accounts WHERE id = account_id)
    );

CREATE POLICY "Users can update own transactions" ON transactions
    FOR UPDATE USING (
        auth.uid() IN (SELECT user_id FROM accounts WHERE id = account_id)
    );

-- Restore RLS policies for audit_logs
CREATE POLICY "Users can read own audit logs" ON audit_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Restore RLS policies for kyc_documents
CREATE POLICY "Users can read own KYC documents" ON kyc_documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own KYC documents" ON kyc_documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending KYC documents" ON kyc_documents
    FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Restore RLS policy for instruments
CREATE POLICY "Anyone can read instruments" ON instruments
    FOR SELECT USING (true);

-- ============================================================================
-- Rollback Complete
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Rollback 000008_restructure_auth_system completed';
    RAISE NOTICE 'WARNING: Custom authentication data may have been lost';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  - Dropped pending_registrationss table';
    RAISE NOTICE '  - Dropped order_history table';
    RAISE NOTICE '  - Reverted users table to Supabase auth structure';
    RAISE NOTICE '  - Reverted accounts table structure';
    RAISE NOTICE '  - Restored RLS policies';
    RAISE NOTICE '  - Restored Supabase auth triggers (commented out - uncomment if needed)';
END $$;

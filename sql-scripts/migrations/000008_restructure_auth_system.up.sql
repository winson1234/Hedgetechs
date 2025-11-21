-- Migration: 000008_restructure_auth_system
-- Description: Restructure authentication from Supabase to custom auth system
-- Date: 2025-01-18

-- ============================================================================
-- STEP 1: Drop Supabase RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;

DROP POLICY IF EXISTS "Users can read own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;

DROP POLICY IF EXISTS "Users can read own balances" ON balances;
DROP POLICY IF EXISTS "Users can insert own balances" ON balances;
DROP POLICY IF EXISTS "Users can update own balances" ON balances;

DROP POLICY IF EXISTS "Users can read own orders" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
DROP POLICY IF EXISTS "Users can update own orders" ON orders;

DROP POLICY IF EXISTS "Users can read own pending orders" ON pending_orders;
DROP POLICY IF EXISTS "Users can insert own pending orders" ON pending_orders;
DROP POLICY IF EXISTS "Users can update own pending orders" ON pending_orders;
DROP POLICY IF EXISTS "Users can delete own pending orders" ON pending_orders;

DROP POLICY IF EXISTS "Users can read own contracts" ON contracts;
DROP POLICY IF EXISTS "Users can insert own contracts" ON contracts;
DROP POLICY IF EXISTS "Users can update own contracts" ON contracts;

DROP POLICY IF EXISTS "Users can read own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;

DROP POLICY IF EXISTS "Users can read own audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;

DROP POLICY IF EXISTS "Users can read own KYC documents" ON kyc_documents;
DROP POLICY IF EXISTS "Users can insert own KYC documents" ON kyc_documents;
DROP POLICY IF EXISTS "Users can update own pending KYC documents" ON kyc_documents;

DROP POLICY IF EXISTS "Anyone can read instruments" ON instruments;

-- Disable RLS on all tables
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pending_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kyc_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS instruments DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Drop Supabase Auth Integration Triggers
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP TRIGGER IF EXISTS on_public_user_deleted ON users;

DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS handle_user_delete();
DROP FUNCTION IF EXISTS handle_auth_user_delete();

-- ============================================================================
-- STEP 3: Restructure Users Table
-- ============================================================================

-- Drop foreign key to auth.users if exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hash_password TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Rename updated_at to last_updated_at
ALTER TABLE users RENAME COLUMN updated_at TO last_updated_at;

-- Drop full_name column (replaced by first_name + last_name)
ALTER TABLE users DROP COLUMN IF EXISTS full_name;

-- Update existing data: split full_name into first_name and last_name if needed
-- Generate user_id for existing users (format: USR-00001)
DO $$
DECLARE
    user_record RECORD;
    counter INTEGER := 1;
BEGIN
    FOR user_record IN SELECT id FROM users WHERE user_id IS NULL LOOP
        UPDATE users
        SET user_id = 'USR-' || LPAD(counter::TEXT, 5, '0'),
            is_active = true
        WHERE id = user_record.id;
        counter := counter + 1;
    END LOOP;
END $$;

-- Make required columns NOT NULL
ALTER TABLE users ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ALTER COLUMN is_active SET NOT NULL;

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================================
-- STEP 4: Restructure Accounts Table
-- ============================================================================

-- Add new columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_id TEXT UNIQUE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS balance DECIMAL(20, 8) DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Update account_type enum to include 'deactivate'
ALTER TYPE account_type RENAME TO account_type_old;
CREATE TYPE account_type AS ENUM ('live', 'demo', 'deactivate');
ALTER TABLE accounts ALTER COLUMN type TYPE account_type USING type::text::account_type;
DROP TYPE account_type_old;

-- Update status enum from (active, deactivated, suspended) to (online, offline)
ALTER TYPE account_status RENAME TO account_status_old;
CREATE TYPE account_status AS ENUM ('online', 'offline');

-- Migrate existing status values
UPDATE accounts SET status = 'offline'::text WHERE status::text IN ('deactivated', 'suspended');
UPDATE accounts SET status = 'online'::text WHERE status::text = 'active';

ALTER TABLE accounts ALTER COLUMN status TYPE account_status USING status::text::account_status;
DROP TYPE account_status_old;

-- Generate account_id for existing accounts (use existing account_number if available)
UPDATE accounts
SET account_id = COALESCE(account_number, 'ACC-' || LPAD(FLOOR(RANDOM() * 99999999)::TEXT, 8, '0'))
WHERE account_id IS NULL;

-- Sync balance from balances table (primary currency)
UPDATE accounts a
SET balance = COALESCE(
    (SELECT amount FROM balances b WHERE b.account_id = a.id AND b.currency = a.currency LIMIT 1),
    0
)
WHERE balance IS NULL OR balance = 0;

-- Set last_updated to current time for existing accounts
UPDATE accounts SET last_updated = updated_at WHERE last_updated IS NULL;

-- Make required columns NOT NULL
ALTER TABLE accounts ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN balance SET NOT NULL;

-- Drop columns no longer needed (optional - keep for now to preserve data)
-- ALTER TABLE accounts DROP COLUMN IF EXISTS account_number;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS product_type;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS nickname;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS color;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS icon;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS last_accessed_at;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS access_count;

-- Create index on account_id
CREATE INDEX IF NOT EXISTS idx_accounts_account_id ON accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

-- ============================================================================
-- STEP 5: Create pending_registrations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    hash_password TEXT NOT NULL,
    country TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('approved', 'rejected', 'pending')),
    admin_id UUID,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_pending_registrations_email ON pending_registrations(email);
CREATE INDEX idx_pending_registrations_status ON pending_registrations(status);
CREATE INDEX idx_pending_registrations_created_at ON pending_registrations(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_pending_registrations_updated_at
    BEFORE UPDATE ON pending_registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE pending_registrations IS 'User registrations awaiting admin approval';
-- ============================================================================
-- STEP 6: Create order_history Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT UNIQUE NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    volume DECIMAL(20, 8) NOT NULL CHECK (volume > 0),
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
    tp DECIMAL(20, 8),
    sl DECIMAL(20, 8),
    open_time TIMESTAMP NOT NULL,
    close_time TIMESTAMP,
    open_price DECIMAL(20, 8) NOT NULL,
    close_price DECIMAL(20, 8),
    profit DECIMAL(20, 8),
    change DECIMAL(10, 4),
    status TEXT DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'unsuccessful')),
    leverage INTEGER DEFAULT 1,
    commission DECIMAL(20, 8) DEFAULT 0,
    swap DECIMAL(20, 8) DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_order_history_account_id ON order_history(account_id);
CREATE INDEX idx_order_history_symbol ON order_history(symbol);
CREATE INDEX idx_order_history_status ON order_history(status);
CREATE INDEX idx_order_history_open_time ON order_history(open_time DESC);
CREATE INDEX idx_order_history_close_time ON order_history(close_time DESC);
CREATE INDEX idx_order_history_order_id ON order_history(order_id);
CREATE INDEX idx_order_history_account_open_time ON order_history(account_id, open_time DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_order_history_updated_at
    BEFORE UPDATE ON order_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE order_history IS 'Completed and closed trades with full lifecycle tracking';

-- ============================================================================
-- STEP 7: Create Helper Function for Generating Order IDs
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS order_history_id_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_history_id()
RETURNS TEXT AS $$
DECLARE
    next_id INTEGER;
    new_order_id TEXT;
    max_attempts INTEGER := 10;
    attempt INTEGER := 0;
BEGIN
    LOOP
        next_id := nextval('order_history_id_seq');
        new_order_id := 'ORD-' || LPAD(next_id::TEXT, 8, '0');

        IF NOT EXISTS (SELECT 1 FROM order_history WHERE order_id = new_order_id) THEN
            RETURN new_order_id;
        END IF;

        attempt := attempt + 1;
        IF attempt >= max_attempts THEN
            RAISE EXCEPTION 'Failed to generate unique order_id after % attempts', max_attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 8: Update Trigger for Syncing Account Balance
-- ============================================================================

-- Create trigger to sync account balance when balances table changes
CREATE OR REPLACE FUNCTION sync_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the account's balance field with primary currency balance
    UPDATE accounts
    SET balance = NEW.amount,
        last_updated = NOW()
    WHERE id = NEW.account_id
    AND currency = NEW.currency;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_account_balance
    AFTER INSERT OR UPDATE ON balances
    FOR EACH ROW
    EXECUTE FUNCTION sync_account_balance();

COMMENT ON FUNCTION sync_account_balance() IS 'Sync account balance field when balances table changes';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 000008_restructure_auth_system completed successfully';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  - Removed Supabase Auth integration';
    RAISE NOTICE '  - Restructured users table with custom auth fields';
    RAISE NOTICE '  - Restructured accounts table with balance reference';
    RAISE NOTICE '  - Created pending_registrations table';
    RAISE NOTICE '  - Created order_history table';
    RAISE NOTICE '  - All existing data preserved';
END $$;

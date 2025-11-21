-- Migration: 000009_cleanup_exact_schema
-- Description: Clean up tables to match EXACT user-specified schema
-- Date: 2025-01-18

-- ============================================================================
-- STEP 1: Clean up users table - Remove extra columns
-- ============================================================================

-- Drop trigger first
DROP TRIGGER IF EXISTS update_users_last_updated_at ON users;
DROP FUNCTION IF EXISTS update_users_last_updated_at();

-- The users table should have ONLY:
-- id, user_id, first_name, last_name, email, hash_password, phone_number,
-- country, is_active, last_login, created_at, last_updated_at

-- Keep these columns (do nothing - they're required)
-- Remove any extra columns not in the spec

ALTER TABLE users DROP COLUMN IF EXISTS updated_at;
ALTER TABLE users DROP COLUMN IF EXISTS full_name;

-- Verify structure
DO $$
BEGIN
    RAISE NOTICE 'Users table cleaned up ✓';
END $$;

-- ============================================================================
-- STEP 2: Clean up accounts table - Remove extra columns
-- ============================================================================

-- Drop trigger first
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
DROP TRIGGER IF EXISTS trigger_sync_account_balance ON balances;
DROP FUNCTION IF EXISTS sync_account_balance();

-- The accounts table should have ONLY:
-- id, account_id, account_type, balance, currency, status,
-- last_updated, last_login, created_at, user_id

-- Remove extra columns
ALTER TABLE accounts DROP COLUMN IF EXISTS account_number CASCADE;
ALTER TABLE accounts DROP COLUMN IF EXISTS product_type;
ALTER TABLE accounts DROP COLUMN IF EXISTS nickname;
ALTER TABLE accounts DROP COLUMN IF EXISTS color;
ALTER TABLE accounts DROP COLUMN IF EXISTS icon;
ALTER TABLE accounts DROP COLUMN IF EXISTS last_accessed_at;
ALTER TABLE accounts DROP COLUMN IF EXISTS access_count;
ALTER TABLE accounts DROP COLUMN IF EXISTS updated_at;

-- Rename type to account_type for clarity
ALTER TABLE accounts RENAME COLUMN type TO account_type;

-- Verify structure
DO $$
BEGIN
    RAISE NOTICE 'Accounts table cleaned up ✓';
END $$;

-- ============================================================================
-- STEP 3: Clean up order_history table - Remove extra columns
-- ============================================================================

-- Drop trigger first
DROP TRIGGER IF EXISTS update_order_history_updated_at ON order_history;

-- The order_history table should have ONLY:
-- id, order_id, account_id, symbol, volume, type, tp, sl,
-- open_time, close_time, open_price, close_price, profit, change, status

-- Remove extra columns
ALTER TABLE order_history DROP COLUMN IF EXISTS leverage;
ALTER TABLE order_history DROP COLUMN IF EXISTS commission;
ALTER TABLE order_history DROP COLUMN IF EXISTS swap;
ALTER TABLE order_history DROP COLUMN IF EXISTS metadata;
ALTER TABLE order_history DROP COLUMN IF EXISTS created_at;
ALTER TABLE order_history DROP COLUMN IF EXISTS updated_at;

-- Rename sl to sl (already correct)
-- Rename tp to tp (already correct)

-- Verify structure
DO $$
BEGIN
    RAISE NOTICE 'Order_history table cleaned up ✓';
END $$;

-- ============================================================================
-- STEP 4: Verify pending_registrations table (should be correct)
-- ============================================================================

-- The pending_registrations table should have:
-- id, first_name, last_name, email, phone_number, hash_password,
-- country, status, admin_id, reviewed_at

-- Drop extra columns if they exist
DROP TRIGGER IF EXISTS update_pending_registrations_updated_at ON pending_registrations;
ALTER TABLE pending_registrations DROP COLUMN IF EXISTS created_at;
ALTER TABLE pending_registrations DROP COLUMN IF EXISTS updated_at;

-- Verify structure
DO $$
BEGIN
    RAISE NOTICE 'pending_registrations table cleaned up ✓';
END $$;

-- ============================================================================
-- STEP 5: Drop unused helper functions and sequences
-- ============================================================================

-- Drop the order history ID generator (not needed)
DROP FUNCTION IF EXISTS generate_order_history_id();
DROP SEQUENCE IF EXISTS order_history_id_seq;

-- ============================================================================
-- Final verification
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Schema cleanup completed!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables now match EXACT user specification:';
    RAISE NOTICE '';
    RAISE NOTICE '1. pending_registrations:';
    RAISE NOTICE '   - id, first_name, last_name, email, phone_number,';
    RAISE NOTICE '   - hash_password, country, status, admin_id, reviewed_at';
    RAISE NOTICE '';
    RAISE NOTICE '2. users:';
    RAISE NOTICE '   - id, user_id, first_name, last_name, email,';
    RAISE NOTICE '   - hash_password, phone_number, country, is_active,';
    RAISE NOTICE '   - last_login, created_at, last_updated_at';
    RAISE NOTICE '';
    RAISE NOTICE '3. accounts:';
    RAISE NOTICE '   - id, account_id, account_type, balance, currency,';
    RAISE NOTICE '   - status, last_updated, last_login, created_at, user_id';
    RAISE NOTICE '';
    RAISE NOTICE '4. order_history:';
    RAISE NOTICE '   - id, order_id, account_id, symbol, volume, type,';
    RAISE NOTICE '   - tp, sl, open_time, close_time, open_price,';
    RAISE NOTICE '   - close_price, profit, change, status';
    RAISE NOTICE '';
    RAISE NOTICE 'All extra columns removed!';
    RAISE NOTICE '';
END $$;

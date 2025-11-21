-- Migration: 000010_standardize_readable_ids
-- Description: Standardize all readable IDs with sequential generation and type-specific ranges
-- Date: 2025-01-18

-- ============================================================================
-- STEP 1: Create Account ID Sequences with Type-Specific Ranges
-- ============================================================================

-- Live accounts: ACC-1000001 to ACC-5000000
CREATE SEQUENCE IF NOT EXISTS account_id_live_seq START WITH 1000001 MAXVALUE 5000000;

-- Demo accounts: ACC-5000001 to ACC-9999999
CREATE SEQUENCE IF NOT EXISTS account_id_demo_seq START WITH 5000001 MAXVALUE 9999999;

COMMENT ON SEQUENCE account_id_live_seq IS 'Sequential ID generator for live accounts (1000001-5000000)';
COMMENT ON SEQUENCE account_id_demo_seq IS 'Sequential ID generator for demo accounts (5000001-9999999)';

-- ============================================================================
-- STEP 2: Update Account ID Generation Function
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_account_id(p_account_type account_type)
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    new_account_id TEXT;
    max_attempts INTEGER := 10;
    attempt INTEGER := 0;
BEGIN
    LOOP
        -- Use appropriate sequence based on account type
        IF p_account_type = 'live' THEN
            next_val := nextval('account_id_live_seq');
        ELSIF p_account_type = 'demo' THEN
            next_val := nextval('account_id_demo_seq');
        ELSE
            -- Deactivated accounts use demo sequence
            next_val := nextval('account_id_demo_seq');
        END IF;

        new_account_id := 'ACC-' || LPAD(next_val::TEXT, 7, '0');

        -- Check for collision (should be extremely rare)
        IF NOT EXISTS (SELECT 1 FROM accounts WHERE account_id = new_account_id) THEN
            RETURN new_account_id;
        END IF;

        attempt := attempt + 1;
        IF attempt >= max_attempts THEN
            RAISE EXCEPTION 'Failed to generate unique account_id after % attempts', max_attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_account_id(account_type) IS 'Generate sequential account IDs with type-specific ranges (live: 1000001-5000000, demo: 5000001-9999999)';

-- ============================================================================
-- STEP 3: Migrate Existing Accounts to Sequential IDs
-- ============================================================================

DO $$
DECLARE
    account_record RECORD;
    live_counter INTEGER := 1000001;
    demo_counter INTEGER := 5000001;
BEGIN
    -- Migrate live accounts (ordered by creation date)
    FOR account_record IN
        SELECT id FROM accounts
        WHERE account_type = 'live'
        ORDER BY created_at LOOP

        UPDATE accounts
        SET account_id = 'ACC-' || LPAD(live_counter::TEXT, 7, '0')
        WHERE id = account_record.id;

        live_counter := live_counter + 1;
    END LOOP;

    -- Migrate demo accounts (ordered by creation date)
    FOR account_record IN
        SELECT id FROM accounts
        WHERE account_type = 'demo'
        ORDER BY created_at LOOP

        UPDATE accounts
        SET account_id = 'ACC-' || LPAD(demo_counter::TEXT, 7, '0')
        WHERE id = account_record.id;

        demo_counter := demo_counter + 1;
    END LOOP;

    -- Update sequences to continue from where migration left off
    PERFORM setval('account_id_live_seq', live_counter, false);
    PERFORM setval('account_id_demo_seq', demo_counter, false);

    RAISE NOTICE 'Migrated % live accounts and % demo accounts to sequential IDs',
        live_counter - 1000001, demo_counter - 5000001;
END $$;

-- ============================================================================
-- STEP 4: Standardize Order ID Padding to 8 Digits
-- ============================================================================

-- Update the generate_order_number function to use 8-digit padding
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    new_order_number TEXT;
    max_attempts INTEGER := 10;
    attempt INTEGER := 0;
BEGIN
    LOOP
        next_val := nextval('order_number_seq');
        -- Changed from 5-digit to 8-digit padding
        new_order_number := 'ORD-' || LPAD(next_val::TEXT, 8, '0');

        -- Check for collision in both orders and pending_orders tables
        IF NOT EXISTS (
            SELECT 1 FROM orders WHERE order_number = new_order_number
            UNION ALL
            SELECT 1 FROM pending_orders WHERE order_number = new_order_number
        ) THEN
            RETURN new_order_number;
        END IF;

        attempt := attempt + 1;
        IF attempt >= max_attempts THEN
            RAISE EXCEPTION 'Failed to generate unique order_number after % attempts', max_attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_order_number() IS 'Generate sequential order numbers with 8-digit padding (ORD-00000001)';

-- Migrate existing order numbers from 5-digit to 8-digit format
UPDATE orders
SET order_number = 'ORD-' || LPAD(SUBSTRING(order_number FROM 5)::TEXT, 8, '0')
WHERE order_number ~ '^ORD-\d{5}$';

UPDATE pending_orders
SET order_number = 'ORD-' || LPAD(SUBSTRING(order_number FROM 5)::TEXT, 8, '0')
WHERE order_number ~ '^ORD-\d{5}$';

-- ============================================================================
-- STEP 5: Add Comment to account_number for Deprecation Notice
-- ============================================================================

COMMENT ON COLUMN accounts.account_number IS 'DEPRECATED: Use account_id instead. Kept for backward compatibility only.';

-- ============================================================================
-- STEP 6: Create Indexes for Performance
-- ============================================================================

-- Ensure account_id has an index (should already exist from migration 000008)
CREATE INDEX IF NOT EXISTS idx_accounts_account_id ON accounts(account_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 000010_standardize_readable_ids completed successfully';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  - Created type-specific account ID sequences (live: 1000001-5000000, demo: 5000001-9999999)';
    RAISE NOTICE '  - Migrated all existing accounts to sequential IDs';
    RAISE NOTICE '  - Standardized order ID padding to 8 digits';
    RAISE NOTICE '  - Updated generation functions';
    RAISE NOTICE '  - Marked account_number as deprecated';
END $$;

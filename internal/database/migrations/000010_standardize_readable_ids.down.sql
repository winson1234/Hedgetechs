-- Migration Rollback: 000010_standardize_readable_ids
-- Description: Rollback standardized readable IDs to previous state
-- Date: 2025-01-18

-- ============================================================================
-- WARNING: This rollback will restore random account IDs and 5-digit order padding
-- ============================================================================

-- ============================================================================
-- STEP 1: Restore Original generate_order_number Function (5-digit padding)
-- ============================================================================

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
        -- Restore 5-digit padding
        new_order_number := 'ORD-' || LPAD(next_val::TEXT, 5, '0');

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

-- ============================================================================
-- STEP 2: Restore Original Account ID Generation (Random)
-- ============================================================================

-- Drop the type-specific function
DROP FUNCTION IF EXISTS generate_account_id(account_type);

-- Note: We cannot restore previous random account IDs as that data is lost
-- New accounts will continue to use sequential IDs from the sequences

-- ============================================================================
-- STEP 3: Drop Type-Specific Sequences
-- ============================================================================

DROP SEQUENCE IF EXISTS account_id_live_seq;
DROP SEQUENCE IF EXISTS account_id_demo_seq;

-- ============================================================================
-- STEP 4: Remove Deprecation Comment
-- ============================================================================

COMMENT ON COLUMN accounts.account_number IS NULL;

-- ============================================================================
-- Rollback Complete
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Rollback of migration 000010 completed';
    RAISE WARNING 'Account IDs cannot be restored to random format - they will remain sequential';
    RAISE WARNING 'Order numbers remain in 8-digit format - new orders will use 5-digit format';
END $$;

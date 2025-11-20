-- Migration 000014: Fix account_id column type from bigint to TEXT
-- This aligns with the readable ID format (ACC-1234567) expected by the application

BEGIN;

-- Drop the unique constraint on account_id if it exists
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_id_key;

-- Convert account_id from bigint to TEXT
-- For any existing records, convert the bigint to the proper format
ALTER TABLE accounts ALTER COLUMN account_id TYPE TEXT
USING CASE
    WHEN account_id IS NOT NULL THEN 'ACC-' || LPAD(account_id::TEXT, 7, '0')
    ELSE NULL
END;

-- Re-add the UNIQUE constraint
ALTER TABLE accounts ADD CONSTRAINT accounts_account_id_key UNIQUE (account_id);

-- Ensure the account_id column is NOT NULL
ALTER TABLE accounts ALTER COLUMN account_id DROP NOT NULL;  -- Temporarily allow NULL
ALTER TABLE accounts ALTER COLUMN account_id SET NOT NULL;   -- Re-enforce NOT NULL

COMMIT;

COMMENT ON COLUMN accounts.account_id IS 'Human-readable account ID (format: ACC-1234567)';

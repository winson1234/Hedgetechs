-- Migration 000015: Convert account_id from TEXT to BIGSERIAL
-- This removes the readable "ACC-1234567" format and uses plain numbers

BEGIN;

-- Drop the generate_account_id function (no longer needed)
DROP FUNCTION IF EXISTS generate_account_id(account_type_enum);

-- Drop the type-specific sequences (no longer needed)
DROP SEQUENCE IF EXISTS account_id_live_seq;
DROP SEQUENCE IF EXISTS account_id_demo_seq;

-- Remove default from account_id column (so we can drop the sequence)
ALTER TABLE accounts ALTER COLUMN account_id DROP DEFAULT;

-- Drop existing sequence if it exists
DROP SEQUENCE IF EXISTS accounts_account_id_seq CASCADE;

-- Drop the unique constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_id_key;

-- Add temporary bigint column
ALTER TABLE accounts ADD COLUMN account_id_bigint BIGINT;

-- Populate account_id_bigint by extracting numeric part from TEXT
UPDATE accounts
SET account_id_bigint = SUBSTRING(account_id FROM 5)::BIGINT
WHERE account_id ~ '^ACC-\d+$';

-- Get the max value and create sequence
DO $$
DECLARE
    max_id BIGINT;
BEGIN
    SELECT COALESCE(MAX(account_id_bigint), 0) INTO max_id FROM accounts;
    EXECUTE format('CREATE SEQUENCE accounts_account_id_seq START WITH %s', max_id + 1);
END $$;

-- Drop old TEXT account_id column
ALTER TABLE accounts DROP COLUMN account_id;

-- Rename account_id_bigint to account_id
ALTER TABLE accounts RENAME COLUMN account_id_bigint TO account_id;

-- Set the sequence as the default value
ALTER TABLE accounts ALTER COLUMN account_id SET DEFAULT nextval('accounts_account_id_seq');

-- Add UNIQUE constraint
ALTER TABLE accounts ADD CONSTRAINT accounts_account_id_key UNIQUE (account_id);

-- Set NOT NULL constraint
ALTER TABLE accounts ALTER COLUMN account_id SET NOT NULL;

COMMIT;

COMMENT ON COLUMN accounts.account_id IS 'Auto-incrementing account number (bigint)';

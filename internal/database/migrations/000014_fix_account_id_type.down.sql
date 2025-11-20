-- Migration 000014 Down: Revert account_id back to bigint

BEGIN;

-- Drop unique constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_id_key;

-- Convert account_id back from TEXT to bigint
-- Extract numeric part from 'ACC-1234567' format
ALTER TABLE accounts ALTER COLUMN account_id TYPE bigint
USING CASE
    WHEN account_id ~ '^ACC-\d+$' THEN SUBSTRING(account_id FROM 5)::bigint
    ELSE NULL::bigint
END;

-- Re-add UNIQUE constraint
ALTER TABLE accounts ADD CONSTRAINT accounts_account_id_key UNIQUE (account_id);

-- Ensure NOT NULL
ALTER TABLE accounts ALTER COLUMN account_id SET NOT NULL;

COMMIT;

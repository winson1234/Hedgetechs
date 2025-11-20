-- Migration 000015 Down: Revert account_id back to TEXT with ACC- prefix

BEGIN;

-- Drop unique constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_id_key;

-- Add temporary TEXT column
ALTER TABLE accounts ADD COLUMN account_id_text TEXT;

-- Populate account_id_text by adding "ACC-" prefix to bigint
UPDATE accounts
SET account_id_text = 'ACC-' || LPAD(account_id::TEXT, 7, '0');

-- Drop bigint account_id column
ALTER TABLE accounts DROP COLUMN account_id;

-- Rename account_id_text to account_id
ALTER TABLE accounts RENAME COLUMN account_id_text TO account_id;

-- Add UNIQUE constraint
ALTER TABLE accounts ADD CONSTRAINT accounts_account_id_key UNIQUE (account_id);

-- Set NOT NULL constraint
ALTER TABLE accounts ALTER COLUMN account_id SET NOT NULL;

-- Drop the sequence
DROP SEQUENCE IF EXISTS accounts_account_id_seq;

-- Recreate the generate_account_id function
CREATE SEQUENCE IF NOT EXISTS account_id_live_seq START WITH 1000001 MAXVALUE 5000000;
CREATE SEQUENCE IF NOT EXISTS account_id_demo_seq START WITH 5000001 MAXVALUE 9999999;

CREATE OR REPLACE FUNCTION generate_account_id(p_account_type account_type_enum)
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    new_account_id TEXT;
    max_attempts INTEGER := 10;
    attempt INTEGER := 0;
BEGIN
    LOOP
        IF p_account_type = 'live' THEN
            next_val := nextval('account_id_live_seq');
        ELSIF p_account_type = 'demo' THEN
            next_val := nextval('account_id_demo_seq');
        ELSE
            next_val := nextval('account_id_demo_seq');
        END IF;

        new_account_id := 'ACC-' || LPAD(next_val::TEXT, 7, '0');

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

COMMIT;

COMMENT ON COLUMN accounts.account_id IS 'Human-readable account ID (format: ACC-1234567)';

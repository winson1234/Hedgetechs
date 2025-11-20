-- Migration 000013 Down: Revert user_id back to bigint

BEGIN;

-- Drop dependent view first
DROP VIEW IF EXISTS account_stats;

-- Drop foreign key constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_accounts_user_id;
DROP INDEX IF EXISTS idx_accounts_user_status;
DROP INDEX IF EXISTS idx_accounts_user_type;

-- Add temporary bigint column
ALTER TABLE accounts ADD COLUMN user_bigint_id bigint;

-- Populate user_bigint_id from users table (lookup UUID id -> bigint user_id)
UPDATE accounts a
SET user_bigint_id = u.user_id
FROM users u
WHERE a.user_id = u.id;

-- Drop UUID user_id column
ALTER TABLE accounts DROP COLUMN user_id;

-- Rename user_bigint_id to user_id
ALTER TABLE accounts RENAME COLUMN user_bigint_id TO user_id;

-- Set NOT NULL constraint
ALTER TABLE accounts ALTER COLUMN user_id SET NOT NULL;

-- Add foreign key constraint back to users.user_id (bigint)
ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- Recreate indexes
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_user_status ON accounts(user_id, status);
CREATE INDEX idx_accounts_user_type ON accounts(user_id, account_type);

-- Recreate the view with bigint user_id
CREATE VIEW account_stats AS
 SELECT count(*) AS total_accounts,
    count(*) FILTER (WHERE status = 'active'::account_status_enum) AS active_accounts,
    count(*) FILTER (WHERE status = 'deactivated'::account_status_enum) AS deactivated_accounts,
    count(*) FILTER (WHERE account_type = 'live'::account_type_enum) AS live_accounts,
    count(*) FILTER (WHERE account_type = 'demo'::account_type_enum) AS demo_accounts,
    count(*) FILTER (WHERE account_type = 'live'::account_type_enum AND status = 'active'::account_status_enum) AS active_live_accounts,
    count(*) FILTER (WHERE account_type = 'demo'::account_type_enum AND status = 'active'::account_status_enum) AS active_demo_accounts,
    COALESCE(sum(balance) FILTER (WHERE account_type = 'live'::account_type_enum), 0::numeric) AS total_live_balance,
    COALESCE(sum(balance) FILTER (WHERE account_type = 'demo'::account_type_enum), 0::numeric) AS total_demo_balance,
    COALESCE(avg(balance) FILTER (WHERE account_type = 'live'::account_type_enum), 0::numeric) AS avg_live_balance,
    COALESCE(avg(balance) FILTER (WHERE account_type = 'demo'::account_type_enum), 0::numeric) AS avg_demo_balance,
    count(*) FILTER (WHERE created_at >= (now() - '24:00:00'::interval)) AS accounts_created_last_24h,
    count(*) FILTER (WHERE created_at >= (now() - '7 days'::interval)) AS accounts_created_last_7d,
    count(DISTINCT user_id) AS unique_users_with_accounts
   FROM accounts;

COMMIT;

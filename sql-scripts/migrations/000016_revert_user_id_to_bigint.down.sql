-- Migration 000016 down: Convert accounts.user_id back to UUID (revert this migration)

BEGIN;

-- Drop dependent view
DROP VIEW IF EXISTS account_stats;

-- Drop foreign key constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_accounts_user_id;
DROP INDEX IF EXISTS idx_accounts_user_status;
DROP INDEX IF EXISTS idx_accounts_user_type;

-- Add temporary UUID column
ALTER TABLE accounts ADD COLUMN user_uuid uuid;

-- Populate user_uuid from users table (lookup bigint user_id -> UUID id)
UPDATE accounts a
SET user_uuid = u.id
FROM users u
WHERE a.user_id = u.user_id;

-- Drop old bigint user_id column
ALTER TABLE accounts DROP COLUMN user_id;

-- Rename user_uuid to user_id
ALTER TABLE accounts RENAME COLUMN user_uuid TO user_id;

-- Set NOT NULL constraint
ALTER TABLE accounts ALTER COLUMN user_id SET NOT NULL;

-- Add foreign key constraint referencing users.id (UUID)
ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Recreate indexes
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_user_status ON accounts(user_id, status);
CREATE INDEX idx_accounts_user_type ON accounts(user_id, account_type);

-- Recreate the view (with UUID user_id)
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

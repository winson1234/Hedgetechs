-- Remove unique constraint that restricts users to a single account
ALTER TABLE accounts
DROP CONSTRAINT IF EXISTS unique_user_account_type;
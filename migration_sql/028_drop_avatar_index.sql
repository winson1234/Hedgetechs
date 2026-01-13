-- Drop the index on avatar_url as it causes issues with large base64 strings
DROP INDEX IF EXISTS idx_users_avatar_url;
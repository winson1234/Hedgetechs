-- View: account_stats
-- Provides aggregated statistics about accounts for monitoring and reporting

CREATE OR REPLACE VIEW public.account_stats AS
SELECT
    count(*) AS total_accounts,
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
    count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS accounts_created_last_24h,
    count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS accounts_created_last_7d,
    count(DISTINCT user_id) AS unique_users_with_accounts
FROM public.accounts;

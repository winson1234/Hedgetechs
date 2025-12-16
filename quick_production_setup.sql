-- ================================================================
-- QUICK PRODUCTION DATABASE SETUP
-- ================================================================
-- This file can be executed directly in your production database
-- Usage: psql -h HOST -U USER -d DATABASE -f quick_production_setup.sql
-- ================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '  🚀 Starting Production Database Setup'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Suppress NOTICE messages for cleaner output
SET client_min_messages TO WARNING;

\echo '📦 Loading migration files...'
\echo ''

-- Execute all migration files in order
\ir migration_sql/001_users.sql
\echo '✅ Users table created'

\ir migration_sql/002_admins.sql
\echo '✅ Admins table created'

\ir migration_sql/003_accounts.sql
\echo '✅ Accounts table created'

\ir migration_sql/004_instruments.sql
\echo '✅ Instruments table created'

\ir migration_sql/005_pending_registrations.sql
\echo '✅ Pending registrations table created'

\ir migration_sql/006_forex_configurations.sql
\echo '✅ Forex configurations table created'

\ir migration_sql/007_spot_configurations.sql
\echo '✅ Spot configurations table created'

\ir migration_sql/008_pending_orders.sql
\echo '✅ Pending orders table created'

\ir migration_sql/009_contracts.sql
\echo '✅ Contracts table created'

\ir migration_sql/010_orders.sql
\echo '✅ Orders table created'

\ir migration_sql/011_transactions.sql
\echo '✅ Transactions table created'

\ir migration_sql/012_forex_klines_1m.sql
\echo '✅ Forex klines table created'

\ir migration_sql/013_deposits.sql
\echo '✅ Deposits table created'

\ir migration_sql/014_balances.sql
\echo '✅ Balances table created'

\ir migration_sql/015_add_deposit_audit_columns.sql
\echo '✅ Deposit audit columns added'

\ir migration_sql/016_withdrawals.sql
\echo '✅ Withdrawals table created'

\ir migration_sql/017_saved_withdrawal_methods.sql
\echo '✅ Saved withdrawal methods table created'

\ir sql-scripts/schema/tables/notifications.sql
\echo '✅ Notifications table created'

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '  📊 Verification'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Reset message level
SET client_min_messages TO NOTICE;

-- List all tables
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN tablename IN ('users', 'accounts', 'transactions', 'deposits', 'withdrawals', 'notifications') 
        THEN '✅ Core table'
        ELSE '📋 Supporting table'
    END AS importance
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '  🎉 Database Setup Complete!'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Next steps:'
\echo '1. Update your .env file with database credentials'
\echo '2. Restart your backend server'
\echo '3. Test the /api/v1/auth/register endpoint'
\echo ''

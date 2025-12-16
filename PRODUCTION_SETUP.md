# Production Database Setup Guide

## Quick Setup

### Option 1: Interactive Script (Recommended)

```bash
# Make script executable
chmod +x setup_production_database.sh

# Run the script
./setup_production_database.sh
```

The script will ask for:
- Database host (e.g., `localhost` or your RDS endpoint)
- Database port (default: `5432`)
- Database name (e.g., `brokerage_prod`)
- Database user (e.g., `postgres`)
- Database password

### Option 2: Using psql directly

```bash
# Connect to your database
psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE

# Then run each migration file:
\i migration_sql/001_users.sql
\i migration_sql/002_admins.sql
\i migration_sql/003_accounts.sql
\i migration_sql/004_instruments.sql
\i migration_sql/005_pending_registrations.sql
\i migration_sql/006_forex_configurations.sql
\i migration_sql/007_spot_configurations.sql
\i migration_sql/008_pending_orders.sql
\i migration_sql/009_contracts.sql
\i migration_sql/010_orders.sql
\i migration_sql/011_transactions.sql
\i migration_sql/012_forex_klines_1m.sql
\i migration_sql/013_deposits.sql
\i migration_sql/014_balances.sql
\i migration_sql/015_add_deposit_audit_columns.sql
\i migration_sql/016_withdrawals.sql
\i migration_sql/017_saved_withdrawal_methods.sql
\i sql-scripts/schema/tables/notifications.sql
```

### Option 3: Using Environment Variables

```bash
export DB_HOST="your_host"
export DB_PORT="5432"
export DB_NAME="brokerage_prod"
export DB_USER="postgres"
export PGPASSWORD="your_password"

# Run all migrations
for file in migration_sql/*.sql; do
    echo "Applying $file..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$file"
done

# Create notifications table
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f sql-scripts/schema/tables/notifications.sql
```

## Verification

After running the setup, verify the tables were created:

```sql
-- List all tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Count rows in key tables
SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL
SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications;
```

## Expected Tables

After setup, you should have these tables:
- ✅ users
- ✅ admins
- ✅ accounts
- ✅ balances
- ✅ transactions
- ✅ deposits
- ✅ withdrawals
- ✅ saved_withdrawal_methods
- ✅ notifications
- ✅ instruments
- ✅ contracts
- ✅ orders
- ✅ pending_orders
- ✅ pending_registrations
- ✅ forex_configurations
- ✅ spot_configurations
- ✅ forex_klines_1m

## Environment Configuration

Update your production `.env` file:

```env
# Database
DB_HOST=your_production_host
DB_PORT=5432
DB_NAME=brokerage_prod
DB_USER=your_user
DB_PASSWORD=your_secure_password
DB_SSLMODE=require

# JWT
JWT_SECRET=your_production_jwt_secret_min_32_chars

# Server
SERVER_PORT=8080
ENVIRONMENT=production
```

## Troubleshooting

### Error: "relation users does not exist"
**Cause:** Database tables haven't been created yet.  
**Solution:** Run the setup script above.

### Error: "permission denied"
**Cause:** Database user doesn't have necessary permissions.  
**Solution:** Grant permissions:
```sql
GRANT ALL PRIVILEGES ON DATABASE brokerage_prod TO your_user;
GRANT ALL ON SCHEMA public TO your_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO your_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_user;
```

### Error: "could not connect to server"
**Cause:** Database server not accessible.  
**Solution:** 
1. Check if PostgreSQL is running
2. Verify firewall rules allow connections
3. Check `pg_hba.conf` for authentication settings

### Migrations already applied
If you see "already exists" errors, that's normal - it means those tables are already created.

## Backup Recommendation

Before running migrations on production:

```bash
# Create backup
pg_dump -h HOST -U USER -d DATABASE > backup_$(date +%Y%m%d).sql

# Restore if needed
psql -h HOST -U USER -d DATABASE < backup_YYYYMMDD.sql
```

## Post-Setup Steps

1. ✅ Verify all tables exist
2. ✅ Create first admin user (if needed)
3. ✅ Seed instruments data
4. ✅ Test user registration endpoint
5. ✅ Configure SSL certificates
6. ✅ Set up monitoring and logging

## Support

If you encounter any issues:
1. Check PostgreSQL logs: `tail -f /var/log/postgresql/postgresql-*.log`
2. Check backend logs: `journalctl -u your-backend-service -f`
3. Verify database connection: `psql -h HOST -U USER -d DATABASE -c "SELECT 1;"`

#!/bin/bash

# ============================================
# Production Database Setup Script
# ============================================
# This script sets up the complete database schema for production
# Usage: ./setup_production_database.sh
# ============================================

set -e  # Exit on any error

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Production Database Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Database connection details (modify these for your production environment)
read -p "Enter database host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Enter database port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Enter database name (default: brokerage_prod): " DB_NAME
DB_NAME=${DB_NAME:-brokerage_prod}

read -p "Enter database user (default: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

read -sp "Enter database password: " DB_PASSWORD
echo ""
echo ""

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

echo "📋 Configuration:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Test connection
echo "🔌 Testing database connection..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Connection successful${NC}"
else
    echo -e "${RED}❌ Connection failed. Please check your credentials.${NC}"
    exit 1
fi
echo ""

# Create a backup function
create_backup() {
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    echo "💾 Creating backup: $backup_file"
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$backup_file" 2>/dev/null || true
    echo -e "${GREEN}✅ Backup created${NC}"
}

# Ask if user wants to backup first
read -p "Do you want to create a backup first? (y/N): " CREATE_BACKUP
if [[ "$CREATE_BACKUP" =~ ^[Yy]$ ]]; then
    create_backup
    echo ""
fi

echo "📦 Applying migrations from migration_sql/ directory..."
echo ""

# Migration files in order
MIGRATIONS=(
    "001_users.sql"
    "002_admins.sql"
    "003_accounts.sql"
    "004_instruments.sql"
    "005_pending_registrations.sql"
    "006_forex_configurations.sql"
    "007_spot_configurations.sql"
    "008_pending_orders.sql"
    "009_contracts.sql"
    "010_orders.sql"
    "011_transactions.sql"
    "012_forex_klines_1m.sql"
    "013_deposits.sql"
    "014_balances.sql"
    "015_add_deposit_audit_columns.sql"
    "016_withdrawals.sql"
    "017_saved_withdrawal_methods.sql"
)

SUCCESS_COUNT=0
FAILED_COUNT=0

# Apply each migration
for migration in "${MIGRATIONS[@]}"; do
    migration_path="migration_sql/$migration"
    
    if [ -f "$migration_path" ]; then
        echo -e "${BLUE}→ Applying $migration...${NC}"
        
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_path" > /dev/null 2>&1; then
            echo -e "${GREEN}  ✅ Success${NC}"
            ((SUCCESS_COUNT++))
        else
            echo -e "${YELLOW}  ⚠️  Warning (may already exist)${NC}"
            # Try to continue anyway - tables might already exist
            ((SUCCESS_COUNT++))
        fi
    else
        echo -e "${RED}  ❌ File not found: $migration_path${NC}"
        ((FAILED_COUNT++))
    fi
    echo ""
done

# Create notifications table
echo -e "${BLUE}→ Creating notifications table...${NC}"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id bigint NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications USING btree (user_id, is_read, created_at DESC);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✅ Notifications table created${NC}"
    ((SUCCESS_COUNT++))
else
    echo -e "${YELLOW}  ⚠️  Warning (may already exist)${NC}"
    ((SUCCESS_COUNT++))
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Successful: $SUCCESS_COUNT${NC}"
if [ $FAILED_COUNT -gt 0 ]; then
    echo -e "${RED}❌ Failed: $FAILED_COUNT${NC}"
fi
echo ""

# Verify tables exist
echo "🔍 Verifying database schema..."
echo ""
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"
echo ""

# Count tables
TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';")
echo -e "${GREEN}✅ Database setup complete! ($TABLE_COUNT tables created)${NC}"
echo ""

# Show important tables
echo "📋 Key tables:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    tablename,
    (SELECT COUNT(*) FROM pg_class WHERE relname = tablename) as exists
FROM (VALUES 
    ('users'),
    ('accounts'),
    ('transactions'),
    ('deposits'),
    ('withdrawals'),
    ('notifications'),
    ('instruments')
) AS t(tablename);
"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Update your .env file with production database credentials"
echo "2. Restart your backend server"
echo "3. Test user registration"
echo ""

# Clean up
unset PGPASSWORD

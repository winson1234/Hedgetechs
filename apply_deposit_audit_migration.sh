#!/bin/bash

# ============================================
# Apply Deposit Audit Columns Migration
# ============================================
# This script applies migration 015 to add
# audit tracking columns to the deposits table
# ============================================

set -e  # Exit on any error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Applying Deposit Audit Columns Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Database connection details
DB_CONTAINER="brokerage-postgres-dev"
DB_USER="postgres"
DB_NAME="brokerage_dev"

# Check if container is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo "❌ Error: Container $DB_CONTAINER is not running"
    echo "   Please start it with: make dev"
    exit 1
fi

echo "📦 Applying migration: 015_add_deposit_audit_columns.sql"
echo ""

# Apply the migration
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < migration_sql/015_add_deposit_audit_columns.sql

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Migration Applied Successfully"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verify the columns were added
echo "🔍 Verifying new columns in deposits table..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'deposits' 
  AND column_name IN ('client_ip', 'admin_ip', 'approved_at', 'rejected_at', 'approved_by', 'rejected_by')
ORDER BY column_name;
"

echo ""
echo "✅ Deposit audit columns are now available!"
echo ""
echo "📝 See DEPOSIT_AUDIT_COLUMNS.md for more details"


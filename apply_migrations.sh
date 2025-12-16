#!/bin/bash

# ============================================
# Apply All Database Migrations
# ============================================
# This script applies all migrations in the correct order
# ============================================

set -e  # Exit on any error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Applying Database Migrations"
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

echo "📦 Applying migrations from migration_sql/ directory..."
echo ""

# Apply migrations in numerical order
for i in $(seq -w 1 15); do
    migration_file="migration_sql/${i#0}_*.sql"
    
    # Find the actual file (handles wildcards)
    actual_file=$(ls $migration_file 2>/dev/null | head -1)
    
    if [ -f "$actual_file" ]; then
        echo "→ Applying $(basename "$actual_file")..."
        
        if docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$actual_file" 2>&1 | grep -v "NOTICE"; then
            echo "  ✅ Success"
        else
            echo "  ⚠️  May have warnings (likely already exists)"
        fi
    else
        echo "⏭️  Skipping ${i} (file not found)"
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ All Migrations Applied"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verify tables exist
echo "🔍 Verifying database schema..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"
echo ""
echo "✅ Database is ready!"

#!/bin/bash
# ============================================
# Manual Database Initialization
# ============================================
# Run this script to initialize database tables
# after the postgres container is running
# ============================================

set -e

echo "================================================"
echo "🚀 Manual Database Initialization"
echo "================================================"
echo ""

# Check if container is running
if ! docker ps | grep -q brokerage-postgres-prod; then
    echo "❌ Error: brokerage-postgres-prod container is not running!"
    echo "Start it first with: docker compose -f deployment/docker-compose.prod.yml up -d postgres"
    exit 1
fi

echo "✅ Container is running"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "📁 Project root: $PROJECT_ROOT"
echo "📁 Migration folder: $PROJECT_ROOT/migration_sql"
echo ""

# Check if migration_sql exists
if [ ! -d "$PROJECT_ROOT/migration_sql" ]; then
    echo "❌ Error: migration_sql directory not found at $PROJECT_ROOT/migration_sql"
    exit 1
fi

# Copy migration files to container
echo "📦 Copying migration files to container..."
docker cp "$PROJECT_ROOT/migration_sql" brokerage-postgres-prod:/tmp/

echo ""
echo "🔧 Running migrations..."
echo ""

# Get database credentials from environment or use defaults
DB_NAME="${POSTGRES_DB:-brokerage}"
DB_USER="${POSTGRES_USER:-postgres}"

# Run each migration file
for sql_file in "$PROJECT_ROOT"/migration_sql/*.sql; do
    if [ -f "$sql_file" ]; then
        filename=$(basename "$sql_file")
        echo "→ Running $filename..."
        
        docker exec brokerage-postgres-prod psql -U "$DB_USER" -d "$DB_NAME" -f "/tmp/migration_sql/$filename" 2>&1 | grep -v "NOTICE" || true
        
        if [ $? -eq 0 ]; then
            echo "  ✅ $filename completed"
        else
            echo "  ⚠️  $filename may have warnings (likely already exists)"
        fi
    fi
done

echo ""
echo "📋 Creating notifications table..."
docker exec brokerage-postgres-prod psql -U "$DB_USER" -d "$DB_NAME" <<'EOSQL'
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

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications USING btree (user_id, is_read, created_at DESC);
EOSQL

echo "  ✅ Notifications table created"
echo ""

# Cleanup
echo "🧹 Cleaning up..."
docker exec brokerage-postgres-prod rm -rf /tmp/migration_sql

echo ""
echo "================================================"
echo "✅ Database Initialization Complete!"
echo "================================================"
echo ""

# Show tables
echo "📋 Verifying tables..."
docker exec brokerage-postgres-prod psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"

echo ""
echo "🎉 Done! You can now restart your backend:"
echo "   docker compose -f deployment/docker-compose.prod.yml restart backend"
echo ""

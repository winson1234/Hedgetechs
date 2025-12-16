#!/bin/bash
set -e

echo "================================================"
echo "🚀 Starting Database Initialization"
echo "================================================"
echo ""
echo "Database: $POSTGRES_DB"
echo "User: $POSTGRES_USER"
echo ""

# List available migration files for debugging
echo "📁 Available migration files:"
ls -la /docker-entrypoint-initdb.d/migrations/ 2>/dev/null || echo "❌ Migration directory not found!"
echo ""

# Run all migration files in order
echo "📦 Running migrations..."
for migration_file in /docker-entrypoint-initdb.d/migrations/0*.sql; do
    if [ -f "$migration_file" ]; then
        filename=$(basename "$migration_file")
        echo "→ Running $filename..."
        
        if psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$migration_file"; then
            echo "  ✅ $filename completed successfully"
        else
            echo "  ❌ $filename failed"
            exit 1
        fi
    else
        echo "⚠️  No migration files found in /docker-entrypoint-initdb.d/migrations/"
        break
    fi
done

echo ""
echo "→ Creating notifications table..."
if psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
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
then
    echo "  ✅ Notifications table created"
else
    echo "  ❌ Notifications table creation failed"
    exit 1
fi

echo ""
echo "================================================"
echo "✅ Database Initialization Complete!"
echo "================================================"
echo ""

# Show created tables
echo "📋 Created tables:"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"

echo ""
echo "📊 Table counts:"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "
SELECT 
    schemaname || '.' || tablename AS table_name,
    n_live_tup AS row_count
FROM pg_stat_user_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"

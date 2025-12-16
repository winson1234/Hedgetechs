#!/bin/bash
set -e

echo "🚀 Initializing database schema..."

# Run all migration files in order
for i in $(seq -w 1 17); do
    migration_file="/docker-entrypoint-initdb.d/migrations/${i#0}_*.sql"
    
    # Find the actual file
    actual_file=$(ls $migration_file 2>/dev/null | head -1)
    
    if [ -f "$actual_file" ]; then
        echo "→ Running $(basename "$actual_file")..."
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$actual_file"
        echo "  ✅ Success"
    fi
done

# Create notifications table
echo "→ Creating notifications table..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
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
echo "✅ Database initialization complete!"
echo ""

# Show created tables
echo "📋 Created tables:"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "\dt"

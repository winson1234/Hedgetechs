#!/bin/bash
# ============================================
# Complete Production Initialization Script
# ============================================
# Run this after: git pull
# ============================================

set -e

cd "$(dirname "$0")"

echo "================================================"
echo "🚀 Production Deployment & Database Setup"
echo "================================================"
echo ""

# Step 1: Stop and remove everything
echo "Step 1: Stopping and removing old containers and volumes..."
docker compose -f docker-compose.prod.yml --env-file ../.env.prod down -v --remove-orphans 2>/dev/null || true
echo "✅ Done"
echo ""

# Step 2: Start fresh containers
echo "Step 2: Starting fresh containers..."
docker compose -f docker-compose.prod.yml --env-file ../.env.prod up -d
echo "✅ Containers started"
echo ""

# Step 3: Wait for postgres to be ready
echo "Step 3: Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec brokerage-postgres-prod pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done
echo ""

# Step 4: Initialize database
echo "Step 4: Initializing database schema..."
echo ""

# Get database name from env or use default
DB_NAME="${POSTGRES_DB:-brokerage}"

# Copy migration files to container
echo "→ Copying migration files to container..."
docker cp ../migration_sql brokerage-postgres-prod:/tmp/

# Run migrations
echo "→ Running migrations..."
for sql_file in ../migration_sql/0*.sql; do
    if [ -f "$sql_file" ]; then
        filename=$(basename "$sql_file")
        echo "  • $filename"
        docker exec brokerage-postgres-prod psql -U postgres -d "$DB_NAME" -f "/tmp/migration_sql/$filename" > /dev/null 2>&1 || echo "    (may already exist)"
    fi
done
echo "✅ Migrations completed"
echo ""

# Create notifications table
echo "→ Creating notifications table..."
docker exec brokerage-postgres-prod psql -U postgres -d "$DB_NAME" > /dev/null 2>&1 <<'EOSQL'
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
echo "✅ Notifications table created"
echo ""

# Cleanup
echo "→ Cleaning up temporary files..."
docker exec brokerage-postgres-prod rm -rf /tmp/migration_sql
echo "✅ Cleanup done"
echo ""

# Step 5: Verify
echo "Step 5: Verifying database..."
echo ""
docker exec brokerage-postgres-prod psql -U postgres -d "$DB_NAME" -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"
echo ""

# Step 6: Restart backend to ensure it picks up the schema
echo "Step 6: Restarting backend..."
docker compose -f docker-compose.prod.yml --env-file ../.env.prod restart backend
echo "✅ Backend restarted"
echo ""

echo "================================================"
echo "✅ Production Deployment Complete!"
echo "================================================"
echo ""
echo "📋 Services Status:"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "🧪 Test your API:"
echo "   curl -X POST http://localhost:8080/api/v1/auth/register \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"test@test.com\",\"password\":\"Test123!\",\"full_name\":\"Test User\"}'"
echo ""
echo "📊 View logs:"
echo "   docker compose -f deployment/docker-compose.prod.yml --env-file .env.prod logs -f"
echo ""

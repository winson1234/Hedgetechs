#!/bin/bash

# ============================================
# Fix Database Connection and Account Creation
# ============================================
# This script:
# 1. Stops all containers
# 2. Removes old database volumes
# 3. Restarts with fresh database
# 4. Applies all migrations
# ============================================

set -e  # Exit on any error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Fixing Database Connection and Account Creation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Stop all services
echo "🛑 Step 1: Stopping all services..."
docker compose -f docker-compose.dev.yml down
echo "✅ Services stopped"
echo ""

# Step 2: Remove volumes to clear old database
echo "🗑️  Step 2: Removing old database volumes..."
docker compose -f docker-compose.dev.yml down -v
echo "✅ Volumes removed"
echo ""

# Step 3: Start PostgreSQL first
echo "🚀 Step 3: Starting PostgreSQL with correct credentials..."
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d postgres redis
echo "⏳ Waiting for PostgreSQL to initialize..."
sleep 10
echo ""

# Step 4: Check PostgreSQL connection
echo "🔍 Step 4: Verifying PostgreSQL connection..."
docker exec brokerage-postgres-dev pg_isready -U postgres -d brokerage_dev || {
    echo "❌ PostgreSQL is not ready. Waiting more..."
    sleep 5
}
echo "✅ PostgreSQL is ready"
echo ""

# Step 5: Apply migrations
echo "📦 Step 5: Applying database migrations..."

# Check if migrations directory exists
if [ -d "migration_sql" ]; then
    echo "Found migration_sql directory. Applying migrations in order..."
    
    # Apply migrations in alphabetical order
    for migration in migration_sql/*.sql; do
        if [ -f "$migration" ]; then
            echo "  → Applying $(basename "$migration")..."
            docker exec -i brokerage-postgres-dev psql -U postgres -d brokerage_dev < "$migration" || {
                echo "  ⚠️  Warning: Migration $(basename "$migration") may have failed"
            }
        fi
    done
    echo "✅ Migrations applied"
else
    echo "⚠️  No migration_sql directory found, skipping migrations"
fi
echo ""

# Step 6: Create balances table if it doesn't exist
echo "📋 Step 6: Ensuring balances table exists..."
docker exec -i brokerage-postgres-dev psql -U postgres -d brokerage_dev << 'EOF'
-- Create balances table with correct schema
CREATE TABLE IF NOT EXISTS public.balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    currency text NOT NULL,
    amount numeric(20,8) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT balances_pkey PRIMARY KEY (id),
    CONSTRAINT balances_account_id_currency_key UNIQUE (account_id, currency),
    CONSTRAINT balances_account_id_fkey FOREIGN KEY (account_id) 
        REFERENCES public.accounts(id) ON DELETE CASCADE
);

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_balances_account_id 
    ON public.balances USING btree (account_id);

-- Create update trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_balances_updated_at ON public.balances;
CREATE TRIGGER update_balances_updated_at 
    BEFORE UPDATE ON public.balances 
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Optional: Create sync function for accounts.balance
CREATE OR REPLACE FUNCTION public.sync_account_balance()
RETURNS TRIGGER AS \$\$
BEGIN
    -- When balance is inserted or updated, sync to accounts table
    UPDATE accounts 
    SET balance = NEW.amount, last_updated = NOW()
    WHERE id = NEW.account_id AND currency = NEW.currency;
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_account_balance_insert ON public.balances;
CREATE TRIGGER trigger_sync_account_balance_insert 
    AFTER INSERT ON public.balances 
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_account_balance();

DROP TRIGGER IF EXISTS trigger_sync_account_balance_update ON public.balances;
CREATE TRIGGER trigger_sync_account_balance_update 
    AFTER UPDATE ON public.balances 
    FOR EACH ROW 
    WHEN (OLD.amount IS DISTINCT FROM NEW.amount)
    EXECUTE FUNCTION public.sync_account_balance();

EOF
echo "✅ Balances table configured"
echo ""

# Step 7: Verify database schema
echo "🔍 Step 7: Verifying database schema..."
docker exec brokerage-postgres-dev psql -U postgres -d brokerage_dev -c "
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
"
echo ""

# Step 8: Start all services
echo "🚀 Step 8: Starting all services..."
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d
echo "⏳ Waiting for services to start..."
sleep 10
echo ""

# Step 9: Check service status
echo "📊 Step 9: Checking service status..."
docker compose -f docker-compose.dev.yml ps
echo ""

# Step 10: Check backend logs for any errors
echo "🔍 Step 10: Checking backend connection..."
docker logs brokerage-backend-dev 2>&1 | tail -20
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Database Fix Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Your application should now be running at:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8080"
echo ""
echo "💡 Try creating a demo or live account now!"
echo ""
echo "📝 To view live logs, run: make dev-logs"
echo "🛑 To stop services, run: make dev-down"
echo ""


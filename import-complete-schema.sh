#!/bin/bash

echo "===================================="
echo "Importing Complete Schema from SQL Files"
echo "===================================="

# Step 1: Create Supabase roles and schemas
echo
echo "[1/3] Creating Supabase roles and schemas..."

docker exec brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev -c "CREATE ROLE authenticated NOLOGIN;" 2>/dev/null
docker exec brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev -c "CREATE ROLE anon NOLOGIN;" 2>/dev/null
docker exec brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev -c "CREATE ROLE service_role NOLOGIN;" 2>/dev/null
docker exec brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev -c "CREATE SCHEMA IF NOT EXISTS auth;" 2>/dev/null
docker exec brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev -c "CREATE SCHEMA IF NOT EXISTS storage;" 2>/dev/null

echo "Done (errors ignored if roles already exist)"

# Step 2: Import all SQL files in order
echo
echo "[2/3] Importing SQL files..."

FILES=(
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
"018_remove_crypto_instruments.sql"
"019_fix_approved_deposits.sql"
"020_fix_orders_schema.sql"
"021_add_pair_id_to_orders.sql"
"022_add_user_type.sql"
)

COUNT=1
TOTAL=${#FILES[@]}

for FILE in "${FILES[@]}"
do
  echo "  [$COUNT/$TOTAL] $FILE"

  docker exec -i brokerage-postgres-dev psql \
    -U postgres_hedgetechs \
    -d brokerage_hedgetechs_dev < "migration_sql/$FILE"

  if [ $? -ne 0 ]; then
    echo "  ERROR!"
  else
    echo "  OK"
  fi

  ((COUNT++))
done

# Step 3: Verify import
echo
echo "[3/3] Verifying import..."
echo
echo "Tables created:"

docker exec brokerage-postgres-dev psql \
  -U postgres_hedgetechs \
  -d brokerage_hedgetechs_dev \
  -c "\dt"

echo
echo "Row counts:"

docker exec brokerage-postgres-dev psql \
  -U postgres_hedgetechs \
  -d brokerage_hedgetechs_dev \
  -c "SELECT schemaname || '.' || relname AS table_name, n_live_tup AS row_count FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname;"

echo
echo "===================================="
echo "Import Complete!"
echo "===================================="

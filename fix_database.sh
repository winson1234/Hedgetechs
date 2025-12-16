#!/bin/bash
# Fix database functions for deposits and transactions

set -e

DB_CONTAINER="brokerage-postgres-dev"
DB_USER="postgres"
DB_NAME="brokerage_dev"

echo "========================================"
echo "Fixing Database Functions"
echo "========================================"
echo ""

# Check if container is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo "❌ Error: Container '$DB_CONTAINER' is not running"
    echo "Please start your Docker containers first:"
    echo "  docker-compose -f docker-compose.dev.yml up -d"
    exit 1
fi

echo "✓ Container '$DB_CONTAINER' is running"
echo ""

# Run the fix scripts
echo "Applying database fixes..."
echo ""

echo "[1/2] Fixing database functions..."
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < fix_database_functions.sql

if [ $? -ne 0 ]; then
    echo "❌ Failed to fix database functions"
    exit 1
fi

echo ""
echo "[2/2] Fixing deposits table schema..."
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < fix_deposits_schema.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "✓ Database functions fixed successfully!"
    echo "========================================"
    echo ""
    echo "You can now try your deposit again."
else
    echo ""
    echo "========================================"
    echo "❌ Error fixing database functions"
    echo "========================================"
    exit 1
fi


#!/bin/bash
# Initialize PostgreSQL database with all schema files

set -e

DB_CONTAINER="brokerage-postgres-dev"
DB_USER="postgres"
DB_NAME="brokerage_dev"

echo "Initializing database schema..."

# Run each migration SQL file in order
for sql_file in migration_sql/*.sql; do
    if [ -f "$sql_file" ]; then
        echo "Running: $sql_file"
        docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$sql_file"
        if [ $? -eq 0 ]; then
            echo "✓ Successfully executed: $sql_file"
        else
            echo "✗ Error executing: $sql_file"
            exit 1
        fi
    fi
done

echo ""
echo "Database initialization complete!"
echo "Checking created tables..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "\dt"


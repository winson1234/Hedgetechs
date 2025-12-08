@echo off
echo ====================================
echo Importing Complete Schema from SQL Files
echo ====================================

REM Step 1: Create Supabase roles and schemas
echo.
echo [1/3] Creating Supabase roles and schemas...
docker exec -it brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev -c "CREATE ROLE authenticated NOLOGIN;" 2>nul
docker exec -it brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev -c "CREATE ROLE anon NOLOGIN;" 2>nul
docker exec -it brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev -c "CREATE ROLE service_role NOLOGIN;" 2>nul
docker exec -it brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev -c "CREATE SCHEMA IF NOT EXISTS auth;" 2>nul
docker exec -it brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev -c "CREATE SCHEMA IF NOT EXISTS storage;" 2>nul
echo Done (errors ignored if roles already exist)

REM Step 2: Import all SQL files in order
echo.
echo [2/3] Importing SQL files...

echo   [1/12] 001_users.sql
docker exec -i brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev < migration_sql\001_users.sql
if %ERRORLEVEL% NEQ 0 (echo   ERROR!) else (echo   OK)

echo   [2/12] 002_admins.sql
docker exec -i brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev < migration_sql\002_admins.sql
if %ERRORLEVEL% NEQ 0 (echo   ERROR!) else (echo   OK)

echo   [3/12] 003_accounts.sql
docker exec -i brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev < migration_sql\003_accounts.sql
if %ERRORLEVEL% NEQ 0 (echo   ERROR!) else (echo   OK)

echo   [4/12] 004_instruments.sql
docker exec -i brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev < migration_sql\004_instruments.sql
if %ERRORLEVEL% NEQ 0 (echo   ERROR!) else (echo   OK)

echo   [5/12] 005_pending_registrations.sql
docker exec -i brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev < migration_sql\005_pending_registrations.sql
if %ERRORLEVEL% NEQ 0 (echo   ERROR!) else (echo   OK)

echo   [6/12] 006_forex_configurations.sql
docker exec -i brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev < migration_sql\006_forex_configurations.sql
if %ERRORLEVEL% NEQ 0 (echo   ERROR!) else (echo   OK)

echo   [7/12] 007_spot_configurations.sql
docker exec -i brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev < migration_sql\007_spot_configurations.sql
if %ERRORLEVEL% NEQ 0 (echo   ERROR!) else (echo   OK)

echo   [8/12] 008_pending_orders.sql
docker exec -i brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev < migration_sql\008_pending_orders.sql
if %ERRORLEVEL% NEQ 0 (echo   ERROR!) else (echo   OK)

echo   [9/12] 009_contracts.sql
docker exec -i brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev < migration_sql\009_contracts.sql
if %ERRORLEVEL% NEQ 0 (echo   ERROR!) else (echo   OK)

echo   [10/12] 010_orders.sql
docker exec -i brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev < migration_sql\010_orders.sql
if %ERRORLEVEL% NEQ 0 (echo   ERROR!) else (echo   OK)

echo   [11/12] 011_transactions.sql
docker exec -i brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev < migration_sql\011_transactions.sql
if %ERRORLEVEL% NEQ 0 (echo   ERROR!) else (echo   OK)

echo   [12/12] 012_forex_klines_1m.sql
docker exec -i brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev < migration_sql\012_forex_klines_1m.sql
if %ERRORLEVEL% NEQ 0 (echo   ERROR!) else (echo   OK)

REM Step 3: Verify import
echo.
echo [3/3] Verifying import...
echo.
echo Tables created:
docker exec -it brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev -c "\dt"

echo.
echo Row counts:
docker exec -it brokerage-postgres-dev psql -U postgres_hedgetechs -d brokerage_hedgetechs_dev -c "SELECT schemaname || '.' || relname AS table_name, n_live_tup AS row_count FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY relname;"

echo.
echo ====================================
echo Import Complete!
echo ====================================
pause
# Database Documentation

## Overview

PostgreSQL database hosted on Supabase providing persistent storage for trading accounts, orders, positions, contracts, and audit logs.

**Database:** PostgreSQL 15 (Supabase)
**Driver:** pgx (Go PostgreSQL driver)
**Migrations:** golang-migrate
**Connection:** Session Pooler (port 5432) for IPv4 compatibility

---

## Architecture

```
Application Layer (Go Backend)
    ↓
pgx Connection Pool (25 max connections, 5min idle timeout)
    ↓
Supabase Session Pooler (IPv4 compatible)
    ↓
PostgreSQL Database (Supabase)
    ├─ accounts (trading accounts + balances)
    ├─ contracts (open CFD positions)
    ├─ orders (executed orders)
    ├─ pending_orders (limit/stop orders)
    ├─ audit_logs (compliance logging)
    ├─ lp_routes (A-Book routing configuration)
    └─ reconciliation_queue (LP order reconciliation)
```

---

## Connection Configuration

### pgx Connection Pool

Located in `internal/database/database.go`:

```go
config, _ := pgxpool.ParseConfig(databaseURL)
config.MaxConns = 25                      // Maximum connections
config.MinConns = 5                       // Minimum idle connections
config.MaxConnLifetime = 1 * time.Hour    // Connection lifetime
config.MaxConnIdleTime = 5 * time.Minute  // Idle connection timeout
```

### Supabase Session Pooler

**Why Session Pooler:**
- IPv4 compatibility (Direct connection requires IPv6)
- Connection pooling at database level
- Lower latency for frequent queries

**Two Modes:**

1. **Transaction Mode (Port 6543)** - For application queries
   - Used with `?pgbouncer=true` parameter
   - Optimized for short transactions
   - Use for: Regular application queries
   ```
   DATABASE_URL=postgresql://postgres.project:password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

2. **Session Mode (Port 5432)** - For migrations and long sessions
   - Holds connection for entire session
   - Supports prepared statements, locks, schema changes
   - Use for: Database migrations
   ```
   DATABASE_MIGRATION_URL=postgresql://postgres.project:password@aws-0-region.pooler.supabase.com:5432/postgres
   ```

**Not:**
```
postgresql://postgres:password@db.project.supabase.co:5432/postgres  # Direct (IPv6 only)
```

---

## Database Schema

### accounts

Stores trading accounts with balances and metadata.

**Columns:**
- `id` (UUID, PK) - Unique account identifier
- `user_id` (UUID, FK) - Reference to Supabase auth.users
- `name` (TEXT) - Account name (e.g., "Live Account", "Demo Account")
- `account_type` (TEXT) - Account type: `live`, `demo`, `external`
- `currency` (TEXT) - Account currency: `USD`, `EUR`, `MYR`, `JPY`
- `balance` (DECIMAL) - Current account balance
- `equity` (DECIMAL) - Account equity (balance + unrealized P/L)
- `margin` (DECIMAL) - Used margin for open positions
- `free_margin` (DECIMAL) - Available margin (equity - margin)
- `margin_level` (DECIMAL) - Margin level percentage (equity / margin * 100)
- `created_at` (TIMESTAMP) - Account creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Indexes:**
- `idx_accounts_user_id` on `user_id`

**Usage:**
- Multi-account support (users can have multiple accounts)
- Real-time margin level monitoring
- Balance updates on deposits, withdrawals, and trade execution

---

### contracts

Stores open CFD positions with leverage and margin tracking.

**Columns:**
- `id` (UUID, PK) - Unique contract identifier
- `account_id` (UUID, FK) - Reference to accounts table
- `symbol` (TEXT) - Trading pair (e.g., `EURUSD`, `BTCUSDT`)
- `product_type` (TEXT) - Product type: `spot` or `cfd`
- `position_type` (TEXT) - Position direction: `buy` or `sell`
- `pair_id` (UUID, NULLABLE) - For dual-position hedging (links buy and sell positions)
- `quantity` (DECIMAL) - Position size
- `entry_price` (DECIMAL) - Position entry price
- `current_price` (DECIMAL) - Latest market price
- `leverage` (INTEGER) - Position leverage (1x to 500x)
- `margin` (DECIMAL) - Margin requirement for position
- `unrealized_pnl` (DECIMAL) - Unrealized profit/loss
- `stop_loss` (DECIMAL, NULLABLE) - Stop loss price
- `take_profit` (DECIMAL, NULLABLE) - Take profit price
- `execution_strategy` (TEXT) - Execution: `a_book` (LP routing) or `b_book` (internal)
- `status` (TEXT) - Contract status: `open`, `closed`, `liquidated`
- `opened_at` (TIMESTAMP) - Position open timestamp
- `closed_at` (TIMESTAMP, NULLABLE) - Position close timestamp

**Indexes:**
- `idx_contracts_account_id` on `account_id`
- `idx_contracts_pair_id` on `pair_id`
- `idx_contracts_status` on `status`

**Usage:**
- CFD position tracking with real-time P/L
- Dual-position hedging support (same symbol, opposite directions)
- Margin requirement calculations
- Automatic liquidation when margin level < threshold

---

### orders

Stores executed orders (market, limit, stop-limit).

**Columns:**
- `id` (UUID, PK) - Unique order identifier
- `account_id` (UUID, FK) - Reference to accounts table
- `symbol` (TEXT) - Trading pair
- `product_type` (TEXT) - Product type: `spot` or `cfd`
- `order_type` (TEXT) - Order type: `market`, `limit`, `stop_limit`
- `side` (TEXT) - Order side: `buy` or `sell`
- `quantity` (DECIMAL) - Order quantity
- `price` (DECIMAL) - Execution price
- `total` (DECIMAL) - Total order value (quantity * price)
- `fee` (DECIMAL) - Trading fee (0.1%)
- `leverage` (INTEGER, NULLABLE) - Leverage used (CFD only)
- `execution_strategy` (TEXT) - Execution: `a_book` or `b_book`
- `executed_at` (TIMESTAMP) - Order execution timestamp
- `created_at` (TIMESTAMP) - Order creation timestamp

**Indexes:**
- `idx_orders_account_id` on `account_id`
- `idx_orders_executed_at` on `executed_at`

**Usage:**
- Order history tracking
- Trading fee calculations
- Performance analytics
- Audit trail for compliance

---

### pending_orders

Stores pending limit and stop-limit orders waiting for trigger conditions.

**Columns:**
- `id` (UUID, PK) - Unique pending order identifier
- `account_id` (UUID, FK) - Reference to accounts table
- `symbol` (TEXT) - Trading pair
- `product_type` (TEXT) - Product type: `spot` or `cfd`
- `order_type` (TEXT) - Order type: `limit` or `stop_limit`
- `side` (TEXT) - Order side: `buy` or `sell`
- `quantity` (DECIMAL) - Order quantity
- `trigger_price` (DECIMAL) - Price that triggers order execution
- `leverage` (INTEGER, NULLABLE) - Leverage to use (CFD only)
- `execution_strategy` (TEXT) - Execution: `a_book` or `b_book`
- `status` (TEXT) - Order status: `pending`, `triggered`, `cancelled`
- `created_at` (TIMESTAMP) - Order creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Indexes:**
- `idx_pending_orders_account_id` on `account_id`
- `idx_pending_orders_status` on `status`
- `idx_pending_orders_symbol` on `symbol`

**Usage:**
- Order processor monitors this table for trigger conditions
- When price meets condition:
  - Order executed and moved to `orders` table
  - If CFD: Creates entry in `contracts` table
  - Removes from `pending_orders` table
- Supports cancellation by user

---

### audit_logs

Immutable audit trail for compliance and debugging.

**Columns:**
- `id` (UUID, PK) - Unique log identifier
- `user_id` (UUID, NULLABLE) - User who performed action
- `account_id` (UUID, NULLABLE) - Account affected
- `action` (TEXT) - Action performed (e.g., `order_created`, `position_closed`)
- `entity_type` (TEXT) - Entity type: `account`, `order`, `contract`
- `entity_id` (UUID, NULLABLE) - Entity identifier
- `details` (JSONB) - Additional details (flexible JSON structure)
- `ip_address` (TEXT, NULLABLE) - User IP address
- `user_agent` (TEXT, NULLABLE) - User agent string
- `created_at` (TIMESTAMP) - Log creation timestamp

**Indexes:**
- `idx_audit_logs_user_id` on `user_id`
- `idx_audit_logs_action` on `action`
- `idx_audit_logs_created_at` on `created_at`

**Usage:**
- Compliance auditing
- Security monitoring
- Debugging user issues
- Regulatory reporting

---

### lp_routes

Configuration for A-Book LP (Liquidity Provider) routing.

**Columns:**
- `id` (UUID, PK) - Unique route identifier
- `symbol` (TEXT) - Trading pair
- `lp_name` (TEXT) - LP provider name (e.g., "LMAX", "Currenex")
- `lp_endpoint` (TEXT) - LP API endpoint
- `enabled` (BOOLEAN) - Route enabled/disabled
- `priority` (INTEGER) - Routing priority (lower = higher priority)
- `created_at` (TIMESTAMP) - Route creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Indexes:**
- `idx_lp_routes_symbol` on `symbol`
- `idx_lp_routes_enabled` on `enabled`

**Usage:**
- A-Book execution strategy routes orders to external LPs
- Supports multiple LPs per symbol with priority-based routing
- Enables/disables LP routing without code changes

---

### reconciliation_queue

Queue for reconciling A-Book orders with LP confirmations.

**Columns:**
- `id` (UUID, PK) - Unique queue entry identifier
- `order_id` (UUID, FK) - Reference to orders table
- `lp_name` (TEXT) - LP provider name
- `lp_order_id` (TEXT) - LP's order identifier
- `status` (TEXT) - Status: `pending`, `confirmed`, `rejected`, `timeout`
- `retry_count` (INTEGER) - Number of retry attempts
- `last_retry_at` (TIMESTAMP, NULLABLE) - Last retry timestamp
- `error_message` (TEXT, NULLABLE) - Error details if failed
- `created_at` (TIMESTAMP) - Queue entry creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

**Indexes:**
- `idx_reconciliation_queue_status` on `status`
- `idx_reconciliation_queue_created_at` on `created_at`

**Usage:**
- Background worker reconciles A-Book orders with LP confirmations
- Retry mechanism for failed confirmations
- Timeout handling for unresponsive LPs

---

## SQL Scripts Organization

The database schema is organized into modular SQL files under `sql-scripts/` for better maintainability and development workflow.

### Directory Structure

```
sql-scripts/
├── migrations/          # Version-controlled migrations (golang-migrate)
├── schema/
│   ├── extensions/      # PostgreSQL extensions
│   ├── sequences/       # ID sequence generators
│   ├── tables/          # Individual table definitions (20+ files)
│   └── types/           # ENUM type definitions (15+ files)
├── functions/           # Stored procedures and functions
├── triggers/            # Database triggers
├── seed/                # Initial data population
├── indexes/             # Performance optimization indexes
└── views/               # Database views
```

### migrations/

**Purpose:** Version-controlled migrations using golang-migrate

**Contents:** 15 migrations (30 files total: `.up.sql` and `.down.sql` pairs)

**Usage:**
```bash
# Apply all pending migrations (use DATABASE_MIGRATION_URL for session mode)
migrate -path sql-scripts/migrations -database $DATABASE_MIGRATION_URL up

# Rollback last migration
migrate -path sql-scripts/migrations -database $DATABASE_MIGRATION_URL down 1

# Check current version
migrate -path sql-scripts/migrations -database $DATABASE_MIGRATION_URL version

# Force version (if dirty state)
migrate -path sql-scripts/migrations -database $DATABASE_MIGRATION_URL force VERSION
```

**Important:** Always use `DATABASE_MIGRATION_URL` (session pooler on port 5432) for migrations, not `DATABASE_URL` (transaction pooler with `?pgbouncer=true`).

**Best Practices:**
- Always provide both `.up.sql` and `.down.sql` files
- Test migrations locally before applying to production
- Use transactions for complex migrations
- Never modify existing migration files (create new ones instead)
- Keep migrations small and focused

### schema/tables/

**Purpose:** Individual table definitions for easy drop/recreate during development

**Contents:** 20 table files (accounts.sql, contracts.sql, orders.sql, etc.)

**Usage:**
```bash
# Drop and recreate a single table
psql $DATABASE_URL -c "DROP TABLE IF EXISTS orders CASCADE;"
psql $DATABASE_URL -f sql-scripts/schema/tables/orders.sql

# Create all tables (fresh database)
for file in sql-scripts/schema/tables/*.sql; do
  psql $DATABASE_URL -f "$file"
done
```

**Files:**
- `accounts.sql` - Trading accounts with balances
- `contracts.sql` - Open CFD positions
- `orders.sql` - Executed orders history
- `pending_orders.sql` - Limit/stop-limit orders waiting execution
- `transactions.sql` - Deposit/withdrawal/transfer history
- `audit_logs.sql` - Compliance and security audit trail
- `lp_routes.sql` - A-Book LP routing configuration
- `reconciliation_queue.sql` - LP order reconciliation queue
- `instruments.sql` - Tradeable symbols (crypto, forex, commodities)
- `kyc_documents.sql` - KYC verification documents
- `users.sql` - User account information
- `balances.sql` - Account balance tracking
- `admins.sql` - Admin users
- `pending_registrations.sql` - Registration approval queue
- `forex_configurations.sql` - Forex pair configurations
- `spot_configurations.sql` - Spot market configurations
- `lp_routing_config.sql` - LP routing rules
- `order_history.sql` - Historical order data
- `forex_klines_1m.sql` - Partitioned forex 1-minute candle data
- `partition_archive_log.sql` - Partition management log

### schema/types/

**Purpose:** ENUM type definitions for type safety and data validation

**Contents:** 15 ENUM type files

**Usage:**
```bash
# Create all types (must be created before tables)
for file in sql-scripts/schema/types/*.sql; do
  psql $DATABASE_URL -f "$file"
done
```

**Files:**
- `account_type_enum.sql` - live, demo
- `account_status_enum.sql` - active, deactivated
- `admin_role_enum.sql` - superadmin, admin, support, developer
- `contract_side.sql` - long, short
- `contract_status.sql` - open, closed, liquidated
- `execution_strategy.sql` - b_book, a_book
- `kyc_document_type.sql` - passport, drivers_license, national_id, proof_of_address, selfie
- `kyc_status_enum.sql` - pending, approved, rejected
- `order_execution_type.sql` - limit, stop_limit
- `order_side.sql` - buy, sell
- `order_status.sql` - pending, filled, partially_filled, cancelled, rejected
- `order_type.sql` - market, limit, stop, stop_limit
- `pending_order_status.sql` - pending, executed, cancelled, expired, failed
- `product_type.sql` - spot, cfd, futures
- `registration_status_enum.sql` - pending, approved, rejected
- `transaction_status.sql` - pending, completed, failed
- `transaction_type.sql` - deposit, withdrawal, transfer, position_close

### schema/sequences/

**Purpose:** ID sequence generators for readable display numbers

**Contents:** 3 sequence group files

**Files:**
- `account_sequences.sql` - Account number sequences (live: 1000000-4999999, demo: 5000000-9999999)
- `trading_sequences.sql` - Order, contract, transaction number sequences
- `system_sequences.sql` - User ID, admin ID, and system sequences

**Usage:**
```bash
psql $DATABASE_URL -f sql-scripts/schema/sequences/account_sequences.sql
psql $DATABASE_URL -f sql-scripts/schema/sequences/trading_sequences.sql
psql $DATABASE_URL -f sql-scripts/schema/sequences/system_sequences.sql
```

### schema/extensions/

**Purpose:** PostgreSQL extensions required by the application

**Contents:** `uuid-ossp.sql` - UUID generation functions

**Usage:**
```bash
psql $DATABASE_URL -f sql-scripts/schema/extensions/uuid-ossp.sql
```

### functions/

**Purpose:** Reusable SQL functions for business logic

**Contents:** 6 function files

**Files:**
- `generate_account_number.sql` - Generates account display numbers (ACC-#######)
- `generate_order_number.sql` - Generates order numbers (ORD-########)
- `generate_contract_number.sql` - Generates contract numbers (CNT-#####)
- `generate_transaction_number.sql` - Generates transaction numbers (TXN-#####)
- `log_audit_event.sql` - Logs events to audit_logs table
- `update_updated_at_column.sql` - Trigger function for timestamp updates

**Usage:**
```bash
# Create all functions
for file in sql-scripts/functions/*.sql; do
  psql $DATABASE_URL -f "$file"
done
```

### triggers/

**Purpose:** Database triggers for automatic operations

**Contents:** 4 trigger files

**Files:**
- `handle_new_user.sql` - Auto-create public.users from auth.users (Supabase Auth)
- `handle_user_delete.sql` - Auto-delete auth.users when public.users deleted
- `handle_auth_user_delete.sql` - Auto-delete public.users when auth.users deleted
- `update_timestamps.sql` - Auto-update updated_at columns on table changes

**Usage:**
```bash
for file in sql-scripts/triggers/*.sql; do
  psql $DATABASE_URL -f "$file"
done
```

### seed/

**Purpose:** Initial data population for testing and development

**Contents:** 2 seed data files

**Files:**
- `crypto_instruments.sql` - 23 cryptocurrency pairs (BTCUSDT, ETHUSDT, etc.)
- `forex_instruments.sql` - 12 major forex pairs (EURUSD, GBPUSD, etc.)

**Usage:**
```bash
psql $DATABASE_URL -f sql-scripts/seed/crypto_instruments.sql
psql $DATABASE_URL -f sql-scripts/seed/forex_instruments.sql
```

### indexes/

**Purpose:** Performance optimization indexes for frequently queried tables

**Contents:** `performance_indexes.sql` - Indexes for contracts, pending_orders, orders, transactions

**Usage:**
```bash
psql $DATABASE_URL -f sql-scripts/indexes/performance_indexes.sql
```

### views/

**Purpose:** Database views for aggregated data and reporting

**Contents:** `account_stats.sql` - Aggregated account statistics view

**Usage:**
```bash
psql $DATABASE_URL -f sql-scripts/views/account_stats.sql
```

### Complete Setup Example

**For a fresh database:**
```bash
# 1. Create extensions
psql $DATABASE_URL -f sql-scripts/schema/extensions/uuid-ossp.sql

# 2. Create types (must be before tables)
for file in sql-scripts/schema/types/*.sql; do psql $DATABASE_URL -f "$file"; done

# 3. Create sequences
for file in sql-scripts/schema/sequences/*.sql; do psql $DATABASE_URL -f "$file"; done

# 4. Create tables
for file in sql-scripts/schema/tables/*.sql; do psql $DATABASE_URL -f "$file"; done

# 5. Create functions
for file in sql-scripts/functions/*.sql; do psql $DATABASE_URL -f "$file"; done

# 6. Create triggers
for file in sql-scripts/triggers/*.sql; do psql $DATABASE_URL -f "$file"; done

# 7. Create indexes
psql $DATABASE_URL -f sql-scripts/indexes/performance_indexes.sql

# 8. Create views
psql $DATABASE_URL -f sql-scripts/views/account_stats.sql

# 9. Seed initial data
for file in sql-scripts/seed/*.sql; do psql $DATABASE_URL -f "$file"; done
```

**For production (use migrations):**
```bash
migrate -path sql-scripts/migrations -database $DATABASE_URL up
```

---

## Key Columns Explained

### product_type

Determines how the order/position is handled:

- **`spot`**: Traditional buy/hold asset ownership. User owns the asset, no leverage.
- **`cfd`**: Contract for Difference. User speculates on price movement with leverage, doesn't own underlying asset.

### execution_strategy

Determines order routing:

- **`a_book`**: Routed to external LP (Liquidity Provider). Platform acts as intermediary, earns commission. Lower risk for platform.
- **`b_book`**: Handled internally (platform is counterparty). Platform profits from user losses, loses when user profits. Higher risk, higher reward.

### pair_id

Enables dual-position hedging:

- User can have both a BUY and SELL position for the same symbol simultaneously
- Positions linked by `pair_id` UUID
- Allows complex trading strategies (e.g., hedging, arbitrage)

### leverage

Multiplier for position size:

- `1x` = No leverage (spot-like)
- `10x` = Control $10,000 worth with $1,000 margin
- `500x` = Control $500,000 worth with $1,000 margin (very high risk)

**Margin Requirement:**
```
Margin = (Quantity × Price) / Leverage
```

**Margin Level:**
```
Margin Level = (Equity / Margin) × 100
```

**Liquidation:**
- Typically occurs when margin level < 50%
- Automatic position closure to prevent negative balance

---

## Connection Examples

### From Go (pgx)

```go
import (
    "github.com/jackc/pgx/v5/pgxpool"
)

pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
if err != nil {
    log.Fatal(err)
}
defer pool.Close()

// Query example
var balance decimal.Decimal
err = pool.QueryRow(context.Background(),
    "SELECT balance FROM accounts WHERE id = $1", accountID).Scan(&balance)
```

### From Command Line (psql)

```bash
psql $DATABASE_URL -c "SELECT * FROM accounts LIMIT 5;"
```

### From Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Click "SQL Editor" in sidebar
4. Run queries directly

---

## Monitoring and Maintenance

### Connection Pool Monitoring

Check connection pool stats in application logs:
```
[Database] Acquired connections: 12/25
[Database] Idle connections: 5
```

### Query Performance

- Use `EXPLAIN ANALYZE` for slow queries
- Add indexes for frequently queried columns
- Monitor query execution time in logs

### Database Size

Check database size via Supabase Dashboard:
- Go to Database → Usage
- Monitor storage usage and connection count

### Backup and Recovery

Supabase provides automatic backups:
- Daily backups retained for 7 days (free tier)
- Point-in-time recovery (paid tiers)
- Manual backups via Database → Backups

---

## Security Best Practices

1. **Use Session Pooler:** Reduces attack surface, prevents connection exhaustion
2. **Parameterized Queries:** Always use `$1`, `$2` placeholders (pgx does this automatically)
3. **Row-Level Security (RLS):** Consider enabling RLS in Supabase for user data isolation
4. **Service Role Key:** Keep `SUPABASE_SERVICE_ROLE_KEY` secret, never expose to frontend
5. **Connection Limits:** Monitor and adjust `MaxConns` based on load
6. **Audit Logging:** All sensitive operations logged to `audit_logs` table

---

## Troubleshooting

### Connection Refused

**Symptoms:** `connection refused` or `timeout`

**Solutions:**
- Verify `DATABASE_URL` uses Session Pooler (port 5432)
- Check Supabase project is active (not paused)
- Verify network connectivity (firewall, VPN)
- Test connection: `psql $DATABASE_URL -c "SELECT 1;"`

### Too Many Connections

**Symptoms:** `sorry, too many clients already`

**Solutions:**
- Reduce `MaxConns` in pgx config
- Use Session Pooler (pools connections at database level)
- Close connections properly (`defer pool.Close()`)
- Check for connection leaks (connections not released)

### Migration Dirty State

**Symptoms:** `Dirty database version X. Fix and force version.`

**Solutions:**
```bash
# Check what migration failed
migrate -path sql-scripts/migrations -database $DATABASE_MIGRATION_URL version

# Manually fix the database issue (rollback partial changes)

# Force to previous version
migrate -path sql-scripts/migrations -database $DATABASE_MIGRATION_URL force X-1

# Re-run migrations
migrate -path sql-scripts/migrations -database $DATABASE_MIGRATION_URL up
```

### Slow Queries

**Symptoms:** High response times for database operations

**Solutions:**
- Add indexes to frequently queried columns
- Use `EXPLAIN ANALYZE` to identify bottlenecks
- Optimize JOIN operations
- Consider caching frequently accessed data in Redis
- Review connection pool settings

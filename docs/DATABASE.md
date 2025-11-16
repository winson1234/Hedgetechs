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

**Connection String Format:**
```
postgresql://postgres.project:password@aws-0-region.pooler.supabase.com:5432/postgres
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

## Migration Workflow

### golang-migrate

**Installation:**
```bash
# Windows
choco install golang-migrate

# Or download from GitHub releases
```

**Commands:**
```bash
# Apply all pending migrations
migrate -path internal/database/migrations -database $DATABASE_URL up

# Rollback last migration
migrate -path internal/database/migrations -database $DATABASE_URL down 1

# Check current version
migrate -path internal/database/migrations -database $DATABASE_URL version

# Force version (if dirty state)
migrate -path internal/database/migrations -database $DATABASE_URL force VERSION

# Create new migration
migrate create -ext sql -dir internal/database/migrations -seq add_new_table
```

### Migration Files

Located in `internal/database/migrations/`:

```
0001_create_accounts.up.sql      # Create accounts table
0001_create_accounts.down.sql    # Drop accounts table
0002_create_contracts.up.sql     # Create contracts table
0002_create_contracts.down.sql   # Drop contracts table
...
```

**Best Practices:**
- Always provide both `.up.sql` and `.down.sql` files
- Test migrations locally before applying to production
- Use transactions for complex migrations
- Never modify existing migration files (create new ones instead)
- Keep migrations small and focused

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
migrate -path internal/database/migrations -database $DATABASE_URL version

# Manually fix the database issue (rollback partial changes)

# Force to previous version
migrate -path internal/database/migrations -database $DATABASE_URL force X-1

# Re-run migrations
migrate -path internal/database/migrations -database $DATABASE_URL up
```

### Slow Queries

**Symptoms:** High response times for database operations

**Solutions:**
- Add indexes to frequently queried columns
- Use `EXPLAIN ANALYZE` to identify bottlenecks
- Optimize JOIN operations
- Consider caching frequently accessed data in Redis
- Review connection pool settings

# Database Schema Changes - Migration 000008

**Migration Date:** 2025-01-18
**Migration Name:** `000008_restructure_auth_system`
**Migration Type:** Major restructure (Authentication system overhaul)

## Overview

This migration transforms the brokerage platform's authentication system from **Supabase Auth** to a **custom authentication system** with admin-approval workflow for new user registrations. It also introduces a comprehensive order history tracking table while preserving all existing trading functionality.

---

## Summary of Changes

### ✅ New Tables Created
1. **pending_registrations** - User registrations awaiting admin approval
2. **order_history** - Completed/closed trades with full lifecycle tracking

### 🔄 Tables Modified
1. **users** - Restructured for custom authentication
2. **accounts** - Simplified structure with balance reference field

### 📦 Tables Preserved (No Changes)
- balances
- orders
- pending_orders
- contracts
- transactions
- audit_logs
- kyc_documents
- lp_routes
- reconciliation_queue
- lp_routing_config
- instruments
- forex_klines_1m

### ❌ Removed Features
- Supabase Row Level Security (RLS) policies
- Supabase auth.users integration triggers
- Foreign key dependency on auth.users

---

## Detailed Changes

## 1. NEW TABLE: pending_registrations

**Purpose:** Store user registration requests that require admin approval before account creation.

### Schema

```sql
CREATE TABLE pending_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    hash_password TEXT NOT NULL,
    country TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('approved', 'rejected', 'pending')),
    admin_id UUID,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes
- `idx_pending_registrations_email` - Fast lookup by email
- `idx_pending_registrations_status` - Filter by approval status
- `idx_pending_registrations_created_at` - Ordered by registration date

### Workflow
1. User submits registration → Record created with `status='pending'`
2. Admin reviews → Updates `status` to 'approved' or 'rejected'
3. If approved → User record created in `users` table
4. Record preserved for audit trail

---

## 2. NEW TABLE: order_history

**Purpose:** Track completed and closed trades with full lifecycle data (open/close prices, profit/loss, TP/SL).

### Schema

```sql
CREATE TABLE order_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT UNIQUE NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    volume DECIMAL(20, 8) NOT NULL CHECK (volume > 0),
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
    tp DECIMAL(20, 8),              -- Take Profit price
    sl DECIMAL(20, 8),              -- Stop Loss price
    open_time TIMESTAMP NOT NULL,
    close_time TIMESTAMP,
    open_price DECIMAL(20, 8) NOT NULL,
    close_price DECIMAL(20, 8),
    profit DECIMAL(20, 8),
    change DECIMAL(10, 4),          -- Percentage change
    status TEXT DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'unsuccessful')),
    leverage INTEGER DEFAULT 1,
    commission DECIMAL(20, 8) DEFAULT 0,
    swap DECIMAL(20, 8) DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes
- `idx_order_history_account_id` - Fast lookup by account
- `idx_order_history_symbol` - Filter by trading pair
- `idx_order_history_status` - Filter by trade status
- `idx_order_history_open_time` - Ordered by open time
- `idx_order_history_close_time` - Ordered by close time
- `idx_order_history_order_id` - Unique order lookup
- `idx_order_history_account_open_time` - Composite index for account + time queries

### Order ID Generation

```sql
CREATE SEQUENCE order_history_id_seq START 1;

CREATE FUNCTION generate_order_history_id() RETURNS TEXT
-- Returns: 'ORD-00000001', 'ORD-00000002', etc.
```

### Use Cases
- Display user's trading history with P&L
- Calculate total profit/loss over time periods
- Analyze trading patterns (win rate, average profit, etc.)
- Generate trading reports and statements
- Track TP/SL hit rates

---

## 3. MODIFIED TABLE: users

### BEFORE (Supabase Auth Integration)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    country TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Authentication:** Managed by Supabase auth.users
**User Creation:** Automatic trigger on auth.users insert
**Password Storage:** In auth.users (not visible)
**Access Control:** RLS policies based on auth.uid()

### AFTER (Custom Authentication)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT UNIQUE NOT NULL,           -- NEW: USR-00001 format
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,                        -- NEW: Replaces full_name
    last_name TEXT,                         -- NEW: Replaces full_name
    hash_password TEXT,                     -- NEW: Password hash storage
    phone_number TEXT,                      -- NEW: Contact number
    country TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL, -- NEW: Account active status
    last_login TIMESTAMP,                   -- NEW: Track last login
    created_at TIMESTAMP DEFAULT NOW(),
    last_updated_at TIMESTAMP DEFAULT NOW()  -- RENAMED: from updated_at
);
```

**Authentication:** Custom implementation (hash_password)
**User Creation:** Manual creation after admin approval
**Password Storage:** In users.hash_password (bcrypt/argon2 recommended)
**Access Control:** Application-level (RLS disabled)

### New Indexes
- `idx_users_user_id` - Unique user identifier lookup
- `idx_users_email` - Email-based login
- `idx_users_is_active` - Filter active users

### Breaking Changes
- ❌ `auth.uid()` no longer available (Supabase auth removed)
- ❌ RLS policies removed - implement auth in application layer
- ❌ Automatic user creation on signup - now requires admin approval
- ❌ `full_name` column removed - split into first_name + last_name

### Migration Data Handling
- Existing users: `user_id` generated as 'USR-00001', 'USR-00002', etc.
- `is_active` defaulted to `true` for existing users
- `full_name` data lost (not split - manual data entry needed)

---

## 4. MODIFIED TABLE: accounts

### BEFORE (Complex Structure)

```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_number TEXT UNIQUE,               -- Format: 1000000-9999999
    type account_type NOT NULL,               -- ENUM: 'live', 'demo'
    product_type product_type,                -- ENUM: 'spot', 'cfd', 'futures' (DEPRECATED)
    currency TEXT DEFAULT 'USD',
    status account_status NOT NULL,           -- ENUM: 'active', 'deactivated', 'suspended'
    nickname TEXT,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'wallet',
    last_accessed_at TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Balance Storage:** Separate `balances` table
**Status Values:** active, deactivated, suspended
**Type Values:** live, demo
**UI Customization:** nickname, color, icon

### AFTER (Simplified Structure)

```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id TEXT UNIQUE NOT NULL,          -- NEW: Simplified ID format
    account_number TEXT UNIQUE,               -- PRESERVED: Existing account numbers
    type account_type NOT NULL,               -- UPDATED ENUM: 'live', 'demo', 'deactivate'
    balance DECIMAL(20, 8) DEFAULT 0 NOT NULL, -- NEW: Primary balance reference
    currency TEXT DEFAULT 'USD',
    status account_status NOT NULL,           -- UPDATED ENUM: 'online', 'offline'
    last_updated TIMESTAMP,                   -- NEW: Balance last updated time
    last_login TIMESTAMP,                     -- NEW: Account last login
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- PRESERVED but optional to keep:
    product_type product_type,
    nickname TEXT,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'wallet',
    last_accessed_at TIMESTAMP,
    access_count INTEGER DEFAULT 0
);
```

**Balance Storage:** Both in `balance` field (reference) and `balances` table (multi-currency)
**Status Values:** online, offline
**Type Values:** live, demo, deactivate
**Account ID:** Simple unique identifier (synced from account_number if available)

### New Indexes
- `idx_accounts_account_id` - Fast lookup by account ID
- `idx_accounts_status` - Filter by online/offline status

### ENUM Changes

#### account_type
- BEFORE: `'live', 'demo'`
- AFTER: `'live', 'demo', 'deactivate'`
- Migration: No changes to existing values

#### account_status
- BEFORE: `'active', 'deactivated', 'suspended'`
- AFTER: `'online', 'offline'`
- Migration:
  - `'active'` → `'online'`
  - `'deactivated'` → `'offline'`
  - `'suspended'` → `'offline'`

### New Trigger: Balance Sync

```sql
CREATE TRIGGER trigger_sync_account_balance
    AFTER INSERT OR UPDATE ON balances
    FOR EACH ROW
    EXECUTE FUNCTION sync_account_balance();
```

**Purpose:** Automatically update `accounts.balance` when `balances` table changes
**Logic:** Updates balance for matching account + currency

### Migration Data Handling
- `account_id`: Generated from existing `account_number` or random 8-digit number
- `balance`: Synced from `balances` table (primary currency)
- `last_updated`: Set to current `updated_at`
- Status migration: active→online, deactivated/suspended→offline

### Preserved Columns (Optional)
The migration preserves these columns for backward compatibility, but they can be dropped:
- `account_number` (replaced by account_id)
- `product_type` (moved to order level)
- `nickname`, `color`, `icon` (UI customization)
- `last_accessed_at`, `access_count` (analytics)

---

## 5. REMOVED: Supabase RLS Policies

### All RLS Policies Dropped

The following RLS policies have been removed from all tables:

#### Users Table
- ❌ "Users can read own data"
- ❌ "Users can update own data"
- ❌ "Users can insert own data"

#### Accounts Table
- ❌ "Users can read own accounts"
- ❌ "Users can insert own accounts"
- ❌ "Users can update own accounts"

#### Balances Table
- ❌ "Users can read own balances"
- ❌ "Users can insert own balances"
- ❌ "Users can update own balances"

#### Orders Table
- ❌ "Users can read own orders"
- ❌ "Users can insert own orders"
- ❌ "Users can update own orders"

#### Pending Orders Table
- ❌ "Users can read own pending orders"
- ❌ "Users can insert own pending orders"
- ❌ "Users can update own pending orders"
- ❌ "Users can delete own pending orders"

#### Contracts Table
- ❌ "Users can read own contracts"
- ❌ "Users can insert own contracts"
- ❌ "Users can update own contracts"

#### Transactions Table
- ❌ "Users can read own transactions"
- ❌ "Users can insert own transactions"
- ❌ "Users can update own transactions"

#### Audit Logs Table
- ❌ "Users can read own audit logs"
- ❌ "Service role can insert audit logs"

#### KYC Documents Table
- ❌ "Users can read own KYC documents"
- ❌ "Users can insert own KYC documents"
- ❌ "Users can update own pending KYC documents"

#### Instruments Table
- ❌ "Anyone can read instruments"

### Impact

**BEFORE:** Database-level access control via RLS
**AFTER:** Application-level access control required

**Required Changes:**
1. Implement authentication middleware in backend API
2. Validate user sessions before database queries
3. Add authorization checks in application code
4. Ensure API endpoints verify user ownership of resources

**Example (Go):**
```go
// BEFORE (RLS handled automatically)
db.Query("SELECT * FROM orders")

// AFTER (Must filter by user_id in application)
db.Query("SELECT * FROM orders WHERE user_id = $1", currentUserID)
```

---

## 6. REMOVED: Supabase Auth Integration

### Dropped Triggers

```sql
DROP TRIGGER on_auth_user_created ON auth.users;
DROP TRIGGER on_auth_user_deleted ON auth.users;
DROP TRIGGER on_public_user_deleted ON users;
```

### Dropped Functions

```sql
DROP FUNCTION handle_new_user();          -- Auto-create user on auth signup
DROP FUNCTION handle_user_delete();       -- Cascade delete to auth.users
DROP FUNCTION handle_auth_user_delete();  -- Cascade delete to public.users
```

### Impact

**User Registration Flow:**

**BEFORE (Supabase Auth):**
1. User signs up via Supabase client
2. `auth.users` record created
3. Trigger automatically creates `public.users` record
4. User immediately active

**AFTER (Custom Auth):**
1. User submits registration form
2. Record created in `pending_registrations` table
3. Admin reviews and approves/rejects
4. If approved, application creates `users` record
5. User can now log in

**User Deletion Flow:**

**BEFORE:** Deleting from `public.users` cascades to `auth.users` (and vice versa)
**AFTER:** Application must handle user deletion explicitly

---

## Data Migration Strategy

### Existing Users

All existing users are preserved with the following transformations:

```sql
-- Generate user_id for existing users
UPDATE users SET user_id = 'USR-00001', 'USR-00002', ...

-- Set default active status
UPDATE users SET is_active = true

-- Note: hash_password, phone_number, first_name, last_name remain NULL
-- Manual data entry or user profile update flow required
```

### Existing Accounts

All existing accounts are preserved with the following transformations:

```sql
-- Copy account_number to account_id (or generate random)
UPDATE accounts SET account_id = account_number (or random 8-digit)

-- Sync balance from balances table
UPDATE accounts SET balance = (SELECT amount FROM balances WHERE ...)

-- Migrate status values
UPDATE accounts SET status = 'online' WHERE status = 'active'
UPDATE accounts SET status = 'offline' WHERE status IN ('deactivated', 'suspended')
```

### No Data Loss

The following tables and data are **100% preserved**:
- ✅ balances - All currency balances intact
- ✅ orders - All order history preserved
- ✅ pending_orders - All pending orders intact
- ✅ contracts - All CFD positions preserved
- ✅ transactions - All transaction history intact
- ✅ audit_logs - Complete audit trail preserved
- ✅ kyc_documents - All KYC documents intact
- ✅ lp_routes - All LP routing data preserved
- ✅ instruments - All trading instruments intact
- ✅ forex_klines_1m - All historical price data preserved

---

## Application Code Changes Required

### 1. Authentication Implementation

**Implement custom auth system:**
- Password hashing (bcrypt, argon2, etc.)
- Session management (JWT, cookies, etc.)
- Login/logout endpoints
- Password reset flow

**Example (Go):**
```go
// Hash password on registration
hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

// Verify password on login
err := bcrypt.CompareHashAndPassword(user.HashPassword, []byte(password))
```

### 2. Remove Supabase Client Dependencies

**BEFORE:**
```typescript
// Frontend - Supabase Auth
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, anonKey)
await supabase.auth.signUp({ email, password })
const user = supabase.auth.getUser()
```

**AFTER:**
```typescript
// Frontend - Custom API
await fetch('/api/register', {
  method: 'POST',
  body: JSON.stringify({ email, password, firstName, lastName })
})

await fetch('/api/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
})
```

### 3. Update Authorization Checks

**BEFORE (RLS automatic):**
```go
// No user_id filtering needed - RLS handles it
db.Query("SELECT * FROM accounts")
```

**AFTER (Application-level):**
```go
// Must filter by user_id explicitly
userID := getAuthenticatedUserID(ctx)
db.Query("SELECT * FROM accounts WHERE user_id = $1", userID)
```

### 4. Registration Approval Workflow

**New admin endpoints needed:**
```go
// GET /admin/registrations - List pending registrations
// POST /admin/registrations/:id/approve - Approve registration
// POST /admin/registrations/:id/reject - Reject registration
```

**Approval logic:**
```go
func approveRegistration(regID uuid.UUID, adminID uuid.UUID) error {
    // 1. Get pending registration
    reg := getPendingRegistration(regID)

    // 2. Create user record
    user := createUser(reg.Email, reg.FirstName, reg.LastName, reg.HashPassword, ...)

    // 3. Update pending_registrations status
    updateRegistrationStatus(regID, "approved", adminID)

    // 4. Send approval email
    sendApprovalEmail(reg.Email)

    return nil
}
```

### 5. Update Frontend State Management

**BEFORE (Supabase auth slice):**
```typescript
// Redux - authSlice using Supabase
import { supabase } from '@/lib/supabase'

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, session: null },
  reducers: {
    setUser: (state, action) => { state.user = action.payload }
  }
})
```

**AFTER (Custom auth slice):**
```typescript
// Redux - Custom auth
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
    token: null
  },
  reducers: {
    loginSuccess: (state, action) => {
      state.user = action.payload.user
      state.token = action.payload.token
      state.isAuthenticated = true
    },
    logout: (state) => {
      state.user = null
      state.token = null
      state.isAuthenticated = false
    }
  }
})
```

---

## Testing Checklist

### Pre-Migration Tests

- [ ] Backup production database
- [ ] Test migration on development database
- [ ] Test rollback migration
- [ ] Verify data integrity after migration
- [ ] Document expected downtime

### Post-Migration Tests

#### Authentication
- [ ] User registration creates pending_registrations record
- [ ] Admin can approve/reject registrations
- [ ] Approved users can log in
- [ ] Password hashing works correctly
- [ ] Session management works (JWT/cookies)
- [ ] Logout clears session

#### Users Table
- [ ] Existing users have user_id assigned
- [ ] Email login works
- [ ] is_active flag filters active users
- [ ] last_login updates on login
- [ ] User profile updates work

#### Accounts Table
- [ ] All existing accounts have account_id
- [ ] Balance field syncs from balances table
- [ ] Status shows online/offline correctly
- [ ] Account switching works
- [ ] Multi-currency balances preserved

#### Order History
- [ ] New orders can be added to order_history
- [ ] order_id generates correctly (ORD-00000001)
- [ ] Profit/loss calculations correct
- [ ] Percentage change calculates correctly
- [ ] TP/SL tracking works
- [ ] Query performance acceptable

#### Authorization
- [ ] Users can only see own data
- [ ] Unauthorized access blocked
- [ ] Admin access works correctly
- [ ] API endpoints validate user_id

#### Data Integrity
- [ ] All balances match pre-migration
- [ ] All orders preserved
- [ ] All contracts preserved
- [ ] All transactions preserved
- [ ] Foreign key constraints valid

---

## Rollback Procedure

If issues occur after migration:

```bash
# Rollback to previous schema
migrate -path internal/database/migrations \
        -database $DATABASE_URL \
        down 1

# OR using psql
psql $DATABASE_URL < internal/database/migrations/000008_restructure_auth_system.down.sql
```

**⚠️ WARNING:** Rollback will:
- Drop `pending_registrations` table (data lost)
- Drop `order_history` table (data lost)
- Remove custom auth fields from `users` (user_id, hash_password, etc. lost)
- Restore Supabase auth integration (requires auth.users to exist)

**Recommendation:** Before rollback, export data from new tables:

```bash
pg_dump $DATABASE_URL -t pending_registrations -t order_history > migration_data_backup.sql
```

---

## Migration Execution

### Step 1: Backup Database

```bash
# Full database backup
pg_dump $DATABASE_URL > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# Or use Supabase dashboard backup feature
```

### Step 2: Run Migration

```bash
# Using golang-migrate
migrate -path internal/database/migrations \
        -database "postgresql://postgres.wooyddswgjhdddycsmmp:YXmqkYq9NY5lXNc2@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" \
        up

# OR using psql
psql "postgresql://postgres.wooyddswgjhdddycsmmp:YXmqkYq9NY5lXNc2@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" \
     -f internal/database/migrations/000008_restructure_auth_system.up.sql
```

### Step 3: Verify Migration

```bash
# Check migration status
migrate -path internal/database/migrations \
        -database $DATABASE_URL \
        version

# Verify tables exist
psql $DATABASE_URL -c "\dt"

# Verify data migrated
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM accounts;"
```

### Step 4: Update Application Code

1. Implement custom authentication system
2. Remove Supabase auth dependencies
3. Add authorization middleware
4. Update frontend auth flows
5. Deploy backend changes
6. Deploy frontend changes

### Step 5: Test Production

1. Test user login with existing accounts
2. Test new user registration → approval workflow
3. Test trading functionality (orders, positions, etc.)
4. Monitor error logs for auth issues

---

## Support and Troubleshooting

### Common Issues

**Issue: Migration fails with foreign key constraint error**
```
ERROR: update or delete on table "users" violates foreign key constraint
```
**Solution:** Ensure no orphaned records exist before migration

**Issue: RLS policy errors after migration**
```
ERROR: function auth.uid() does not exist
```
**Solution:** RLS policies should be dropped - check if any were missed

**Issue: Users can't log in after migration**
```
ERROR: column "hash_password" is null
```
**Solution:** Existing users need to reset password to populate hash_password

### Contact

For migration support, contact the database administrator or file an issue in the project repository.

---

## Appendix: Schema Comparison Tables

### users Table Comparison

| Column | BEFORE | AFTER | Notes |
|--------|--------|-------|-------|
| id | UUID (FK to auth.users) | UUID (Primary Key) | No longer references auth.users |
| user_id | ❌ N/A | ✅ TEXT UNIQUE | NEW: USR-00001 format |
| email | TEXT | TEXT | Unchanged |
| full_name | TEXT | ❌ Removed | Replaced by first_name + last_name |
| first_name | ❌ N/A | ✅ TEXT | NEW |
| last_name | ❌ N/A | ✅ TEXT | NEW |
| hash_password | ❌ N/A (in auth.users) | ✅ TEXT | NEW: Password storage |
| phone_number | ❌ N/A | ✅ TEXT | NEW |
| country | TEXT | TEXT | Unchanged |
| is_active | ❌ N/A | ✅ BOOLEAN | NEW: Account status |
| last_login | ❌ N/A | ✅ TIMESTAMP | NEW |
| created_at | TIMESTAMP | TIMESTAMP | Unchanged |
| updated_at | TIMESTAMP | ❌ Renamed | Renamed to last_updated_at |
| last_updated_at | ❌ N/A | ✅ TIMESTAMP | RENAMED from updated_at |

### accounts Table Comparison

| Column | BEFORE | AFTER | Notes |
|--------|--------|-------|-------|
| id | UUID | UUID | Unchanged |
| user_id | UUID (FK) | UUID (FK) | Unchanged |
| account_number | TEXT UNIQUE | TEXT UNIQUE | Preserved (optional) |
| account_id | ❌ N/A | ✅ TEXT UNIQUE | NEW: Simplified ID |
| type | account_type | account_type | ENUM updated (added 'deactivate') |
| product_type | product_type | product_type | Preserved (optional) |
| balance | ❌ N/A | ✅ DECIMAL(20,8) | NEW: Primary balance |
| currency | TEXT | TEXT | Unchanged |
| status | account_status | account_status | ENUM changed (active/deactivated/suspended → online/offline) |
| nickname | TEXT | TEXT | Preserved (optional) |
| color | TEXT | TEXT | Preserved (optional) |
| icon | TEXT | TEXT | Preserved (optional) |
| last_updated | ❌ N/A | ✅ TIMESTAMP | NEW: Balance update time |
| last_login | ❌ N/A | ✅ TIMESTAMP | NEW |
| last_accessed_at | TIMESTAMP | TIMESTAMP | Preserved (optional) |
| access_count | INTEGER | INTEGER | Preserved (optional) |
| created_at | TIMESTAMP | TIMESTAMP | Unchanged |
| updated_at | TIMESTAMP | TIMESTAMP | Unchanged |

---

**End of Documentation**

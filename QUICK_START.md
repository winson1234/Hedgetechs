# Quick Start - Fix Account Creation

## ⚡ TL;DR - Just Run This!

If you can't create demo or live accounts, run:

```bash
./fix_database_and_accounts.sh
```

Wait 30-60 seconds, then try creating accounts again at http://localhost:5173

---

## What This Does

1. ✅ Stops all containers
2. ✅ Removes old database (with wrong credentials)
3. ✅ Creates fresh database with correct credentials
4. ✅ Applies all 14 database migrations
5. ✅ Creates missing balances table
6. ✅ Restarts all services
7. ✅ Verifies setup

## Before Running

Make sure Docker is running:
```bash
docker ps
```

## After Running

### Test 1: Verify Database
```bash
./test_account_creation.sh
```

You should see:
```
✅ accounts table exists
✅ balances table exists
✅ users table exists
✅ account_type_enum exists
✅ account_status_enum exists
```

### Test 2: Create Account via Frontend

1. Open: http://localhost:5173
2. Register new user
3. Login
4. Click "Create Account"
5. Choose "Demo" or "Live"
6. Set currency and initial balance
7. Click "Create Account"

You should see:
```json
{
  "success": true,
  "account": {
    "id": "uuid-here",
    "account_id": 10001,
    "account_type": "live",
    "currency": "USD",
    "balance": 0,
    "status": "active"
  }
}
```

## If It Still Doesn't Work

### Check 1: Backend Connection
```bash
docker logs brokerage-backend-dev | grep -i error
```

### Check 2: Database Connection
```bash
docker exec brokerage-postgres-dev psql -U postgres -d brokerage_dev -c "SELECT 1"
```

Should output: `?column? ---------- 1`

### Check 3: Services Status
```bash
docker compose -f docker-compose.dev.yml ps
```

All should show "Up" status.

### Check 4: Re-run Fix
If still not working, run the fix script again:
```bash
./fix_database_and_accounts.sh
```

## Other Useful Commands

```bash
# View all logs (live)
make dev-logs

# View only backend logs
make dev-logs-backend

# Restart just backend
docker compose -f docker-compose.dev.yml restart backend

# Stop everything
make dev-down

# Complete reset (nuclear option)
make dev-clean
docker compose -f docker-compose.dev.yml up -d --build
```

## Need More Help?

Read the full guide: [DATABASE_FIX_GUIDE.md](./DATABASE_FIX_GUIDE.md)

## What Was The Problem?

PostgreSQL container was initialized with user `postgres` but the app tried to connect with `postgres_hedgetechs`. This caused:
- ❌ Backend couldn't connect to database
- ❌ Account creation failed
- ❌ All API calls failed

The fix script resets the database with the correct credentials from `.env.dev` file.


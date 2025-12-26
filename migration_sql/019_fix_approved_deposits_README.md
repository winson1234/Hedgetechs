# Fix Approved Deposits Script

## Problem
Some deposits were approved in the database but:
1. The transaction status is still "pending" (should be "completed")
2. The transaction_id is NULL (transaction record was never created)
3. This causes the history page to show deposits as "pending" even though they're approved

## Solution
This script fixes approved deposits by:
1. Updating transaction status from "pending" to "completed" if transaction exists
2. Creating missing transaction records if transaction_id is NULL
3. Linking the transaction to the deposit

**Note:** This script assumes balances were already credited when deposits were approved. It only fixes the transaction status/records, not the balance.

## How to Run

### Option 1: Using psql
```bash
psql -h <host> -U <user> -d <database> -f migration_sql/019_fix_approved_deposits.sql
```

### Option 2: Using Docker (if database is in Docker)
```bash
docker exec -i <postgres_container> psql -U <user> -d <database> < migration_sql/019_fix_approved_deposits.sql
```

### Option 3: Using database client
Copy and paste the SQL script content into your database client (pgAdmin, DBeaver, etc.) and execute it.

## Verification

After running the script, verify the fix:

```sql
-- Check approved deposits with pending transactions (should return 0 rows)
SELECT d.id, d.reference_id, d.status, t.status as transaction_status
FROM deposits d
LEFT JOIN transactions t ON d.transaction_id = t.id
WHERE d.status = 'approved'
AND (t.status = 'pending' OR t.status IS NULL OR d.transaction_id IS NULL);

-- Check approved deposits with completed transactions (should show all approved deposits)
SELECT d.id, d.reference_id, d.status, t.status as transaction_status
FROM deposits d
LEFT JOIN transactions t ON d.transaction_id = t.id
WHERE d.status = 'approved'
AND t.status = 'completed';
```

## Affected Deposit IDs
Based on the user's report, these deposits should be fixed:
- `3f64897a-30b5-492f-a4ec-ff19f56bc201` (DEP-20251223-000003)
- `5c575094-f651-4683-af62-5fd1bcf524e8` (DEP-20251223-000001)
- `bc12a555-87d1-4217-ab86-ce5700f8d426` (DEP-20251223-000002)


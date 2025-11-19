-- ===================================================================
-- Migration 000011 Rollback: Revert forex_klines_1m Partitioning
-- ===================================================================
-- Purpose: Restore the original non-partitioned forex_klines_1m table
-- Use Case: If partitioning causes issues or needs to be rolled back
-- ===================================================================

BEGIN;

RAISE NOTICE 'Starting rollback of forex_klines_1m partitioning...';

-- Step 1: Check if old table still exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'forex_klines_1m_old') THEN
        RAISE NOTICE 'Old table forex_klines_1m_old found - will restore from it';
    ELSE
        RAISE WARNING 'Old table forex_klines_1m_old not found - rollback may be incomplete';
    END IF;
END $$;

-- Step 2: Drop the partitioned table and all its partitions
DROP TABLE IF EXISTS forex_klines_1m CASCADE;

-- Step 3: Drop the partition archive log table
DROP TABLE IF EXISTS partition_archive_log;

-- Step 4: Restore the old table
ALTER TABLE IF EXISTS forex_klines_1m_old RENAME TO forex_klines_1m;

-- Step 5: Recreate original indexes if they don't exist
DO $$
BEGIN
    -- Create unique index on (symbol, timestamp) if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'forex_klines_1m' AND indexname = 'idx_forex_klines_symbol_timestamp'
    ) THEN
        CREATE UNIQUE INDEX idx_forex_klines_symbol_timestamp
        ON forex_klines_1m (symbol, timestamp DESC);
        RAISE NOTICE 'Created index idx_forex_klines_symbol_timestamp';
    END IF;

    -- Create timestamp index if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'forex_klines_1m' AND indexname = 'idx_forex_klines_timestamp'
    ) THEN
        CREATE INDEX idx_forex_klines_timestamp
        ON forex_klines_1m (timestamp DESC);
        RAISE NOTICE 'Created index idx_forex_klines_timestamp';
    END IF;
END $$;

-- Step 6: Verify restoration
DO $$
DECLARE
    table_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO table_count FROM forex_klines_1m;
    RAISE NOTICE 'Rollback complete: forex_klines_1m restored with % rows', table_count;
END $$;

COMMIT;

-- ===================================================================
-- Post-Rollback Notes:
-- ===================================================================
-- 1. The partitioned table and all partitions have been dropped
-- 2. The original table has been restored
-- 3. All indexes have been recreated
-- 4. Verify data integrity before resuming operations
-- ===================================================================

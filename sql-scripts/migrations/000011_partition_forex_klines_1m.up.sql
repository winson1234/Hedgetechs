-- ===================================================================
-- Migration 000011: Partition forex_klines_1m Table
-- ===================================================================
-- Purpose: Convert forex_klines_1m to a partitioned table for scalability
-- Strategy: Monthly partitions with RANGE partitioning on timestamp
-- Impact: Improved query performance, easier data lifecycle management
-- ===================================================================

BEGIN;

-- Step 1: Rename existing table
ALTER TABLE forex_klines_1m RENAME TO forex_klines_1m_old;

-- Step 2: Create new partitioned master table
CREATE TABLE forex_klines_1m (
    id UUID DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    timestamp TIMESTAMP WITHOUT TIME ZONE NOT NULL,

    -- Bid prices (OHLC)
    open_bid DECIMAL(18, 5) NOT NULL,
    high_bid DECIMAL(18, 5) NOT NULL,
    low_bid DECIMAL(18, 5) NOT NULL,
    close_bid DECIMAL(18, 5) NOT NULL,

    -- Ask prices (OHLC)
    open_ask DECIMAL(18, 5) NOT NULL,
    high_ask DECIMAL(18, 5) NOT NULL,
    low_ask DECIMAL(18, 5) NOT NULL,
    close_ask DECIMAL(18, 5) NOT NULL,

    -- Tick count
    volume INT DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),

    -- Partition key must be in unique constraints
    UNIQUE (symbol, timestamp)
) PARTITION BY RANGE (timestamp);

-- Step 4: Create index on timestamp for range queries
CREATE INDEX IF NOT EXISTS idx_forex_klines_timestamp ON forex_klines_1m (timestamp DESC);

-- Step 5: Create monthly partitions
-- Historical partitions (September, October, November 2025)
CREATE TABLE forex_klines_1m_2025_09 PARTITION OF forex_klines_1m
    FOR VALUES FROM ('2025-09-01 00:00:00') TO ('2025-10-01 00:00:00');

CREATE TABLE forex_klines_1m_2025_10 PARTITION OF forex_klines_1m
    FOR VALUES FROM ('2025-10-01 00:00:00') TO ('2025-11-01 00:00:00');

CREATE TABLE forex_klines_1m_2025_11 PARTITION OF forex_klines_1m
    FOR VALUES FROM ('2025-11-01 00:00:00') TO ('2025-12-01 00:00:00');

-- Future partitions (December 2025, January 2026)
CREATE TABLE forex_klines_1m_2025_12 PARTITION OF forex_klines_1m
    FOR VALUES FROM ('2025-12-01 00:00:00') TO ('2026-01-01 00:00:00');

CREATE TABLE forex_klines_1m_2026_01 PARTITION OF forex_klines_1m
    FOR VALUES FROM ('2026-01-01 00:00:00') TO ('2026-02-01 00:00:00');

-- Step 6: Migrate data from old table to new partitioned table
-- This is done in batches to avoid locking the database for too long
-- Note: ON CONFLICT DO NOTHING ensures idempotency
DO $$
DECLARE
    batch_size INT := 10000;
    total_migrated BIGINT := 0;
    rows_migrated BIGINT;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
BEGIN
    start_time := clock_timestamp();
    RAISE NOTICE 'Starting data migration from forex_klines_1m_old to partitioned table';

    LOOP
        -- Insert batch
        WITH batch AS (
            SELECT *
            FROM forex_klines_1m_old
            WHERE timestamp >= '2025-09-01 00:00:00'
            ORDER BY timestamp
            LIMIT batch_size
            OFFSET total_migrated
        )
        INSERT INTO forex_klines_1m (
            id, symbol, timestamp,
            open_bid, high_bid, low_bid, close_bid,
            open_ask, high_ask, low_ask, close_ask,
            volume, created_at
        )
        SELECT
            id, symbol, timestamp,
            open_bid, high_bid, low_bid, close_bid,
            open_ask, high_ask, low_ask, close_ask,
            volume, created_at
        FROM batch
        ON CONFLICT (symbol, timestamp) DO NOTHING;

        GET DIAGNOSTICS rows_migrated = ROW_COUNT;
        total_migrated := total_migrated + rows_migrated;

        -- Exit when no more rows to migrate
        EXIT WHEN rows_migrated = 0;

        -- Progress logging every 100k rows
        IF total_migrated % 100000 = 0 THEN
            RAISE NOTICE 'Migrated % rows...', total_migrated;
        END IF;

        -- Small delay to avoid overwhelming the database
        PERFORM pg_sleep(0.1);
    END LOOP;

    end_time := clock_timestamp();
    RAISE NOTICE 'Migration complete: % rows migrated in %', total_migrated, (end_time - start_time);
END $$;

-- Step 7: Verify data migration
DO $$
DECLARE
    old_count BIGINT;
    new_count BIGINT;
    partition_count BIGINT;
BEGIN
    -- Count rows in old table (only data in partition range)
    SELECT COUNT(*) INTO old_count
    FROM forex_klines_1m_old
    WHERE timestamp >= '2025-09-01 00:00:00';

    -- Count rows in new partitioned table
    SELECT COUNT(*) INTO new_count FROM forex_klines_1m;

    -- Count partitions
    SELECT COUNT(*) INTO partition_count
    FROM pg_inherits
    WHERE inhparent = 'forex_klines_1m'::regclass;

    RAISE NOTICE 'Old table rows (in partition range): %', old_count;
    RAISE NOTICE 'New table rows: %', new_count;
    RAISE NOTICE 'Number of partitions: %', partition_count;

    IF old_count != new_count THEN
        RAISE WARNING 'Row count mismatch! Old: %, New: %', old_count, new_count;
    ELSE
        RAISE NOTICE 'Data migration verified successfully!';
    END IF;
END $$;

-- Step 8: Create partition_archive_log table for tracking archival operations
CREATE TABLE IF NOT EXISTS partition_archive_log (
    id SERIAL PRIMARY KEY,
    partition_name TEXT NOT NULL,
    archive_date TIMESTAMP DEFAULT NOW(),
    archive_location TEXT NOT NULL,
    row_count BIGINT NOT NULL,
    file_size_bytes BIGINT,
    checksum TEXT,
    archived_by TEXT DEFAULT current_user,
    status TEXT DEFAULT 'archived' CHECK (status IN ('archived', 'dropped', 'failed'))
);

CREATE INDEX idx_partition_archive_log_partition ON partition_archive_log(partition_name);
CREATE INDEX idx_partition_archive_log_date ON partition_archive_log(archive_date DESC);

-- Note: The old table forex_klines_1m_old is kept for safety
-- It should be manually dropped after verifying the partitioned table works correctly
-- To drop: DROP TABLE forex_klines_1m_old;

COMMIT;

-- ===================================================================
-- Post-Migration Notes:
-- ===================================================================
-- 1. Monthly partition pre-creation is handled by partition_manager_service
-- 2. Old partitions (>24 months) are archived and dropped automatically
-- 3. Archive location: S3 bucket (configured in partition_manager_service)
-- 4. To manually drop the old table: DROP TABLE forex_klines_1m_old;
-- ===================================================================

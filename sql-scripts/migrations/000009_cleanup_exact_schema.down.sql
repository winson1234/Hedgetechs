-- Migration: 000009_cleanup_exact_schema (Rollback)
-- Description: Rollback cleanup - restore columns if needed
-- Date: 2025-01-18

-- Note: This migration cleanup is mostly non-destructive
-- Most dropped columns were extras not in the spec
-- A full rollback would require restoring all the extra columns

-- Restore account_type column name if it was renamed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accounts' AND column_name = 'account_type'
    ) THEN
        ALTER TABLE accounts RENAME COLUMN account_type TO type;
    END IF;
END $$;

-- Restore basic structure (partial rollback)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Note: Full rollback of migration 000008 should be used instead if needed
RAISE NOTICE 'Migration 000009 rollback completed (partial)';

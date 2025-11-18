-- Migration 000007 Rollback: Remove Performance Indexes

DROP INDEX IF EXISTS idx_contracts_symbol_status;
DROP INDEX IF EXISTS idx_contracts_status_side;
DROP INDEX IF EXISTS idx_pending_orders_status_symbol;
DROP INDEX IF EXISTS idx_orders_account_created;
DROP INDEX IF EXISTS idx_transactions_account_created;

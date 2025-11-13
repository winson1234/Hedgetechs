-- Rollback: Remove order_number column from pending_orders table
DROP INDEX IF EXISTS idx_pending_orders_order_number;
ALTER TABLE public.pending_orders DROP COLUMN IF EXISTS order_number;

-- Add order_number column to pending_orders table for better UX and security
ALTER TABLE public.pending_orders
ADD COLUMN IF NOT EXISTS order_number TEXT;

-- Backfill existing pending orders with unique order numbers using the existing sequence
-- This ensures data consistency and prevents NULL values
UPDATE public.pending_orders
SET order_number = 'ORD-' || LPAD(NEXTVAL('public.order_number_seq')::TEXT, 5, '0')
WHERE order_number IS NULL;

-- Add an index for faster lookups by order_number
CREATE INDEX IF NOT EXISTS idx_pending_orders_order_number ON public.pending_orders(order_number);

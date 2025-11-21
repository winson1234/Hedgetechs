-- Rollback leverage columns from pending_orders and orders tables
ALTER TABLE public.pending_orders
DROP COLUMN IF EXISTS leverage;

ALTER TABLE public.orders
DROP COLUMN IF EXISTS leverage;

-- Rollback liquidation_price column from contracts table
ALTER TABLE public.contracts
DROP COLUMN IF EXISTS liquidation_price;

-- Remove Forex and Gold instruments (optional - keep if data exists)
-- DELETE FROM public.instruments WHERE symbol IN ('EURUSDT', 'XAUUSDT');

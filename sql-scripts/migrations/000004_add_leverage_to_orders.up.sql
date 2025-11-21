-- Add leverage column to pending_orders and orders tables for CFD/Futures trading
ALTER TABLE public.pending_orders
ADD COLUMN IF NOT EXISTS leverage INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS leverage INTEGER NOT NULL DEFAULT 1;

-- Add liquidation_price column to contracts table for automatic stop-out
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS liquidation_price DECIMAL(20, 8);

-- Seed Forex and Gold instruments for CFD trading
INSERT INTO public.instruments
(symbol, name, base_currency, quote_currency, instrument_type, is_tradeable, leverage_cap, min_order_size, tick_size)
VALUES
('EURUSDT', 'Euro / Tether', 'EUR', 'USDT', 'forex', true, 100, 0.01, 0.0001),
('XAUUSDT', 'Gold / Tether', 'XAU', 'USDT', 'commodity', true, 100, 0.01, 0.01)
ON CONFLICT (symbol) DO NOTHING;

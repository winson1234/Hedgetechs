-- ================================================================
-- ADD FOREX INSTRUMENTS
-- Description: Adds 3 TwelveData forex pairs (commodities removed - not available on free plan)
-- Date: 2025-11-14
-- ================================================================

-- Add forex pairs (TwelveData provider)
INSERT INTO public.instruments (symbol, name, base_currency, quote_currency, instrument_type, category, is_tradeable, leverage_cap, min_order_size, max_order_size, tick_size, spread_adjustment_bps) VALUES
    -- Forex Pairs (6) - Available on TwelveData free plan
    ('CADJPY', 'Canadian Dollar / Japanese Yen', 'CAD', 'JPY', 'forex', 'forex', true, 100, 0.01, 1000000, 0.001, 20),
    ('AUDNZD', 'Australian Dollar / New Zealand Dollar', 'AUD', 'NZD', 'forex', 'forex', true, 100, 0.01, 1000000, 0.0001, 20),
    ('EURGBP', 'Euro / British Pound', 'EUR', 'GBP', 'forex', 'forex', true, 100, 0.01, 1000000, 0.00001, 20),
    ('USDCAD', 'US Dollar / Canadian Dollar', 'USD', 'CAD', 'forex', 'forex', true, 100, 0.01, 1000000, 0.0001, 20),
    ('EURJPY', 'Euro / Japanese Yen', 'EUR', 'JPY', 'forex', 'forex', true, 100, 0.01, 1000000, 0.001, 20),
    ('GBPJPY', 'British Pound / Japanese Yen', 'GBP', 'JPY', 'forex', 'forex', true, 100, 0.01, 1000000, 0.001, 20)
ON CONFLICT (symbol) DO UPDATE SET
    name = EXCLUDED.name,
    base_currency = EXCLUDED.base_currency,
    quote_currency = EXCLUDED.quote_currency,
    instrument_type = EXCLUDED.instrument_type,
    category = EXCLUDED.category,
    is_tradeable = EXCLUDED.is_tradeable,
    leverage_cap = EXCLUDED.leverage_cap,
    min_order_size = EXCLUDED.min_order_size,
    max_order_size = EXCLUDED.max_order_size,
    tick_size = EXCLUDED.tick_size,
    spread_adjustment_bps = EXCLUDED.spread_adjustment_bps,
    updated_at = NOW();

-- Add comment
COMMENT ON COLUMN public.instruments.category IS 'Instrument category: major, defi, altcoin, forex, commodity';

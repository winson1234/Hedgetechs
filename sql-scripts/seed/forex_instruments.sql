-- Seed data for forex trading instruments
-- 12 major forex pairs

INSERT INTO public.instruments (symbol, instrument_type, base_currency, quote_currency, is_tradable) VALUES
    ('AUDJPY', 'forex', 'AUD', 'JPY', true),
    ('AUDUSD', 'forex', 'AUD', 'USD', true),
    ('CADJPY', 'forex', 'CAD', 'JPY', true),
    ('EURGBP', 'forex', 'EUR', 'GBP', true),
    ('EURJPY', 'forex', 'EUR', 'JPY', true),
    ('EURUSD', 'forex', 'EUR', 'USD', true),
    ('GBPJPY', 'forex', 'GBP', 'JPY', true),
    ('GBPUSD', 'forex', 'GBP', 'USD', true),
    ('NZDUSD', 'forex', 'NZD', 'USD', true),
    ('USDCAD', 'forex', 'USD', 'CAD', true),
    ('USDCHF', 'forex', 'USD', 'CHF', true),
    ('USDJPY', 'forex', 'USD', 'JPY', true)
ON CONFLICT (symbol) DO NOTHING;

-- Seed data for crypto trading instruments
-- 23 cryptocurrency pairs against USDT

INSERT INTO public.instruments (symbol, instrument_type, base_currency, quote_currency, is_tradable) VALUES
    ('ADAUSDT', 'crypto', 'ADA', 'USDT', true),
    ('APTUSDT', 'crypto', 'APT', 'USDT', true),
    ('ARBUSDT', 'crypto', 'ARB', 'USDT', true),
    ('ATOMUSDT', 'crypto', 'ATOM', 'USDT', true),
    ('AVAXUSDT', 'crypto', 'AVAX', 'USDT', true),
    ('BNBUSDT', 'crypto', 'BNB', 'USDT', true),
    ('BTCUSDT', 'crypto', 'BTC', 'USDT', true),
    ('DOGEUSDT', 'crypto', 'DOGE', 'USDT', true),
    ('DOTUSDT', 'crypto', 'DOT', 'USDT', true),
    ('ETHUSDT', 'crypto', 'ETH', 'USDT', true),
    ('FILUSDT', 'crypto', 'FIL', 'USDT', true),
    ('ICPUSDT', 'crypto', 'ICP', 'USDT', true),
    ('LINKUSDT', 'crypto', 'LINK', 'USDT', true),
    ('LTCUSDT', 'crypto', 'LTC', 'USDT', true),
    ('NEARUSDT', 'crypto', 'NEAR', 'USDT', true),
    ('OPUSDT', 'crypto', 'OP', 'USDT', true),
    ('SHIBUSDT', 'crypto', 'SHIB', 'USDT', true),
    ('SOLUSDT', 'crypto', 'SOL', 'USDT', true),
    ('STXUSDT', 'crypto', 'STX', 'USDT', true),
    ('SUIUSDT', 'crypto', 'SUI', 'USDT', true),
    ('TONUSDT', 'crypto', 'TON', 'USDT', true),
    ('UNIUSDT', 'crypto', 'UNI', 'USDT', true),
    ('XRPUSDT', 'crypto', 'XRP', 'USDT', true)
ON CONFLICT (symbol) DO NOTHING;

-- Create the trigger function for instruments
CREATE OR REPLACE FUNCTION public.update_instruments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the instruments table
CREATE TABLE public.instruments (
    symbol text NOT NULL,
    instrument_type text NOT NULL,
    base_currency text NOT NULL,
    quote_currency text NOT NULL,
    is_tradable boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT instruments_pkey PRIMARY KEY (symbol),
    CONSTRAINT instruments_instrument_type_check CHECK (
        instrument_type = ANY(ARRAY['crypto'::text, 'commodity'::text, 'forex'::text, 'spot'::text, 'futures'::text, 'options'::text])
    )
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_instruments_base_currency ON public.instruments USING btree (base_currency) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_instruments_quote_currency ON public.instruments USING btree (quote_currency) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_instruments_tradable ON public.instruments USING btree (is_tradable) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_instruments_type_tradable ON public.instruments USING btree (instrument_type, is_tradable) TABLESPACE pg_default;

-- Create trigger
CREATE TRIGGER trigger_update_instruments_updated_at 
BEFORE UPDATE ON public.instruments 
FOR EACH ROW
EXECUTE FUNCTION public.update_instruments_updated_at();

INSERT INTO "public"."instruments" ("symbol", "instrument_type", "base_currency", "quote_currency", "is_tradable", "created_at", "updated_at") VALUES ('ADAUSDT', 'crypto', 'ADA', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('APTUSDT', 'crypto', 'APT', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('ARBUSDT', 'crypto', 'ARB', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('ATOMUSDT', 'crypto', 'ATOM', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('AUDJPY', 'forex', 'AUD', 'JPY', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('AUDUSD', 'forex', 'AUD', 'USD', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('AVAXUSDT', 'crypto', 'AVAX', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('BNBUSDT', 'crypto', 'BNB', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('BTCUSDT', 'crypto', 'BTC', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-12-03 02:10:00.05648+00'), ('CADJPY', 'forex', 'CAD', 'JPY', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('DOGEUSDT', 'crypto', 'DOGE', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('DOTUSDT', 'crypto', 'DOT', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('ETHUSDT', 'crypto', 'ETH', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('EURGBP', 'forex', 'EUR', 'GBP', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('EURJPY', 'forex', 'EUR', 'JPY', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('EURUSD', 'forex', 'EUR', 'USD', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('FILUSDT', 'crypto', 'FIL', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('GBPJPY', 'forex', 'GBP', 'JPY', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('GBPUSD', 'forex', 'GBP', 'USD', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('ICPUSDT', 'crypto', 'ICP', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('LINKUSDT', 'crypto', 'LINK', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('LTCUSDT', 'crypto', 'LTC', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('NEARUSDT', 'crypto', 'NEAR', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('NZDUSD', 'forex', 'NZD', 'USD', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('OPUSDT', 'crypto', 'OP', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('PAXGUSDT', 'commodity', 'PAXG', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('SHIBUSDT', 'crypto', 'SHIB', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('SOLUSDT', 'crypto', 'SOL', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('STXUSDT', 'crypto', 'STX', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('SUIUSDT', 'crypto', 'SUI', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('TONUSDT', 'crypto', 'TON', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('UNIUSDT', 'crypto', 'UNI', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('USDCAD', 'forex', 'USD', 'CAD', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('USDCHF', 'forex', 'USD', 'CHF', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00'), ('USDJPY', 'forex', 'USD', 'JPY', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 15:37:48.903204+00'), ('XRPUSDT', 'crypto', 'XRP', 'USDT', 'true', '2025-11-19 09:59:41.258861+00', '2025-11-19 09:59:41.258861+00');
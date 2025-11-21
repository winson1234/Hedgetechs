-- Create forex_klines_1m table for 1-minute OHLC candles
-- Stores aggregated tick data from MT5 Publisher via Redis
CREATE TABLE forex_klines_1m (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,  -- Bar start time (e.g., 10:30:00)

    -- Bid prices (OHLC)
    open_bid  DECIMAL(18, 5) NOT NULL,
    high_bid  DECIMAL(18, 5) NOT NULL,
    low_bid   DECIMAL(18, 5) NOT NULL,
    close_bid DECIMAL(18, 5) NOT NULL,

    -- Ask prices (OHLC)
    open_ask  DECIMAL(18, 5) NOT NULL,
    high_ask  DECIMAL(18, 5) NOT NULL,
    low_ask   DECIMAL(18, 5) NOT NULL,
    close_ask DECIMAL(18, 5) NOT NULL,

    -- Number of ticks that made this bar
    volume INT DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Critical indexes for time-series queries
CREATE UNIQUE INDEX idx_forex_klines_symbol_timestamp
    ON forex_klines_1m(symbol, timestamp DESC);

-- Additional index for range queries
CREATE INDEX idx_forex_klines_timestamp
    ON forex_klines_1m(timestamp DESC);

-- Add comment for documentation
COMMENT ON TABLE forex_klines_1m IS 'Stores 1-minute OHLC candles for forex pairs from MT5. Aggregated from tick stream by forex_aggregator_service. Used for charting and 24h statistics calculation.';

-- ENUM: order_type
-- Description: Type of order

CREATE TYPE order_type AS ENUM (
    'market',
    'limit',
    'stop',
    'stop_limit'
);

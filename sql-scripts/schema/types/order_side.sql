-- ENUM: order_side
-- Description: Side of an order (buy or sell)

CREATE TYPE order_side AS ENUM (
    'buy',
    'sell'
);

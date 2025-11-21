-- ENUM: order_status
-- Description: Status of an order

CREATE TYPE order_status AS ENUM (
    'pending',
    'filled',
    'partially_filled',
    'cancelled',
    'rejected'
);

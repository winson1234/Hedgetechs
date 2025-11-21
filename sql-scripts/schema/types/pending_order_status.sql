-- ENUM: pending_order_status
-- Description: Status of a pending order

CREATE TYPE pending_order_status AS ENUM (
    'pending',
    'executed',
    'cancelled',
    'expired',
    'failed'
);

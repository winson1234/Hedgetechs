-- ENUM: order_execution_type
-- Description: Type of pending order execution

CREATE TYPE order_execution_type AS ENUM (
    'limit',
    'stop_limit'
);

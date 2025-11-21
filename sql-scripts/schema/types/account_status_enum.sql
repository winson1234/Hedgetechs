-- ENUM: account_status_enum
-- Description: Status of a trading account

CREATE TYPE account_status_enum AS ENUM (
    'active',
    'deactivated'
);

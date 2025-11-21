-- ENUM: account_type_enum
-- Description: Type of trading account (live or demo)

CREATE TYPE account_type_enum AS ENUM (
    'live',
    'demo'
);

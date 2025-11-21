-- ENUM: transaction_type
-- Description: Type of transaction

CREATE TYPE transaction_type AS ENUM (
    'deposit',
    'withdrawal',
    'transfer',
    'position_close'
);

-- ENUM: transaction_status
-- Description: Status of a transaction

CREATE TYPE transaction_status AS ENUM (
    'pending',
    'completed',
    'failed'
);

-- ENUM: contract_status
-- Description: Status of a CFD contract

CREATE TYPE contract_status AS ENUM (
    'open',
    'closed',
    'liquidated'
);

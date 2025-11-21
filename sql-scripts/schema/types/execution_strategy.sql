-- ENUM: execution_strategy
-- Description: Order execution strategy (B-Book or A-Book)

CREATE TYPE execution_strategy AS ENUM (
    'b_book',
    'a_book'
);

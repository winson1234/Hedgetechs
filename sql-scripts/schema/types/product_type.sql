-- ENUM: product_type
-- Description: Type of trading product

CREATE TYPE product_type AS ENUM (
    'spot',
    'cfd',
    'futures'
);

-- ENUM: admin_role_enum
-- Description: Administrative role types

CREATE TYPE admin_role_enum AS ENUM (
    'superadmin',
    'admin',
    'support',
    'developer'
);

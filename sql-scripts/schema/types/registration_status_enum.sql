-- ENUM: registration_status_enum
-- Description: Status of user registration

CREATE TYPE registration_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected'
);

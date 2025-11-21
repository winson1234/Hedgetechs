-- ENUM: kyc_status_enum
-- Description: KYC verification status

CREATE TYPE kyc_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected'
);

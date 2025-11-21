-- ENUM: kyc_document_type
-- Description: Types of KYC documents

CREATE TYPE kyc_document_type AS ENUM (
    'passport',
    'drivers_license',
    'national_id',
    'proof_of_address',
    'selfie'
);

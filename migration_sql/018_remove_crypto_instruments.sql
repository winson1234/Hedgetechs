-- ================================================================
-- Remove Crypto Instruments
-- ================================================================
-- This migration removes all crypto instruments, keeping only forex and commodities
-- ================================================================

-- Delete all crypto instruments
DELETE FROM instruments WHERE instrument_type = 'crypto';

-- Verify remaining instruments
DO $$
DECLARE
    remaining_count INTEGER;
    crypto_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_count FROM instruments;
    SELECT COUNT(*) INTO crypto_count FROM instruments WHERE instrument_type = 'crypto';
    
    RAISE NOTICE 'Remaining instruments: %', remaining_count;
    RAISE NOTICE 'Crypto instruments: %', crypto_count;
    
    IF crypto_count > 0 THEN
        RAISE EXCEPTION 'Crypto instruments still exist!';
    END IF;
END $$;

-- Show remaining instruments
SELECT 
    instrument_type,
    COUNT(*) as count
FROM instruments 
GROUP BY instrument_type
ORDER BY instrument_type;

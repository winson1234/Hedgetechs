-- Fix approved deposits that have pending transactions
-- This script fixes deposits that were approved but:
-- 1. Transaction status is still pending (should be completed)
-- 2. Transaction_id is NULL (should create transaction record)
-- 
-- NOTE: This script assumes balances were already credited when deposits were approved.
-- It only updates transaction status to match the approved deposit status.

DO $$
DECLARE
    deposit_record RECORD;
    transaction_exists BOOLEAN;
    transaction_status TEXT;
    account_currency TEXT;
    new_transaction_id UUID;
    transaction_number TEXT;
BEGIN
    -- Loop through all approved deposits
    FOR deposit_record IN 
        SELECT 
            d.id as deposit_id,
            d.account_id,
            d.user_id,
            d.reference_id,
            d.amount,
            d.currency,
            d.transaction_id,
            d.approved_at,
            d.approved_by
        FROM deposits d
        WHERE d.status = 'approved'
        AND d.approved_at IS NOT NULL
    LOOP
        -- Get account currency for validation
        SELECT currency INTO account_currency
        FROM accounts
        WHERE id = deposit_record.account_id;
        
        IF account_currency IS NULL THEN
            RAISE WARNING 'Account % not found for deposit %', deposit_record.account_id, deposit_record.reference_id;
            CONTINUE;
        END IF;
        
        -- Check if currency matches
        IF account_currency != deposit_record.currency THEN
            RAISE WARNING 'Currency mismatch for deposit %: deposit currency (%) does not match account currency (%)', 
                deposit_record.reference_id, deposit_record.currency, account_currency;
            CONTINUE;
        END IF;
        
        -- Case 1: Transaction exists but status is pending
        IF deposit_record.transaction_id IS NOT NULL THEN
            -- Check transaction status
            SELECT status INTO transaction_status
            FROM transactions
            WHERE id = deposit_record.transaction_id;
            
            IF transaction_status = 'pending' THEN
                -- Update transaction status to completed
                UPDATE transactions
                SET 
                    status = 'completed',
                    description = 'Deposit ' || deposit_record.reference_id || ' - ' || deposit_record.currency || ' ' || deposit_record.amount || ' (Approved & Credited)',
                    updated_at = NOW()
                WHERE id = deposit_record.transaction_id;
                
                RAISE NOTICE 'Updated transaction % from pending to completed for deposit %', 
                    deposit_record.transaction_id, deposit_record.reference_id;
            ELSIF transaction_status IS NULL THEN
                RAISE WARNING 'Transaction % not found for deposit %', deposit_record.transaction_id, deposit_record.reference_id;
            ELSE
                RAISE NOTICE 'Transaction % already has status % for deposit % (skipping)', 
                    deposit_record.transaction_id, transaction_status, deposit_record.reference_id;
            END IF;
        ELSE
            -- Case 2: No transaction_id - create transaction record
            -- Generate transaction number
            SELECT generate_transaction_number() INTO transaction_number;
            
            -- Create new transaction
            new_transaction_id := gen_random_uuid();
            INSERT INTO transactions (
                id, account_id, transaction_number, type, currency, amount, 
                status, description, metadata, created_at, updated_at
            )
            VALUES (
                new_transaction_id,
                deposit_record.account_id,
                transaction_number,
                'deposit',
                deposit_record.currency,
                deposit_record.amount,
                'completed',
                'Deposit ' || deposit_record.reference_id || ' - ' || deposit_record.currency || ' ' || deposit_record.amount || ' (Approved & Credited)',
                jsonb_build_object('deposit_id', deposit_record.deposit_id::text, 'reference_id', deposit_record.reference_id),
                deposit_record.approved_at, -- Use approved_at as created_at to maintain timeline
                NOW()
            );
            
            -- Link transaction to deposit
            UPDATE deposits
            SET transaction_id = new_transaction_id
            WHERE id = deposit_record.deposit_id;
            
            RAISE NOTICE 'Created transaction % for deposit % (was missing transaction_id)', 
                new_transaction_id, deposit_record.reference_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Fix script completed. Check logs above for details.';
END $$;


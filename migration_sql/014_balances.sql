-- ============================================
-- Balances Table Migration
-- ============================================
-- This table stores account balances for multi-currency support
-- Each account can have multiple currency balances

-- Create balances table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    currency text NOT NULL,
    amount numeric(20,8) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT balances_pkey PRIMARY KEY (id),
    CONSTRAINT balances_account_id_currency_key UNIQUE (account_id, currency),
    CONSTRAINT balances_account_id_fkey FOREIGN KEY (account_id) 
        REFERENCES public.accounts(id) ON DELETE CASCADE,
    CONSTRAINT balances_amount_check CHECK (amount >= 0)
) TABLESPACE pg_default;

-- Create index for faster account lookups
CREATE INDEX IF NOT EXISTS idx_balances_account_id 
    ON public.balances USING btree (account_id) 
    TABLESPACE pg_default;

-- Create index for currency lookups
CREATE INDEX IF NOT EXISTS idx_balances_currency 
    ON public.balances USING btree (currency) 
    TABLESPACE pg_default;

-- Create composite index for account+currency lookups
CREATE INDEX IF NOT EXISTS idx_balances_account_currency 
    ON public.balances USING btree (account_id, currency) 
    TABLESPACE pg_default;

-- ============================================
-- Triggers and Functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_balances_updated_at ON public.balances;
CREATE TRIGGER update_balances_updated_at 
    BEFORE UPDATE ON public.balances 
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to sync balance changes to accounts table
CREATE OR REPLACE FUNCTION public.sync_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- When balance is inserted or updated in balances table,
    -- sync it to accounts.balance if it's the primary currency
    UPDATE accounts 
    SET balance = NEW.amount, last_updated = NOW()
    WHERE id = NEW.account_id 
      AND currency = NEW.currency;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync balance insert to accounts table
DROP TRIGGER IF EXISTS trigger_sync_account_balance_insert ON public.balances;
CREATE TRIGGER trigger_sync_account_balance_insert 
    AFTER INSERT ON public.balances 
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_account_balance();

-- Trigger to sync balance update to accounts table
DROP TRIGGER IF EXISTS trigger_sync_account_balance_update ON public.balances;
CREATE TRIGGER trigger_sync_account_balance_update 
    AFTER UPDATE ON public.balances 
    FOR EACH ROW 
    WHEN (OLD.amount IS DISTINCT FROM NEW.amount)
    EXECUTE FUNCTION public.sync_account_balance();

-- ============================================
-- Data Migration: Sync existing accounts.balance to balances table
-- ============================================
-- This ensures any existing accounts have their balances in the balances table

DO $$
DECLARE
    account_record RECORD;
BEGIN
    -- For each account, ensure there's a balance entry in the balances table
    FOR account_record IN 
        SELECT id, currency, balance 
        FROM accounts 
        WHERE balance > 0
    LOOP
        -- Insert balance if it doesn't exist
        INSERT INTO balances (id, account_id, currency, amount, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            account_record.id,
            account_record.currency,
            account_record.balance,
            NOW(),
            NOW()
        )
        ON CONFLICT (account_id, currency) 
        DO UPDATE SET 
            amount = EXCLUDED.amount,
            updated_at = NOW()
        WHERE balances.amount <> EXCLUDED.amount;
    END LOOP;
    
    RAISE NOTICE 'Successfully synced account balances to balances table';
END $$;


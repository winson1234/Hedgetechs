-- Create withdrawal status enum
DO $$ BEGIN
    CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'processing', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create withdrawal method enum
DO $$ BEGIN
    CREATE TYPE public.withdrawal_method AS ENUM ('tron', 'bank_transfer', 'wire');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL,
  account_id uuid NOT NULL,
  reference_id text NOT NULL UNIQUE, -- Unique reference: WTH-YYYYMMDD-XXXXXX
  withdrawal_method public.withdrawal_method NOT NULL DEFAULT 'tron'::withdrawal_method,
  amount numeric(20, 8) NOT NULL, -- Original withdrawal amount requested
  fee_amount numeric(20, 8) NOT NULL DEFAULT 0, -- System/network fee
  net_amount numeric(20, 8) NOT NULL, -- Amount after fees (amount - fee_amount)
  currency text NOT NULL DEFAULT 'USD',
  withdrawal_details jsonb NULL, -- Withdrawal destination details (wallet address, bank info, etc.)
  status public.withdrawal_status NOT NULL DEFAULT 'pending'::withdrawal_status,
  transaction_id uuid NULL, -- Link to transactions table (ledger entry)
  admin_notes text NULL, -- Admin review notes
  
  -- Audit columns
  client_ip text NULL,
  admin_ip text NULL,
  approved_at timestamp with time zone NULL,
  rejected_at timestamp with time zone NULL,
  completed_at timestamp with time zone NULL,
  approved_by bigint NULL,
  rejected_by bigint NULL,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT withdrawals_pkey PRIMARY KEY (id),
  CONSTRAINT withdrawals_reference_id_key UNIQUE (reference_id),
  
  CONSTRAINT withdrawals_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.users(user_id) 
    ON DELETE CASCADE,
    
  CONSTRAINT withdrawals_account_id_fkey 
    FOREIGN KEY (account_id) 
    REFERENCES public.accounts(id) 
    ON DELETE CASCADE,
    
  CONSTRAINT withdrawals_transaction_id_fkey 
    FOREIGN KEY (transaction_id) 
    REFERENCES public.transactions(id) 
    ON DELETE SET NULL,
    
  CONSTRAINT withdrawals_approved_by_fkey 
    FOREIGN KEY (approved_by) 
    REFERENCES public.users(user_id) 
    ON DELETE SET NULL,
    
  CONSTRAINT withdrawals_rejected_by_fkey 
    FOREIGN KEY (rejected_by) 
    REFERENCES public.users(user_id) 
    ON DELETE SET NULL,
    
  CONSTRAINT withdrawals_amount_check CHECK (amount > 0),
  CONSTRAINT withdrawals_fee_amount_check CHECK (fee_amount >= 0),
  CONSTRAINT withdrawals_net_amount_check CHECK (net_amount > 0)
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id 
  ON public.withdrawals USING btree (user_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_withdrawals_account_id 
  ON public.withdrawals USING btree (account_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_withdrawals_reference_id 
  ON public.withdrawals USING btree (reference_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_withdrawals_status 
  ON public.withdrawals USING btree (status) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at 
  ON public.withdrawals USING btree (created_at DESC) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_withdrawals_transaction_id 
  ON public.withdrawals USING btree (transaction_id) 
  TABLESPACE pg_default;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_withdrawals_updated_at ON public.withdrawals;
CREATE TRIGGER update_withdrawals_updated_at 
  BEFORE UPDATE ON public.withdrawals 
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create sequence for withdrawal reference counter (per day)
CREATE SEQUENCE IF NOT EXISTS withdrawal_reference_counter
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Function to generate unique withdrawal reference ID (WTH-YYYYMMDD-XXXXXX)
CREATE OR REPLACE FUNCTION generate_withdrawal_reference_id()
RETURNS text AS $$
DECLARE
  date_prefix text;
  counter_val bigint;
  reference_id text;
BEGIN
  -- Format: WTH-YYYYMMDD-XXXXXX (6 digits for counter)
  date_prefix := 'WTH-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-';
  
  -- Get next counter value
  counter_val := nextval('withdrawal_reference_counter');
  
  -- Format counter as 6-digit zero-padded number
  reference_id := date_prefix || LPAD(counter_val::text, 6, '0');
  
  RETURN reference_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate withdrawal fee based on method and amount
CREATE OR REPLACE FUNCTION calculate_withdrawal_fee(
  p_method withdrawal_method,
  p_amount numeric
)
RETURNS numeric AS $$
DECLARE
  fee_amount numeric;
BEGIN
  -- Fee structure (customize as needed)
  CASE p_method
    WHEN 'tron' THEN
      -- Fixed fee for Tron TRC20 (e.g., 1 USDT network fee)
      fee_amount := 1.0;
    WHEN 'bank_transfer' THEN
      -- Percentage-based fee (e.g., 0.5% with min $5, max $50)
      fee_amount := GREATEST(5.0, LEAST(50.0, p_amount * 0.005));
    WHEN 'wire' THEN
      -- Fixed fee for wire transfer
      fee_amount := 25.0;
    ELSE
      -- Default fee
      fee_amount := 0.0;
  END CASE;
  
  RETURN fee_amount;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE public.withdrawals IS 'Stores withdrawal requests with admin approval workflow';
COMMENT ON COLUMN public.withdrawals.reference_id IS 'Human-readable withdrawal reference (WTH-YYYYMMDD-XXXXXX)';
COMMENT ON COLUMN public.withdrawals.amount IS 'Original withdrawal amount requested by user';
COMMENT ON COLUMN public.withdrawals.fee_amount IS 'System/network fee charged for withdrawal';
COMMENT ON COLUMN public.withdrawals.net_amount IS 'Net amount user receives (amount - fee_amount)';
COMMENT ON COLUMN public.withdrawals.withdrawal_details IS 'JSON object containing destination details (wallet address, bank account, etc.)';


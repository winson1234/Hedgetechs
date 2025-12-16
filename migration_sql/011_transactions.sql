-- Create required enum types
DO $$ BEGIN
    CREATE TYPE public.transaction_type AS ENUM ('deposit', 'withdrawal', 'trade', 'fee', 'adjustment', 'commission', 'swap', 'position_close', 'position_open', 'transfer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled', 'processing');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create or replace the update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Create transaction number sequence (for TXN-00001 format)
CREATE SEQUENCE IF NOT EXISTS public.transaction_number_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;

-- Function to generate transaction numbers (TXN-00001 format)
CREATE OR REPLACE FUNCTION public.generate_transaction_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_val BIGINT;
    new_transaction_number TEXT;
BEGIN
    SELECT nextval('public.transaction_number_seq') INTO next_val;
    new_transaction_number := 'TXN-' || LPAD(next_val::TEXT, 5, '0');

    IF EXISTS (SELECT 1 FROM transactions WHERE transaction_number = new_transaction_number) THEN
        RAISE EXCEPTION 'Transaction number collision detected: %', new_transaction_number;
    END IF;

    RETURN new_transaction_number;
END;
$$;

-- Create the transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),  
  account_id uuid NOT NULL,
  transaction_number text NOT NULL,
  type public.transaction_type NOT NULL,
  currency text NOT NULL,
  amount numeric(20, 8) NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'pending'::transaction_status,
  target_account_id uuid NULL,
  contract_id uuid NULL,
  description text NULL,
  metadata jsonb NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_transaction_number_key UNIQUE (transaction_number),
  
  CONSTRAINT transactions_account_id_fkey 
    FOREIGN KEY (account_id) 
    REFERENCES public.accounts(id) 
    ON DELETE CASCADE,
    
  CONSTRAINT transactions_target_account_id_fkey 
    FOREIGN KEY (target_account_id) 
    REFERENCES public.accounts(id) 
    ON DELETE SET NULL,
    
  CONSTRAINT transactions_contract_id_fkey 
    FOREIGN KEY (contract_id) 
    REFERENCES public.contracts(id) 
    ON DELETE SET NULL
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_account_created 
  ON public.transactions USING btree (account_id, created_at DESC) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_transactions_account_id 
  ON public.transactions USING btree (account_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_transactions_contract_id 
  ON public.transactions USING btree (contract_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_transactions_created_at 
  ON public.transactions USING btree (created_at DESC) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_transactions_target_account_id 
  ON public.transactions USING btree (target_account_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_transactions_transaction_number 
  ON public.transactions USING btree (transaction_number) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_transactions_type 
  ON public.transactions USING btree (type) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_transactions_status 
  ON public.transactions USING btree (status) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_transactions_currency 
  ON public.transactions USING btree (currency) 
  TABLESPACE pg_default;

-- Create trigger
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at 
  BEFORE UPDATE ON transactions 
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
-- Create deposit status enum
DO $$ BEGIN
    CREATE TYPE public.deposit_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create payment method enum (only Tron for now)
DO $$ BEGIN
    CREATE TYPE public.payment_method AS ENUM ('tron');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create deposits table
CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL,
  account_id uuid NOT NULL,
  reference_id text NOT NULL UNIQUE, -- Unique reference: DEP-YYYYMMDD-XXXXXX
  payment_method public.payment_method NOT NULL DEFAULT 'tron'::payment_method,
  amount numeric(20, 8) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  receipt_data bytea NULL, -- Receipt file stored as BLOB (binary data)
  receipt_mime_type text NULL, -- MIME type of the receipt (image/jpeg, image/png, application/pdf)
  payment_details jsonb NULL, -- Optional payment details (e.g., transaction hash, wallet address)
  status public.deposit_status NOT NULL DEFAULT 'pending'::deposit_status,
  transaction_id uuid NULL, -- Link to transactions table (ledger entry)
  admin_notes text NULL, -- Admin review notes
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT deposits_pkey PRIMARY KEY (id),
  CONSTRAINT deposits_reference_id_key UNIQUE (reference_id),
  
  CONSTRAINT deposits_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.users(user_id) 
    ON DELETE CASCADE,
    
  CONSTRAINT deposits_account_id_fkey 
    FOREIGN KEY (account_id) 
    REFERENCES public.accounts(id) 
    ON DELETE CASCADE,
    
  CONSTRAINT deposits_transaction_id_fkey 
    FOREIGN KEY (transaction_id) 
    REFERENCES public.transactions(id) 
    ON DELETE SET NULL,
    
  CONSTRAINT deposits_amount_check CHECK (amount > 0)
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_deposits_user_id 
  ON public.deposits USING btree (user_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_deposits_account_id 
  ON public.deposits USING btree (account_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_deposits_reference_id 
  ON public.deposits USING btree (reference_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_deposits_status 
  ON public.deposits USING btree (status) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_deposits_created_at 
  ON public.deposits USING btree (created_at DESC) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_deposits_transaction_id 
  ON public.deposits USING btree (transaction_id) 
  TABLESPACE pg_default;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_deposits_updated_at ON public.deposits;
CREATE TRIGGER update_deposits_updated_at 
  BEFORE UPDATE ON public.deposits 
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create sequence for deposit reference counter (per day)
CREATE SEQUENCE IF NOT EXISTS deposit_reference_counter
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Function to generate unique deposit reference ID (DEP-YYYYMMDD-XXXXXX)
CREATE OR REPLACE FUNCTION generate_deposit_reference_id()
RETURNS text AS $$
DECLARE
  date_prefix text;
  counter_val bigint;
  reference_id text;
BEGIN
  -- Format: DEP-YYYYMMDD-XXXXXX (6 digits for counter)
  date_prefix := 'DEP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-';
  
  -- Get next counter value
  counter_val := nextval('deposit_reference_counter');
  
  -- Format counter as 6-digit zero-padded number
  reference_id := date_prefix || LPAD(counter_val::text, 6, '0');
  
  RETURN reference_id;
END;
$$ LANGUAGE plpgsql;


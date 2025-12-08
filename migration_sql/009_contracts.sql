-- Create enum types if they don't exist
DO $$ BEGIN
    CREATE TYPE public.contract_side AS ENUM ('long', 'short');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.contract_status AS ENUM ('open', 'closed', 'liquidated', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Create contracts table
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL,
  account_id uuid NOT NULL,
  symbol text NOT NULL,
  contract_number text NOT NULL,
  side public.contract_side NOT NULL,
  status public.contract_status NOT NULL DEFAULT 'open'::contract_status,
  lot_size numeric(20, 8) NOT NULL,
  entry_price numeric(20, 8) NOT NULL,
  margin_used numeric(20, 8) NOT NULL,
  leverage integer NULL DEFAULT 1,
  tp_price numeric(20, 8) NULL,
  sl_price numeric(20, 8) NULL,
  close_price numeric(20, 8) NULL,
  pnl numeric(20, 8) NULL,
  swap numeric(20, 8) NULL DEFAULT 0,
  commission numeric(20, 8) NULL DEFAULT 0,
  created_at timestamp with time zone NULL DEFAULT now(),
  closed_at timestamp with time zone NULL,
  updated_at timestamp with time zone NULL DEFAULT now(),
  liquidation_price numeric(20, 8) NULL,
  pair_id uuid NULL,
  
  CONSTRAINT contracts_pkey PRIMARY KEY (id),
  CONSTRAINT contracts_contract_number_key UNIQUE (contract_number),
  CONSTRAINT contracts_lot_size_check CHECK ((lot_size > (0)::numeric)),
  CONSTRAINT contracts_entry_price_check CHECK ((entry_price > (0)::numeric)),
  CONSTRAINT contracts_margin_used_check CHECK ((margin_used > (0)::numeric)),
  CONSTRAINT contracts_leverage_check CHECK ((leverage > 0 AND leverage <= 1000)),
  CONSTRAINT contracts_tp_price_check CHECK ((tp_price IS NULL OR tp_price > (0)::numeric)),
  CONSTRAINT contracts_sl_price_check CHECK ((sl_price IS NULL OR sl_price > (0)::numeric)),
  CONSTRAINT contracts_close_price_check CHECK ((close_price IS NULL OR close_price > (0)::numeric)),
  CONSTRAINT contracts_liquidation_price_check CHECK ((liquidation_price IS NULL OR liquidation_price > (0)::numeric)),
  
  -- Foreign key constraints
  CONSTRAINT fk_contracts_user_id 
    FOREIGN KEY (user_id) 
    REFERENCES public.users(user_id) 
    ON DELETE CASCADE,
    
  CONSTRAINT fk_contracts_account_id 
    FOREIGN KEY (account_id) 
    REFERENCES public.accounts(id) 
    ON DELETE CASCADE,
    
  CONSTRAINT fk_contracts_symbol 
    FOREIGN KEY (symbol) 
    REFERENCES public.instruments(symbol) 
    ON DELETE RESTRICT
    
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contracts_account_id 
  ON public.contracts USING btree (account_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_contracts_contract_number 
  ON public.contracts USING btree (contract_number) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_contracts_created_at 
  ON public.contracts USING btree (created_at DESC) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_contracts_pair_id 
  ON public.contracts USING btree (pair_id) 
  TABLESPACE pg_default
  WHERE (pair_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_contracts_status 
  ON public.contracts USING btree (status) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_contracts_status_side 
  ON public.contracts USING btree (status, side) 
  TABLESPACE pg_default
  WHERE (status = 'open'::contract_status);

CREATE INDEX IF NOT EXISTS idx_contracts_symbol 
  ON public.contracts USING btree (symbol) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_contracts_symbol_status 
  ON public.contracts USING btree (symbol, status) 
  TABLESPACE pg_default
  WHERE (status = 'open'::contract_status);

CREATE INDEX IF NOT EXISTS idx_contracts_user_id 
  ON public.contracts USING btree (user_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_contracts_user_account 
  ON public.contracts USING btree (user_id, account_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_contracts_user_status 
  ON public.contracts USING btree (user_id, status) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_contracts_closed_at 
  ON public.contracts USING btree (closed_at DESC) 
  TABLESPACE pg_default
  WHERE (closed_at IS NOT NULL);

-- Create trigger
DROP TRIGGER IF EXISTS update_contracts_updated_at ON public.contracts;
CREATE TRIGGER update_contracts_updated_at 
  BEFORE UPDATE ON contracts 
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
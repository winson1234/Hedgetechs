-- Create required enum types
DO $$ BEGIN
    CREATE TYPE public.order_side AS ENUM ('buy', 'sell');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.order_type AS ENUM ('market', 'limit', 'stop', 'stop_limit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.order_status AS ENUM ('pending', 'filled', 'cancelled', 'rejected', 'partially_filled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.product_type AS ENUM ('spot', 'futures', 'forex', 'options', 'cfd');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.execution_strategy AS ENUM ('a_book', 'b_book');
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

-- Create the orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),  
  user_id bigint NOT NULL,
  account_id uuid NOT NULL,
  symbol text NOT NULL,
  order_number text NOT NULL,
  side public.order_side NOT NULL,
  type public.order_type NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending'::order_status,
  amount_base numeric(20, 8) NOT NULL,
  limit_price numeric(20, 8) NULL,
  stop_price numeric(20, 8) NULL,
  filled_amount numeric(20, 8) NULL DEFAULT 0,
  average_fill_price numeric(20, 8) NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  leverage integer NOT NULL DEFAULT 1,
  product_type public.product_type NOT NULL DEFAULT 'spot'::product_type,
  execution_strategy public.execution_strategy NOT NULL DEFAULT 'b_book'::execution_strategy,
  
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_order_number_key UNIQUE (order_number),
  
  CONSTRAINT fk_orders_user_id 
    FOREIGN KEY (user_id) 
    REFERENCES public.users(user_id) 
    ON DELETE CASCADE,
    
  CONSTRAINT fk_orders_account_id 
    FOREIGN KEY (account_id) 
    REFERENCES public.accounts(id) 
    ON DELETE CASCADE,
    
  CONSTRAINT fk_orders_symbol 
    FOREIGN KEY (symbol) 
    REFERENCES public.instruments(symbol) 
    ON DELETE RESTRICT
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_account_created 
  ON public.orders USING btree (account_id, created_at DESC) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_orders_account_id 
  ON public.orders USING btree (account_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_orders_created_at 
  ON public.orders USING btree (created_at DESC) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_orders_execution_strategy 
  ON public.orders USING btree (execution_strategy) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_orders_order_number 
  ON public.orders USING btree (order_number) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_orders_product_type 
  ON public.orders USING btree (product_type) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_orders_status 
  ON public.orders USING btree (status) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_orders_symbol 
  ON public.orders USING btree (symbol) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_orders_user_id 
  ON public.orders USING btree (user_id) 
  TABLESPACE pg_default;

-- Create trigger
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON orders 
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
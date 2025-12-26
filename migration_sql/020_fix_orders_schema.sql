-- Fix orders table schema: Add missing columns if they don't exist
-- This handles the case where 010_orders.sql was run in an early version without these columns

-- Ensure types exist
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

-- Add columns safely
DO $$ 
BEGIN 
    -- product_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'product_type') THEN
        ALTER TABLE public.orders ADD COLUMN product_type public.product_type NOT NULL DEFAULT 'spot'::product_type;
    END IF;

    -- execution_strategy
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'execution_strategy') THEN
        ALTER TABLE public.orders ADD COLUMN execution_strategy public.execution_strategy NOT NULL DEFAULT 'b_book'::execution_strategy;
    END IF;
    
    -- leverage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'leverage') THEN
        ALTER TABLE public.orders ADD COLUMN leverage integer NOT NULL DEFAULT 1;
    END IF;
END $$;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_orders_execution_strategy 
  ON public.orders USING btree (execution_strategy);

CREATE INDEX IF NOT EXISTS idx_orders_product_type 
  ON public.orders USING btree (product_type);

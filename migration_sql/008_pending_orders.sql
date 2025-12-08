-- Create enum types with proper error handling
DO $$ BEGIN
    CREATE TYPE public.order_execution_type AS ENUM ('market', 'limit', 'stop', 'stop_limit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.order_side AS ENUM ('buy', 'sell');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.pending_order_status AS ENUM ('pending', 'executed', 'cancelled', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.product_type AS ENUM ('spot', 'cfd', 'futures', 'forex', 'options');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.update_pending_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the pending_orders table
CREATE TABLE IF NOT EXISTS public.pending_orders (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id bigint NOT NULL, 
    account_id uuid NOT NULL,
    symbol text NOT NULL,
    type public.order_execution_type NOT NULL,
    side public.order_side NOT NULL,
    quantity numeric(20, 8) NOT NULL,
    trigger_price numeric(20, 8) NOT NULL,
    limit_price numeric(20, 8) NULL,
    status public.pending_order_status NOT NULL DEFAULT 'pending'::pending_order_status,
    executed_at timestamp with time zone NULL,
    executed_price numeric(20, 8) NULL,
    failure_reason text NULL,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    order_number text NULL,
    leverage integer NOT NULL DEFAULT 1,
    product_type public.product_type NOT NULL DEFAULT 'spot'::product_type,
    
    CONSTRAINT pending_orders_pkey PRIMARY KEY (id),
    CONSTRAINT pending_orders_quantity_check CHECK (quantity > 0::numeric),
    CONSTRAINT pending_orders_trigger_price_check CHECK (trigger_price > 0::numeric),
    CONSTRAINT pending_orders_leverage_check CHECK (leverage > 0 AND leverage <= 100),
    CONSTRAINT valid_limit_price CHECK (
        CASE 
            WHEN type IN ('limit'::order_execution_type, 'stop_limit'::order_execution_type) 
            THEN limit_price IS NOT NULL AND limit_price > 0
            ELSE limit_price IS NULL
        END
    ),
    
    -- Foreign key constraints
    CONSTRAINT fk_pending_orders_user_id 
        FOREIGN KEY (user_id) 
        REFERENCES public.users(user_id) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_pending_orders_account_id 
        FOREIGN KEY (account_id) 
        REFERENCES public.accounts(id) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_pending_orders_symbol 
        FOREIGN KEY (symbol) 
        REFERENCES public.instruments(symbol) 
        ON DELETE RESTRICT
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pending_orders_account_id 
    ON public.pending_orders USING btree (account_id) TABLESPACE pg_default;
    
CREATE INDEX IF NOT EXISTS idx_pending_orders_created_at 
    ON public.pending_orders USING btree (created_at DESC) TABLESPACE pg_default;
    
CREATE INDEX IF NOT EXISTS idx_pending_orders_order_number 
    ON public.pending_orders USING btree (order_number) TABLESPACE pg_default 
    WHERE order_number IS NOT NULL;
    
CREATE INDEX IF NOT EXISTS idx_pending_orders_status_symbol 
    ON public.pending_orders USING btree (status, symbol) TABLESPACE pg_default 
    WHERE status = 'pending'::pending_order_status;
    
CREATE INDEX IF NOT EXISTS idx_pending_orders_symbol_status 
    ON public.pending_orders USING btree (symbol, status) TABLESPACE pg_default 
    WHERE status = 'pending'::pending_order_status;
    
CREATE INDEX IF NOT EXISTS idx_pending_orders_user_id 
    ON public.pending_orders USING btree (user_id) TABLESPACE pg_default;
    
CREATE INDEX IF NOT EXISTS idx_pending_orders_user_account 
    ON public.pending_orders USING btree (user_id, account_id) TABLESPACE pg_default;
    
CREATE INDEX IF NOT EXISTS idx_pending_orders_status 
    ON public.pending_orders USING btree (status) TABLESPACE pg_default;
    
CREATE INDEX IF NOT EXISTS idx_pending_orders_symbol 
    ON public.pending_orders USING btree (symbol) TABLESPACE pg_default;
    
CREATE INDEX IF NOT EXISTS idx_pending_orders_executed_at 
    ON public.pending_orders USING btree (executed_at DESC) TABLESPACE pg_default 
    WHERE executed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pending_orders_product_type 
    ON public.pending_orders USING btree (product_type) TABLESPACE pg_default;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_pending_orders_updated_at ON public.pending_orders;
CREATE TRIGGER trigger_pending_orders_updated_at 
    BEFORE UPDATE ON public.pending_orders 
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pending_orders_updated_at();
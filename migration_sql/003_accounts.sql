CREATE TYPE public.account_status_enum AS ENUM (
    'active',
    'deactivated'
);

CREATE TYPE public.account_type_enum AS ENUM (
    'live',
    'demo'
);

CREATE SEQUENCE IF NOT EXISTS public.accounts_account_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE OR REPLACE FUNCTION public.update_accounts_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the accounts table
CREATE TABLE public.accounts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    account_type public.account_type_enum NOT NULL,
    currency character varying(3) NOT NULL DEFAULT 'USD'::character varying,
    balance numeric(20, 2) NOT NULL DEFAULT 0.00,
    status public.account_status_enum NOT NULL DEFAULT 'active'::account_status_enum,
    last_login timestamp with time zone NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_updated timestamp with time zone NOT NULL DEFAULT now(),
    account_id bigint NOT NULL DEFAULT nextval('accounts_account_id_seq'::regclass),
    user_id bigint NOT NULL,
    CONSTRAINT accounts_pkey PRIMARY KEY (id),
    CONSTRAINT accounts_account_id_key UNIQUE (account_id),
    CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) 
        REFERENCES public.users (user_id) ON DELETE CASCADE,
    CONSTRAINT accounts_balance_check CHECK (balance >= 0::numeric)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_accounts_account_type ON public.accounts USING btree (account_type) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON public.accounts USING btree (created_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_accounts_status ON public.accounts USING btree (status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_accounts_status_type ON public.accounts USING btree (status, account_type) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_accounts_user_status ON public.accounts USING btree (user_id, status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_accounts_user_type ON public.accounts USING btree (user_id, account_type) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_accounts_balance ON public.accounts USING btree (balance DESC) TABLESPACE pg_default
WHERE status = 'active'::account_status_enum;

CREATE INDEX IF NOT EXISTS idx_accounts_currency ON public.accounts USING btree (currency) TABLESPACE pg_default
WHERE currency != 'USD'::character varying;

CREATE TRIGGER trigger_update_accounts_last_updated 
BEFORE UPDATE ON public.accounts 
FOR EACH ROW
EXECUTE FUNCTION public.update_accounts_last_updated();
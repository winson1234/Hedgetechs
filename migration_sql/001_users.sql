CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE public.kyc_status_enum AS ENUM (
    'not_started',
    'pending',
    'rejected',
    'approved'
);

CREATE OR REPLACE FUNCTION public.update_users_last_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE public.users (
    user_id bigserial NOT NULL,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    hash_password text NOT NULL,
    phone_number character varying(50) NOT NULL,
    country character varying(100) NOT NULL,
    kyc_status public.kyc_status_enum NOT NULL DEFAULT 'not_started'::kyc_status_enum,
    is_active boolean NOT NULL DEFAULT true,
    last_login timestamp with time zone NULL,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_2fa_enabled boolean NOT NULL DEFAULT false,
    avatar_url text NULL,
    CONSTRAINT users_pkey PRIMARY KEY (user_id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_id_key UNIQUE (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_users_active_created ON public.users USING btree (is_active, created_at DESC) TABLESPACE pg_default
WHERE (is_active = true);

CREATE INDEX IF NOT EXISTS idx_users_active_kyc ON public.users USING btree (is_active, kyc_status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_users_country ON public.users USING btree (country) TABLESPACE pg_default
WHERE (country IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users USING btree (created_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_users_id ON public.users USING btree (id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users USING btree (is_active) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_users_kyc_created ON public.users USING btree (kyc_status, created_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON public.users USING btree (kyc_status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_users_name_email_trgm ON public.users USING gin (
    ((first_name::text || ' ' || last_name::text || ' ' || email::text)) gin_trgm_ops
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_users_2fa_enabled ON public.users USING btree (is_2fa_enabled) TABLESPACE pg_default
WHERE (is_2fa_enabled = true);

CREATE INDEX IF NOT EXISTS idx_users_avatar_url ON public.users USING btree (avatar_url) TABLESPACE pg_default
WHERE (avatar_url IS NOT NULL);

CREATE TRIGGER trigger_users_last_updated_at 
BEFORE UPDATE ON public.users 
FOR EACH ROW
EXECUTE FUNCTION public.update_users_last_updated_at();
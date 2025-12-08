CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE public.registration_status_enum AS ENUM (
    'pending',
    'rejected',
    'approved'
);

CREATE OR REPLACE FUNCTION public.update_pending_registrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE public.pending_registrations (
    id bigserial NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    phone_number character varying(50) NOT NULL,
    hash_password text NOT NULL,
    country character varying(100) NOT NULL,
    status public.registration_status_enum NOT NULL DEFAULT 'pending'::registration_status_enum,
    admin_id bigint NULL,
    reviewed_at timestamp with time zone NULL,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pending_registrations_pkey PRIMARY KEY (id),
    CONSTRAINT pending_registrations_email_key UNIQUE (email)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_pending_reg_admin_id ON public.pending_registrations USING btree (admin_id) TABLESPACE pg_default
WHERE (admin_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_pending_reg_created_at ON public.pending_registrations USING btree (created_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_pending_reg_name_email_trgm ON public.pending_registrations USING gin (
    ((first_name::text || ' ' || last_name::text || ' ' || email::text)) gin_trgm_ops
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_pending_reg_status ON public.pending_registrations USING btree (status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_pending_reg_status_created ON public.pending_registrations USING btree (status, created_at DESC) TABLESPACE pg_default
WHERE (status = 'pending'::registration_status_enum);

CREATE TRIGGER trigger_pending_registrations_updated_at 
BEFORE UPDATE ON public.pending_registrations 
FOR EACH ROW
EXECUTE FUNCTION public.update_pending_registrations_updated_at();

ALTER TABLE public.pending_registrations 
ADD CONSTRAINT fk_pending_registrations_admin 
FOREIGN KEY (admin_id) 
REFERENCES public.admins(admin_id) 
ON DELETE SET NULL;
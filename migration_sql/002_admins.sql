CREATE TYPE public.admin_role_enum AS ENUM (
    'superadmin',
    'admin',
    'support',
    'developer'
);

CREATE OR REPLACE FUNCTION public.update_admins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE public.admins (
    admin_id bigserial NOT NULL,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    username character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone_number character varying(50) NULL,
    hash_password character varying(255) NOT NULL,
    role public.admin_role_enum NOT NULL DEFAULT 'admin'::admin_role_enum,
    last_login timestamp with time zone NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT admins_pkey PRIMARY KEY (admin_id),
    CONSTRAINT admins_email_key UNIQUE (email),
    CONSTRAINT admins_id_key UNIQUE (id),
    CONSTRAINT admins_username_key UNIQUE (username)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_admins_created_at ON public.admins USING btree (created_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins USING btree (email) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_admins_id ON public.admins USING btree (id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_admins_is_active ON public.admins USING btree (is_active) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_admins_role ON public.admins USING btree (role) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_admins_role_active_created ON public.admins USING btree (role, is_active, created_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_admins_username ON public.admins USING btree (username) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_admins_username_email_trgm ON public.admins USING gin (
    (((username)::text || ' '::text) || (email)::text) gin_trgm_ops
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_admins_active_role ON public.admins 
USING btree (is_active, role) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_admins_last_login ON public.admins 
USING btree (last_login DESC NULLS LAST) 
WHERE is_active = true;

CREATE TRIGGER trigger_admins_updated_at 
BEFORE UPDATE ON public.admins 
FOR EACH ROW
EXECUTE FUNCTION public.update_admins_updated_at();

INSERT INTO public.admins (
    admin_id, id, username, email, phone_number, 
    hash_password, role, last_login, is_active, 
    created_at, updated_at
) VALUES 
    (1, 'e5a7ec48-36ef-45d3-9b58-c91c3190231d', 'superadmin', 'superadmin@admin.com', '+1234567890', 
     '$2a$10$tJ2vIEaIlzVYCWFwWSJKpu483DoTvHCpBMUX9.us1Zz4rYxvWwg4a', 'superadmin', '2025-12-04 06:07:55.23871+00', 
     true, '2025-11-19 07:16:21.902791+00', '2025-12-04 06:07:55.23871+00'),
    
    (2, '2babe861-bbd7-450f-8c42-3a91a4e39a51', 'admin1', 'admin1@admin.com', '+1987654321', 
     '$2a$10$tJ2vIEaIlzVYCWFwWSJKpu483DoTvHCpBMUX9.us1Zz4rYxvWwg4a', 'admin', '2025-12-03 01:56:27.161286+00', 
     true, '2025-11-19 07:16:21.902791+00', '2025-12-03 01:56:27.161286+00'),
    
    (3, 'cf3e0839-ace7-4e41-962b-400d21ec8ceb', 'support1', 'support1@admin.com', '+1122334455', 
     '$2a$10$tJ2vIEaIlzVYCWFwWSJKpu483DoTvHCpBMUX9.us1Zz4rYxvWwg4a', 'support', NULL, 
     true, '2025-11-19 07:16:21.902791+00', '2025-11-19 07:16:21.902791+00'),
    
    (4, 'f51c8503-476c-47a0-a01d-d11d9a42ce74', 'dev1', 'dev1@admin.com', '+1555666777', 
     '$2a$10$tJ2vIEaIlzVYCWFwWSJKpu483DoTvHCpBMUX9.us1Zz4rYxvWwg4a', 'developer', NULL, 
     true, '2025-11-19 07:16:21.902791+00', '2025-11-19 07:16:21.902791+00'),
    
    (5, '70596a16-ad58-4cd8-9846-ecd90832bdbc', 'admin2', 'admin2@admin.com', '1234567890', 
     '$2a$10$A2FWkV6Xlx6jgA5dzypZs.4iwhftsJI5NvNETzmn3rbcr9UKRBnt2', 'admin', NULL, 
     true, '2025-11-20 06:59:15.796693+00', '2025-12-01 10:17:23.375526+00');
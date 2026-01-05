-- Create enum for user types
CREATE TYPE public.user_type_enum AS ENUM ('trader', 'agent');

-- Add user_type column to users table with default value 'trader'
ALTER TABLE public.users
ADD COLUMN user_type public.user_type_enum NOT NULL DEFAULT 'trader'::public.user_type_enum;

-- Create index for user_type
CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users USING btree (user_type) TABLESPACE pg_default;
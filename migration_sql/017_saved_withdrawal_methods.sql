-- Create saved withdrawal methods table
CREATE TABLE IF NOT EXISTS public.saved_withdrawal_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL,
  withdrawal_method public.withdrawal_method NOT NULL,
  nickname text NULL, -- User-friendly name (e.g., "My Main Wallet", "Chase Bank")
  withdrawal_details jsonb NOT NULL, -- Withdrawal destination details (wallet address, bank info)
  is_default boolean NOT NULL DEFAULT false,
  last_used_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT saved_withdrawal_methods_pkey PRIMARY KEY (id),
  
  CONSTRAINT saved_withdrawal_methods_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.users(user_id) 
    ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_saved_withdrawal_methods_user_id 
  ON public.saved_withdrawal_methods USING btree (user_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_saved_withdrawal_methods_method 
  ON public.saved_withdrawal_methods USING btree (withdrawal_method) 
  TABLESPACE pg_default;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_saved_withdrawal_methods_updated_at ON public.saved_withdrawal_methods;
CREATE TRIGGER update_saved_withdrawal_methods_updated_at 
  BEFORE UPDATE ON public.saved_withdrawal_methods 
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.saved_withdrawal_methods IS 'Stores saved withdrawal methods for quick reuse';
COMMENT ON COLUMN public.saved_withdrawal_methods.nickname IS 'User-friendly name for this withdrawal method';
COMMENT ON COLUMN public.saved_withdrawal_methods.is_default IS 'Whether this is the default method for this withdrawal type';


-- Add audit tracking columns to deposits table
-- These columns track IP addresses, approval/rejection timestamps, and who approved/rejected

ALTER TABLE public.deposits
ADD COLUMN IF NOT EXISTS client_ip inet NULL,
ADD COLUMN IF NOT EXISTS admin_ip inet NULL,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone NULL,
ADD COLUMN IF NOT EXISTS approved_by bigint NULL,
ADD COLUMN IF NOT EXISTS rejected_by bigint NULL;

-- Add foreign key constraints for admin user references
ALTER TABLE public.deposits
ADD CONSTRAINT deposits_approved_by_fkey 
  FOREIGN KEY (approved_by) 
  REFERENCES public.users(user_id) 
  ON DELETE SET NULL;

ALTER TABLE public.deposits
ADD CONSTRAINT deposits_rejected_by_fkey 
  FOREIGN KEY (rejected_by) 
  REFERENCES public.users(user_id) 
  ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_deposits_approved_at 
  ON public.deposits USING btree (approved_at DESC) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_deposits_rejected_at 
  ON public.deposits USING btree (rejected_at DESC) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_deposits_approved_by 
  ON public.deposits USING btree (approved_by) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_deposits_rejected_by 
  ON public.deposits USING btree (rejected_by) 
  TABLESPACE pg_default;

-- Add comments for documentation
COMMENT ON COLUMN public.deposits.client_ip IS 'IP address of the client when deposit was created';
COMMENT ON COLUMN public.deposits.admin_ip IS 'IP address of the admin when deposit was approved/rejected';
COMMENT ON COLUMN public.deposits.approved_at IS 'Timestamp when deposit was approved';
COMMENT ON COLUMN public.deposits.rejected_at IS 'Timestamp when deposit was rejected';
COMMENT ON COLUMN public.deposits.approved_by IS 'User ID of admin who approved the deposit';
COMMENT ON COLUMN public.deposits.rejected_by IS 'User ID of admin who rejected the deposit';


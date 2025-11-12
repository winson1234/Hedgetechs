-- Rollback production features

-- Drop function
DROP FUNCTION IF EXISTS log_audit_event(UUID, TEXT, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT);

-- Drop trigger
DROP TRIGGER IF EXISTS update_pending_orders_updated_at ON public.pending_orders;

-- Drop tables
DROP TABLE IF EXISTS public.pending_orders CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- Drop types
DROP TYPE IF EXISTS pending_order_status;
DROP TYPE IF EXISTS order_execution_type;

-- Remove columns from accounts table
ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS access_count,
  DROP COLUMN IF EXISTS last_accessed_at,
  DROP COLUMN IF EXISTS icon,
  DROP COLUMN IF EXISTS color,
  DROP COLUMN IF EXISTS nickname;

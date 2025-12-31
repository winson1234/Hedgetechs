ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pair_id uuid NULL;
CREATE INDEX IF NOT EXISTS idx_orders_pair_id ON public.orders USING btree (pair_id);

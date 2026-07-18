-- Add minimum_probability to shops
-- Default 5 means every prize must have a weight >= 5 (treated as a %).
-- Range 0–100; 0 = no minimum enforced.
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS minimum_probability NUMERIC DEFAULT 5
    CHECK (minimum_probability >= 0 AND minimum_probability <= 100);

-- Back-fill any shops that slipped through with NULL
UPDATE public.shops
  SET minimum_probability = 5
  WHERE minimum_probability IS NULL;

-- Audit log for admin-controlled shop settings changes
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID        NOT NULL,
  shop_id       UUID        REFERENCES public.shops(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: no client-side access — admin server functions use supabaseAdmin (service role)
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop and recreate to be idempotent
DROP POLICY IF EXISTS "no_client_access" ON public.admin_audit_log;
CREATE POLICY "no_client_access" ON public.admin_audit_log USING (false);

-- Index for quick per-shop audit queries
CREATE INDEX IF NOT EXISTS admin_audit_log_shop_id_idx ON public.admin_audit_log (shop_id, created_at DESC);

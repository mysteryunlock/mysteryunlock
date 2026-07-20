-- ============================================================
-- PENDING MIGRATIONS — apply via psql or Supabase SQL editor
-- Generated: 2026-07-20
-- Missing from live schema:
--   1. marketing_broadcasts: drop old status CHECK, add scheduled/cancelled states + scheduled_at column
--   2. marketing_templates table (new)
--   3. admin_audit_log table (new)
-- ============================================================

BEGIN;

-- ── Migration 20260706200000: Marketing Templates & Scheduling ────────────────

-- 1a. Drop old narrow status CHECK on marketing_broadcasts
ALTER TABLE public.marketing_broadcasts
  DROP CONSTRAINT IF EXISTS marketing_broadcasts_status_check;

-- 1b. Broader constraint including scheduling states
ALTER TABLE public.marketing_broadcasts
  ADD CONSTRAINT marketing_broadcasts_status_check
  CHECK (status IN ('sent', 'partial', 'failed', 'opened', 'scheduled', 'cancelled'));

-- 1c. Add scheduled_at column
ALTER TABLE public.marketing_broadcasts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- 1d. Index for upcoming scheduled broadcasts
CREATE INDEX IF NOT EXISTS idx_mkt_broadcasts_scheduled
  ON public.marketing_broadcasts (shop_id, scheduled_at)
  WHERE status = 'scheduled';

-- 2. Create marketing_templates table
CREATE TABLE IF NOT EXISTS public.marketing_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  category   TEXT        NOT NULL DEFAULT 'Custom',
  subject    TEXT,
  body       TEXT        NOT NULL DEFAULT '',
  favorite   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_templates_shop
  ON public.marketing_templates (shop_id);

CREATE INDEX IF NOT EXISTS idx_mkt_templates_fav
  ON public.marketing_templates (shop_id, favorite)
  WHERE favorite = TRUE;

CREATE INDEX IF NOT EXISTS idx_mkt_templates_created
  ON public.marketing_templates (shop_id, created_at DESC);

ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own templates" ON public.marketing_templates;

CREATE POLICY "Owners manage own templates"
  ON public.marketing_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops
      WHERE shops.id = marketing_templates.shop_id
        AND shops.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops
      WHERE shops.id = marketing_templates.shop_id
        AND shops.owner_user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_templates TO authenticated;
GRANT ALL ON public.marketing_templates TO service_role;

-- ── Migration 20260718100000 (partial): admin_audit_log table ─────────────────
-- (minimum_probability column on shops already exists in live DB)

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID        NOT NULL,
  shop_id       UUID        REFERENCES public.shops(id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "no_client_access" ON public.admin_audit_log;
CREATE POLICY "no_client_access" ON public.admin_audit_log USING (false);

GRANT ALL ON public.admin_audit_log TO service_role;

CREATE INDEX IF NOT EXISTS admin_audit_log_shop_id_idx
  ON public.admin_audit_log (shop_id, created_at DESC);

COMMIT;

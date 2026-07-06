-- Phase 3.4.5 — Marketing Templates & Scheduling Foundation
-- 1. Extend marketing_broadcasts: add 'scheduled'/'cancelled' status values + scheduled_at column
-- 2. Create marketing_templates table with owner-only RLS

BEGIN;

-- ── 1. Extend marketing_broadcasts ───────────────────────────────────────────

-- Drop old narrow status CHECK (was: sent | partial | failed | opened)
ALTER TABLE public.marketing_broadcasts
  DROP CONSTRAINT IF EXISTS marketing_broadcasts_status_check;

-- Broader constraint that includes scheduling states
ALTER TABLE public.marketing_broadcasts
  ADD CONSTRAINT marketing_broadcasts_status_check
  CHECK (status IN ('sent', 'partial', 'failed', 'opened', 'scheduled', 'cancelled'));

-- Column for the future send time
ALTER TABLE public.marketing_broadcasts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Partial index for efficient "upcoming scheduled" queries
CREATE INDEX IF NOT EXISTS idx_mkt_broadcasts_scheduled
  ON public.marketing_broadcasts (shop_id, scheduled_at)
  WHERE status = 'scheduled';

-- ── 2. Create marketing_templates ────────────────────────────────────────────

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

COMMIT;

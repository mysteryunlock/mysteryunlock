-- Composite index for the hot path in spinAndRecord:
-- every spin does UPDATE/SELECT WHERE shop_id = $1 AND code = $2
CREATE INDEX IF NOT EXISTS access_codes_shop_code_idx
  ON public.access_codes (shop_id, code);

-- Index for campaign resolution by slug (used in validateAccessCode + spinAndRecord)
CREATE INDEX IF NOT EXISTS campaigns_shop_slug_active_idx
  ON public.campaigns (shop_id, slug)
  WHERE is_active = true;

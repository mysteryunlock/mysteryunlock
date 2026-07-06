-- Marketing broadcasts: persists every completed broadcast for history + audit trail.
-- Owners access only their own shop's broadcasts via RLS.

CREATE TABLE IF NOT EXISTS public.marketing_broadcasts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          uuid        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  channel          text        NOT NULL CHECK (channel IN ('sms','whatsapp','email')),
  name             text,
  subject          text,
  body             text        NOT NULL DEFAULT '',
  segment_filter   text        NOT NULL DEFAULT 'all',
  campaign_id      uuid        REFERENCES public.campaigns(id) ON DELETE SET NULL,
  recipient_count  int         NOT NULL DEFAULT 0,
  sent_count       int         NOT NULL DEFAULT 0,
  failed_count     int         NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'sent'
                   CHECK (status IN ('sent','partial','failed','opened')),
  sent_at          timestamptz,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Primary query pattern: list all broadcasts for a shop ordered by recency
CREATE INDEX IF NOT EXISTS marketing_broadcasts_shop_created_idx
  ON public.marketing_broadcasts (shop_id, created_at DESC);

ALTER TABLE public.marketing_broadcasts ENABLE ROW LEVEL SECURITY;

-- Shop owners may read their own broadcasts
CREATE POLICY "Owners read own broadcasts"
  ON public.marketing_broadcasts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops
      WHERE shops.id = marketing_broadcasts.shop_id
        AND shops.owner_user_id = auth.uid()
    )
  );

-- Shop owners may insert broadcasts for their own shops
CREATE POLICY "Owners insert own broadcasts"
  ON public.marketing_broadcasts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops
      WHERE shops.id = marketing_broadcasts.shop_id
        AND shops.owner_user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT ON public.marketing_broadcasts TO authenticated;
GRANT ALL ON public.marketing_broadcasts TO service_role;

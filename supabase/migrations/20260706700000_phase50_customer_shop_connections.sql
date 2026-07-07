-- Phase 5.0: Customer <-> Shop Connection
--
-- Purely additive schema extension — reuses existing customers / shops /
-- shop_customers tables. No new tables, no RLS policy changes, no changes to
-- existing columns, functions, or frozen server logic.
--
-- Adds:
--   shop_customers.status, .last_visit, .created_at, .updated_at
--     — lets a shop see membership status and recency without touching
--       access_codes (which stays fully locked per Phase 4.3 audit).
--   shops.connect_code       — short human-friendly code for the "scan to
--                               connect" QR flow (independent of the shop's
--                               public slug, so owners can regenerate it
--                               without breaking bookmarked /s/{slug} links).
--   customers.connect_code   — permanent per-customer code shown on the
--                               customer's "My QR Code" page.
--
-- RLS: no new policies needed.
--   - shops.connect_code is covered by the existing "Public read active shops"
--     policy (same table, same row-level rule, just a new column).
--   - customers.connect_code is covered by "Customers read own profile".
--   - shop_customers new columns are covered by the existing owner/customer
--     SELECT policies. INSERT/UPDATE remain service-role only, matching the
--     existing "reserved for service-role server functions" pattern used by
--     customerVerifyOtpFn.
-- ============================================================================


-- ── 1. shop_customers: membership bookkeeping ─────────────────────────────────

ALTER TABLE public.shop_customers
  ADD COLUMN IF NOT EXISTS status     text        NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_visit timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rows so created_at/last_visit reflect their true history
-- instead of "now()" for every pre-existing junction row.
UPDATE public.shop_customers
SET created_at = first_seen,
    last_visit = first_seen
WHERE created_at IS DISTINCT FROM first_seen
   OR last_visit IS NULL;

-- Constrain status to a known set of values (additive check, safe default).
ALTER TABLE public.shop_customers
  DROP CONSTRAINT IF EXISTS shop_customers_status_check;
ALTER TABLE public.shop_customers
  ADD CONSTRAINT shop_customers_status_check
  CHECK (status IN ('active', 'inactive'));

-- Auto-maintain updated_at (reuses the shared trigger fn already used by
-- shops/customers — defined in an earlier migration).
DROP TRIGGER IF EXISTS update_shop_customers_updated_at ON public.shop_customers;
CREATE TRIGGER update_shop_customers_updated_at
  BEFORE UPDATE ON public.shop_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── 2. shops: connect code for the business-generated QR ─────────────────────

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS connect_code text;

CREATE UNIQUE INDEX IF NOT EXISTS shops_connect_code_idx
  ON public.shops (connect_code)
  WHERE connect_code IS NOT NULL;

-- Backfill: generate an 8-char uppercase code per existing shop.
-- Collisions are astronomically unlikely at this scale; loop guards anyway.
DO $$
DECLARE
  r RECORD;
  new_code text;
  attempts int;
BEGIN
  FOR r IN SELECT id FROM public.shops WHERE connect_code IS NULL LOOP
    attempts := 0;
    LOOP
      new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      attempts := attempts + 1;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.shops WHERE connect_code = new_code) OR attempts > 10;
    END LOOP;
    UPDATE public.shops SET connect_code = new_code WHERE id = r.id;
  END LOOP;
END $$;


-- ── 3. customers: permanent member connect code ───────────────────────────────

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS connect_code text;

CREATE UNIQUE INDEX IF NOT EXISTS customers_connect_code_idx
  ON public.customers (connect_code)
  WHERE connect_code IS NOT NULL;

DO $$
DECLARE
  r RECORD;
  new_code text;
  attempts int;
BEGIN
  FOR r IN SELECT id FROM public.customers WHERE connect_code IS NULL LOOP
    attempts := 0;
    LOOP
      new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      attempts := attempts + 1;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.customers WHERE connect_code = new_code) OR attempts > 10;
    END LOOP;
    UPDATE public.customers SET connect_code = new_code WHERE id = r.id;
  END LOOP;
END $$;


-- ── 4. Phone search performance for the business "Customers" section ─────────

CREATE INDEX IF NOT EXISTS customers_phone_idx
  ON public.customers (phone)
  WHERE phone IS NOT NULL;

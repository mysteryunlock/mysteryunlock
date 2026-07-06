-- Phase 4.4: Customer Portal — prize_claims table
--
-- One row per (customer, spin code) where the customer chose to save their
-- prize claim for in-store redemption. The claim_code is a unique hex string
-- that serves as the redemption identifier (shown as QR in the customer portal).
--
-- Status lifecycle:
--   unclaimed → (customer has claim but hasn't redeemed yet)
--   claimed   → (shop owner marks as redeemed in dashboard)
--   expired   → (optional TTL — set by server fn if expires_at has passed)
--
-- RLS strategy:
--   customers: SELECT own claims (via customers.auth_user_id join).
--   shop owners: SELECT + UPDATE claims for their shop (status + claimed_at).
--   INSERT and DELETE are service-role only (server functions).
--   No public policy — verifyClaimCode uses service role in the server fn.
--
-- FK note: access_codes has a composite PK (shop_id, code) — migration
-- 20260619094512 dropped the original single-column PK on code and replaced
-- it with the composite. The FK from prize_claims therefore references both
-- columns together, which also makes semantic sense (a code is shop-scoped).
-- ============================================================================

CREATE TABLE public.prize_claims (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid        NOT NULL REFERENCES public.shops(id)     ON DELETE CASCADE,
  customer_id uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  -- code is NOT given an inline FK here because access_codes has a composite
  -- PK (shop_id, code). The table-level constraint below references both.
  code        text        NOT NULL,
  prize_name  text        NOT NULL,
  status      text        NOT NULL DEFAULT 'unclaimed'
                          CHECK (status IN ('unclaimed', 'claimed', 'expired')),
  claimed_at  timestamptz,
  expires_at  timestamptz,
  -- 24-char hex string generated at insert time; unique across all claims.
  -- Encodes no personal data — safe to embed in a QR code shown in-store.
  claim_code  text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- One claim per spin per customer — idempotent re-submits from the app are safe.
  UNIQUE (customer_id, code),
  -- Composite FK mirrors the composite PK on access_codes(shop_id, code).
  FOREIGN KEY (shop_id, code)
    REFERENCES public.access_codes(shop_id, code)
    ON DELETE CASCADE
);

CREATE INDEX prize_claims_customer_id_idx
  ON public.prize_claims (customer_id);

CREATE INDEX prize_claims_shop_id_idx
  ON public.prize_claims (shop_id);

-- Partial index: fast scan for active claims only.
CREATE INDEX prize_claims_unclaimed_idx
  ON public.prize_claims (shop_id, created_at DESC)
  WHERE status = 'unclaimed';


-- ── RLS ──────────────────────────────────────────────────────────────────────

-- SELECT + UPDATE only for authenticated roles.
-- INSERT and DELETE are service-role only.
GRANT SELECT ON public.prize_claims TO authenticated;
GRANT UPDATE (status, claimed_at) ON public.prize_claims TO authenticated;

-- Explicitly revoke INSERT / DELETE / TRUNCATE from JWT roles.
-- RLS already denies these by default (no policies), but this makes the
-- intent unambiguous regardless of Supabase default privilege changes.
REVOKE INSERT, DELETE, TRUNCATE ON public.prize_claims FROM authenticated, anon;

ALTER TABLE public.prize_claims ENABLE ROW LEVEL SECURITY;

-- Customer reads their own claims.
CREATE POLICY "Customers read own claims"
  ON public.prize_claims FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.customers c
      WHERE  c.id            = prize_claims.customer_id
        AND  c.auth_user_id  = auth.uid()
    )
  );

-- Shop owner reads all claims for their shop(s).
CREATE POLICY "Owners read their shop claims"
  ON public.prize_claims FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.shops s
      WHERE  s.id            = prize_claims.shop_id
        AND  s.owner_user_id = auth.uid()
    )
  );

-- Shop owner may update status + claimed_at (to mark a prize as redeemed).
-- The GRANT above restricts which columns can be changed.
CREATE POLICY "Owners update claim status"
  ON public.prize_claims FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.shops s
      WHERE  s.id            = prize_claims.shop_id
        AND  s.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.shops s
      WHERE  s.id            = prize_claims.shop_id
        AND  s.owner_user_id = auth.uid()
    )
  );

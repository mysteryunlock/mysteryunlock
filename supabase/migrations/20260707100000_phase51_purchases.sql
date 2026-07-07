-- Phase 5.1: Purchase Recording
--
-- Additive: one new table. No changes to existing tables, RLS policies, server
-- functions, auth, or validation. Follows the same service-role-for-writes
-- pattern established in Phase 5.0.
--
-- RLS strategy:
--   • Business owners: SELECT on their own shop's purchases (via shops.owner_user_id).
--   • Customers: SELECT their own purchases (via customers.auth_user_id).
--   • Super admin: SELECT all.
--   • INSERT / UPDATE / DELETE: service_role only (server functions use supabaseAdmin).
--
-- Security: amount is calculated-only; totals are never stored.
-- ============================================================================

CREATE TABLE public.purchases (
  id          uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid           NOT NULL REFERENCES public.shops(id)     ON DELETE CASCADE,
  customer_id uuid           NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount      numeric(12,2)  NOT NULL CHECK (amount > 0),
  category    text           NOT NULL DEFAULT 'General',
  notes       text,
  created_by  uuid           NOT NULL,  -- auth.uid() of the owner who recorded the purchase
  created_at  timestamptz    NOT NULL DEFAULT now()
);

-- Composite index for the two primary query shapes:
--   1. All purchases for a customer in a shop (business dashboard)
--   2. All purchases for a customer across shops (customer portal)
CREATE INDEX purchases_shop_customer_created_idx
  ON public.purchases (shop_id, customer_id, created_at DESC);

CREATE INDEX purchases_customer_created_idx
  ON public.purchases (customer_id, created_at DESC);

CREATE INDEX purchases_shop_created_idx
  ON public.purchases (shop_id, created_at DESC);


-- ── Privileges ────────────────────────────────────────────────────────────────

-- authenticated role may SELECT (RLS below restricts to own rows).
-- INSERT / UPDATE / DELETE are service_role only — server functions use supabaseAdmin.
GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL    ON public.purchases TO service_role;


-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Business owner reads all purchases for their own shop.
CREATE POLICY "Owners read their shop purchases"
  ON public.purchases FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE  s.id            = purchases.shop_id
        AND  s.owner_user_id = auth.uid()
    )
  );

-- Customer reads their own purchases (across all shops).
CREATE POLICY "Customers read own purchases"
  ON public.purchases FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE  c.id           = purchases.customer_id
        AND  c.auth_user_id = auth.uid()
    )
  );

-- Super admin reads everything.
CREATE POLICY "Super admin read all purchases"
  ON public.purchases FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE  ur.user_id = auth.uid()
        AND  ur.role    = 'super_admin'
    )
  );

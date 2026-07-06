-- Phase 4.3: Customer Authentication — Database Schema Foundation
--
-- Creates:
--   public.customers         — global customer identity (email-keyed, optional Supabase Auth account)
--   public.shop_customers    — junction: which customers have interacted with which shop
--   access_codes.customer_id — nullable FK backlink from a spin event to a customer identity
--
-- RLS strategy:
--   customers:      authenticated customers SELECT/UPDATE their own row;
--                   shop owners SELECT customers who have a shop_customers row for their shop.
--                   INSERT/DELETE reserved for service-role server functions only.
--   shop_customers: shop owners SELECT rows for their shop;
--                   customers SELECT their own junction rows.
--                   INSERT/DELETE reserved for service-role server functions only.
--   access_codes:   NO CHANGE — remains fully locked (service-role only, REVOKE ALL on
--                   anon/authenticated). customer_id is structural; populated by server functions.
-- ============================================================================


-- ── 1. customers ─────────────────────────────────────────────────────────────
--
-- auth_user_id is NULL until the customer creates a Supabase Auth account.
-- Multiple NULLs are permitted by Postgres UNIQUE (each NULL is distinct),
-- so anonymous/pre-signup customer rows can coexist without conflict.

CREATE TABLE public.customers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email        text        NOT NULL,
  phone        text,
  name         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive unique email — the natural upsert key when a customer OTPs in.
-- Lower-casing is handled server-side too, but the index enforces it at DB level.
CREATE UNIQUE INDEX customers_email_lower_idx
  ON public.customers (lower(email));

-- Fast lookup for "who am I?" — called on every customer page load once auth'd.
CREATE INDEX customers_auth_user_id_idx
  ON public.customers (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Auto-maintain updated_at on any row change.
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── 2. shop_customers ─────────────────────────────────────────────────────────
--
-- Junction table: one row per (shop, customer) pair.
-- Created the first time a customer spins at a shop (server function, service role).
-- Enables shop owners to list all their customers, and customers to see which
-- shops they've visited, without scanning all access_codes.

CREATE TABLE public.shop_customers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid        NOT NULL REFERENCES public.shops(id)     ON DELETE CASCADE,
  customer_id uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, customer_id)
);

CREATE INDEX shop_customers_shop_id_idx
  ON public.shop_customers (shop_id);

CREATE INDEX shop_customers_customer_id_idx
  ON public.shop_customers (customer_id);


-- ── 3. Backlink on access_codes ───────────────────────────────────────────────
--
-- Nullable FK: null for all historical spins and any spin where the customer
-- chose not to create an account. Populated by server functions after a
-- customer authenticates (upsert customers → upsert shop_customers → backfill).
-- ON DELETE SET NULL preserves the spin history if a customer deletes their account.

ALTER TABLE public.access_codes
  ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX access_codes_customer_id_idx
  ON public.access_codes (customer_id)
  WHERE customer_id IS NOT NULL;


-- ── 4. RLS: customers ─────────────────────────────────────────────────────────

-- SELECT + UPDATE only for authenticated roles.
-- INSERT and DELETE happen exclusively via service-role server functions.
GRANT SELECT, UPDATE ON public.customers TO authenticated;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- A customer can read their own profile row.
CREATE POLICY "Customers read own profile"
  ON public.customers FOR SELECT TO authenticated
  USING (auth.uid() = auth_user_id);

-- A customer can update their own name / phone (email changes go through server fn).
CREATE POLICY "Customers update own profile"
  ON public.customers FOR UPDATE TO authenticated
  USING     (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- A shop owner can read any customer who has spun at one of their shops.
-- The JOIN through shop_customers keeps the surface tight — no cross-shop leakage.
CREATE POLICY "Owners read their shop customers"
  ON public.customers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.shop_customers sc
      JOIN   public.shops          s  ON s.id = sc.shop_id
      WHERE  sc.customer_id = customers.id
        AND  s.owner_user_id = auth.uid()
    )
  );


-- ── 5. RLS: shop_customers ────────────────────────────────────────────────────

-- SELECT only for authenticated roles.
-- INSERT and DELETE happen exclusively via service-role server functions.
GRANT SELECT ON public.shop_customers TO authenticated;

ALTER TABLE public.shop_customers ENABLE ROW LEVEL SECURITY;

-- Shop owner sees all junction rows for their shop(s).
CREATE POLICY "Owners read their shop_customers"
  ON public.shop_customers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.shops s
      WHERE  s.id              = shop_customers.shop_id
        AND  s.owner_user_id   = auth.uid()
    )
  );

-- Customer sees their own junction rows (lets them discover which shops they've visited).
CREATE POLICY "Customers read own shop_customers"
  ON public.shop_customers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.customers c
      WHERE  c.id             = shop_customers.customer_id
        AND  c.auth_user_id   = auth.uid()
    )
  );

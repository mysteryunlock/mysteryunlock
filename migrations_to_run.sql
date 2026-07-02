
CREATE TABLE public.access_codes (
  code text PRIMARY KEY,
  is_used boolean NOT NULL DEFAULT false,
  spun_at timestamptz,
  prize_won text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.access_codes TO service_role;

ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (server functions) may touch this table.
CREATE INDEX idx_access_codes_created_at ON public.access_codes (created_at DESC);

CREATE TABLE public.prizes (
  id text PRIMARY KEY,
  name text NOT NULL,
  short text NOT NULL,
  image_url text NOT NULL,
  is_win boolean NOT NULL DEFAULT true,
  probability integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prizes TO anon, authenticated;
GRANT ALL ON public.prizes TO service_role;

ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read prizes"
  ON public.prizes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_prizes_updated_at
  BEFORE UPDATE ON public.prizes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.prizes (id, name, short, image_url, is_win, probability, sort_order) VALUES
  ('cable',     'Data Cable',                 'Data Cable',     '/__l5e/assets-v1/d600b57a-cbe3-4f3f-baa0-2d57bba4a855/cable.png',     true,  25, 1),
  ('earphones', 'Strong Bass Earphones',      'Bass Earphones', '/__l5e/assets-v1/5e591fc7-8436-4bce-aff4-a0bfc0cabc70/earphones.png', true,  25, 2),
  ('ultima',    'Ultima Circle Smartwatch',   'Ultima Watch',   '/__l5e/assets-v1/9f8062fa-23a3-4e24-a577-87d21ac1432a/ultima.png',    true,  25, 3),
  ('kick',      'KICK AirBuds',               'Kick AirBuds',   '/__l5e/assets-v1/2a4ac7fd-f242-4031-bbe9-e2fa72fbd9a1/kick.png',      true,  0,  4),
  ('cash2000',  'Rs. 2000 Cash Back',         'Rs.2000 Cash',   '/__l5e/assets-v1/14c554cf-b4d0-402d-967a-3a9164457e44/cash2000.png',  true,  0,  5),
  ('cash1000',  'Rs. 1000 Cash Back',         'Rs.1000 Cash',   '/__l5e/assets-v1/9114e811-2639-4aa6-8bf5-27e6d00f9c8e/cash1000.png',  true,  0,  6),
  ('try-again', 'Try Again',                  'Try Again',      '/__l5e/assets-v1/db90f94f-04cb-4182-9b3b-763f9e2855f3/tryagain.png',  false, 25, 7),
  ('cash100',   'Rs. 100 Cash Back',          'Rs.100 Cash',    '/__l5e/assets-v1/27627ab9-769b-499a-a68d-09fd262c7bd0/cash100.png',   true,  25, 8);
REVOKE ALL ON public.access_codes FROM anon, authenticated;
GRANT ALL ON public.access_codes TO service_role;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No client access to access_codes" ON public.access_codes;
CREATE POLICY "No client access to access_codes"
  ON public.access_codes
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);ALTER TABLE public.access_codes ADD COLUMN IF NOT EXISTS customer_name text;
-- 1. Roles infrastructure
CREATE TYPE public.app_role AS ENUM ('super_admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 2. Shops table
CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT SELECT ON public.shops TO anon;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active shops" ON public.shops
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Owner read own shop" ON public.shops
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Owner update own shop" ON public.shops
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Authenticated create owned shop" ON public.shops
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "Super admins manage all shops" ON public.shops
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Seed legacy shop for existing data
INSERT INTO public.shops (id, name, slug, owner_user_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Mas Mobile Zone', 'mas-mobile-zone', NULL);

-- 4. Scope prizes to shop
ALTER TABLE public.prizes ADD COLUMN shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE;
UPDATE public.prizes SET shop_id = '00000000-0000-0000-0000-000000000001' WHERE shop_id IS NULL;
ALTER TABLE public.prizes ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE public.prizes DROP CONSTRAINT prizes_pkey;
ALTER TABLE public.prizes ADD PRIMARY KEY (shop_id, id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prizes TO authenticated;
GRANT SELECT ON public.prizes TO anon;
GRANT ALL ON public.prizes TO service_role;

DROP POLICY IF EXISTS "Public can read prizes" ON public.prizes;
CREATE POLICY "Public read prizes of active shops" ON public.prizes
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = prizes.shop_id AND s.is_active = true));
CREATE POLICY "Owners manage their prizes" ON public.prizes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = prizes.shop_id AND s.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = prizes.shop_id AND s.owner_user_id = auth.uid()));
CREATE POLICY "Super admins manage all prizes" ON public.prizes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 5. Scope access_codes to shop
ALTER TABLE public.access_codes ADD COLUMN shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE;
UPDATE public.access_codes SET shop_id = '00000000-0000-0000-0000-000000000001' WHERE shop_id IS NULL;
ALTER TABLE public.access_codes ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE public.access_codes DROP CONSTRAINT access_codes_pkey;
ALTER TABLE public.access_codes ADD PRIMARY KEY (shop_id, code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_codes TO authenticated;
GRANT ALL ON public.access_codes TO service_role;

DROP POLICY IF EXISTS "No client access to access_codes" ON public.access_codes;
CREATE POLICY "Owners manage their codes" ON public.access_codes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = access_codes.shop_id AND s.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = access_codes.shop_id AND s.owner_user_id = auth.uid()));
CREATE POLICY "Super admins manage all codes" ON public.access_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
-- 1) Lock down access_codes: only service_role may read/write. Owners access via server fns.
DROP POLICY IF EXISTS "Owners manage their codes" ON public.access_codes;
DROP POLICY IF EXISTS "Super admins manage all codes" ON public.access_codes;
REVOKE ALL ON public.access_codes FROM anon, authenticated;
GRANT ALL ON public.access_codes TO service_role;

-- 2) Hide owner_user_id from anon on shops via column-level GRANTs.
REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT (id, name, slug, logo_url, is_active, created_at, updated_at) ON public.shops TO anon;

-- 3) Prevent super_admin self-promotion via authenticated INSERT/UPDATE.
DROP POLICY IF EXISTS "Super admins manage roles" ON public.user_roles;
-- Keep "Users view own roles" and "Super admins view all roles" for reads.
-- All writes must go through service_role (server-side, via bootstrap or admin server fns).
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

-- 4) Limit has_role EXECUTE to authenticated only (not anon/public).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 1) Restrict anon column access on shops so owner_user_id is never exposed via the Data API
REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT (id, name, slug, logo_url, is_active, created_at, updated_at) ON public.shops TO anon;

-- 2) Move has_role() out of the public/API schema into a private schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Drop policies that reference public.has_role so we can drop the function
DROP POLICY IF EXISTS "Super admins manage all prizes" ON public.prizes;
DROP POLICY IF EXISTS "Super admins manage all shops" ON public.shops;
DROP POLICY IF EXISTS "Super admins view all roles" ON public.user_roles;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate the super-admin policies using private.has_role
CREATE POLICY "Super admins manage all prizes"
  ON public.prizes
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Super admins manage all shops"
  ON public.shops
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Super admins view all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 3) Explicit deny-by-default policies on access_codes (all reads/writes go through server functions with the service role)
CREATE POLICY "No direct anon access" ON public.access_codes
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "No direct authenticated access" ON public.access_codes
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Re-assert: anon must never have table-level SELECT on shops (only column-level on safe columns)
REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT (id, name, slug, logo_url, is_active, created_at, updated_at) ON public.shops TO anon;
GRANT SELECT (id, name, slug, logo_url, is_active, created_at, updated_at) ON public.shops TO authenticated;

-- Stable public-safe view that structurally cannot expose owner_user_id
CREATE OR REPLACE VIEW public.shops_public
WITH (security_invoker = true) AS
SELECT id, name, slug, logo_url, is_active, created_at, updated_at
FROM public.shops
WHERE is_active = true;

GRANT SELECT ON public.shops_public TO anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;CREATE INDEX IF NOT EXISTS idx_shops_owner_user_id ON public.shops (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_access_codes_shop_spun_at ON public.access_codes (shop_id, spun_at DESC) WHERE spun_at IS NOT NULL;
ANALYZE public.shops;
ANALYZE public.prizes;
ANALYZE public.access_codes;ALTER TABLE public.access_codes ADD COLUMN IF NOT EXISTS customer_contact TEXT, ADD COLUMN IF NOT EXISTS customer_email TEXT;-- Harden public exposure: anonymous visitors must never read owner_user_id from shops.
-- 1. Drop the table-level public read policy on shops; public access goes through the safe view.
DROP POLICY IF EXISTS "Public read active shops" ON public.shops;

-- 2. Make shops_public a security-definer view so callers don't need direct grants on shops.
ALTER VIEW public.shops_public SET (security_invoker = false);

-- 3. Grant read on the safe view to anonymous and authenticated roles.
GRANT SELECT ON public.shops_public TO anon, authenticated;

-- 4. Defensive: ensure anon has no SELECT on the base shops table.
REVOKE SELECT ON public.shops FROM anon;-- Use security_invoker so the view respects the caller's RLS + grants.
ALTER VIEW public.shops_public SET (security_invoker = true);

-- Re-add a public read policy on shops, but only for the safe view path:
-- column-level grants below restrict which columns anon/authenticated can actually read.
CREATE POLICY "Public read active shops"
  ON public.shops
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Column-level SELECT grants: anon/authenticated may read only non-sensitive columns.
-- owner_user_id is intentionally excluded.
GRANT SELECT (id, name, slug, logo_url, is_active, created_at, updated_at)
  ON public.shops TO anon, authenticated;
-- Enums
DO $$ BEGIN
  CREATE TYPE public.shop_plan AS ENUM ('free','pro','lifetime');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shop_sub_status AS ENUM ('trial','active','past_due','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS plan public.shop_plan NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status public.shop_sub_status NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS billing_notes text;

-- Make sure anon can still read the safe public columns (including new ones used for status display)
GRANT SELECT (id, name, slug, logo_url, is_active, plan, subscription_status, trial_ends_at, current_period_end)
  ON public.shops TO anon;
GRANT SELECT (id, name, slug, logo_url, is_active, plan, subscription_status, trial_ends_at, current_period_end, owner_user_id, created_at, updated_at, billing_notes)
  ON public.shops TO authenticated;

-- Payment log (manual records you enter as super-admin)
CREATE TABLE IF NOT EXISTS public.shop_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'NPR',
  method text,
  reference text,
  period_start timestamptz,
  period_end timestamptz,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shop_payments TO authenticated;
GRANT ALL ON public.shop_payments TO service_role;

ALTER TABLE public.shop_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own payments" ON public.shop_payments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_payments.shop_id AND s.owner_user_id = auth.uid()));

CREATE POLICY "Super admins manage payments" ON public.shop_payments
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_shop_payments_shop ON public.shop_payments(shop_id, created_at DESC);
-- Remove broad public read policy on shops; restrict public reads to the safe view
DROP POLICY IF EXISTS "Public read active shops" ON public.shops;

-- Ensure the safe view is accessible to anon/authenticated
GRANT SELECT ON public.shops_public TO anon, authenticated;

-- Make the view run as caller (security_invoker) so it inherits RLS-free anon read of the view, not the underlying table
ALTER VIEW public.shops_public SET (security_invoker = false);-- Re-add public read policy (RLS gate) — column exposure is controlled by GRANTs below
CREATE POLICY "Public read active shops" ON public.shops
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Column-level grants: only safe columns readable by anon/authenticated on the base table
REVOKE SELECT ON public.shops FROM anon, authenticated;
GRANT SELECT (id, name, slug, logo_url, is_active, created_at, updated_at)
  ON public.shops TO anon, authenticated;

-- Owners and super admins still need full column SELECT via their policies; that flows
-- through column grants too, so grant remaining columns to authenticated only when
-- queried by owner/admin policies. Easiest: grant full SELECT to authenticated, since
-- non-owner authenticated users are blocked by RLS from non-owned rows for sensitive use,
-- but to keep parity with anon we instead require owners/admins to read via server fns
-- using the service role (already the case in shops.functions.ts). So we keep the
-- restricted column grant for authenticated as well.

-- Make the view enforce caller permissions (linter requirement)
ALTER VIEW public.shops_public SET (security_invoker = true);-- Authenticated users (owners / super admins) need all columns; their RLS policies
-- already restrict which rows they can see.
GRANT SELECT ON public.shops TO authenticated;DROP POLICY IF EXISTS "Public read active shops" ON public.shops;
CREATE POLICY "Public read active shops" ON public.shops
  FOR SELECT TO anon
  USING (is_active = true);DROP POLICY IF EXISTS "Public read active shops" ON public.shops;
REVOKE SELECT ON public.shops FROM anon;CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  price_amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NPR',
  period text NOT NULL DEFAULT 'month',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_highlighted boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  cta_label text,
  contact_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true OR private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins insert plans"
  ON public.subscription_plans FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins update plans"
  ON public.subscription_plans FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins delete plans"
  ON public.subscription_plans FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.subscription_plans (code, name, tagline, price_amount, currency, period, features, is_highlighted, sort_order, cta_label)
VALUES
  ('free', 'Free', 'Try Spinnopal risk-free', 0, 'NPR', 'month',
   '["1 active campaign","Up to 100 spins / month","Basic analytics","Email support"]'::jsonb,
   false, 1, 'Start free'),
  ('pro', 'Pro', 'For growing boutiques', 999, 'NPR', 'month',
   '["Unlimited campaigns","Up to 5,000 spins / month","Custom branding & logo","WhatsApp & email messaging","Priority support"]'::jsonb,
   true, 2, 'Upgrade to Pro'),
  ('business', 'Business', 'For multi-location brands', 2499, 'NPR', 'month',
   '["Everything in Pro","Unlimited spins","Team accounts","Advanced analytics & exports","Dedicated account manager"]'::jsonb,
   false, 3, 'Contact sales');
-- ============ 1. campaigns table ============
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, slug)
);

CREATE INDEX campaigns_shop_id_idx ON public.campaigns(shop_id);
CREATE INDEX campaigns_shop_active_idx ON public.campaigns(shop_id, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT ON public.campaigns TO anon;
GRANT ALL ON public.campaigns TO service_role;

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Owners full control of their shop's campaigns
CREATE POLICY "Owners manage their campaigns"
  ON public.campaigns FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s
            WHERE s.id = campaigns.shop_id AND s.owner_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s
            WHERE s.id = campaigns.shop_id AND s.owner_user_id = auth.uid())
  );

-- Anon can see only active campaigns of active shops (no PII columns are sensitive here)
CREATE POLICY "Public can read active campaigns"
  ON public.campaigns FOR SELECT
  TO anon
  USING (
    is_active = true
    AND EXISTS (SELECT 1 FROM public.shops s
                WHERE s.id = campaigns.shop_id AND COALESCE(s.is_active, true) = true)
  );

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 2. backfill default campaign for every existing shop ============
INSERT INTO public.campaigns (shop_id, name, slug, is_active, is_default)
SELECT id, 'Main Campaign', 'main', true, true FROM public.shops
ON CONFLICT (shop_id, slug) DO NOTHING;

-- ============ 3. add campaign_id to prizes and access_codes ============
ALTER TABLE public.prizes ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.access_codes ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;

UPDATE public.prizes p
SET campaign_id = c.id
FROM public.campaigns c
WHERE c.shop_id = p.shop_id AND c.is_default = true AND p.campaign_id IS NULL;

UPDATE public.access_codes a
SET campaign_id = c.id
FROM public.campaigns c
WHERE c.shop_id = a.shop_id AND c.is_default = true AND a.campaign_id IS NULL;

CREATE INDEX prizes_campaign_id_idx ON public.prizes(campaign_id);
CREATE INDEX access_codes_campaign_id_idx ON public.access_codes(campaign_id);
GRANT USAGE ON SCHEMA private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO anon, authenticated;-- Pending signups table: stores signup requests awaiting admin approval.
-- Password is stored temporarily so admin can create the auth account on approval.
-- Locked down: only service_role can read/write (server functions). RLS denies all to anon/authenticated.
CREATE TABLE public.pending_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pending_signups_email_pending_idx
  ON public.pending_signups (lower(email)) WHERE status = 'pending';
CREATE INDEX pending_signups_status_idx ON public.pending_signups (status, created_at DESC);

GRANT ALL ON public.pending_signups TO service_role;
-- No grants to anon/authenticated: all access goes through server functions using service role.

ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

-- Deny-by-default. Service role bypasses RLS automatically.
CREATE POLICY "no direct access" ON public.pending_signups FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

CREATE TRIGGER update_pending_signups_updated_at
  BEFORE UPDATE ON public.pending_signups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS prizes_shop_sort_idx ON public.prizes (shop_id, sort_order);
CREATE INDEX IF NOT EXISTS prizes_shop_campaign_sort_idx ON public.prizes (shop_id, campaign_id, sort_order);
CREATE INDEX IF NOT EXISTS campaigns_shop_default_idx ON public.campaigns (shop_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS access_codes_shop_active_idx ON public.access_codes (shop_id, is_used) WHERE is_used = false;
UPDATE public.subscription_plans
SET tagline = 'Try Spinnopal risk-free'
WHERE tagline = 'Try The Luck Spin risk-free';

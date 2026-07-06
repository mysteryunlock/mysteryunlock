-- Phase 4.6 hotfix: break infinite RLS recursion between customers <-> shop_customers
--
-- Root cause: "Owners read their shop customers" (on public.customers) subqueries
-- public.shop_customers, and "Customers read own shop_customers" (on
-- public.shop_customers) subqueries public.customers right back. Postgres
-- evaluates all permissive policies on a table for SELECT, so any SELECT on
-- either table triggers the other table's RLS, which triggers the first
-- table's RLS again -> infinite recursion (Postgres error 42P17, "infinite
-- recursion detected in policy for relation \"customers\"").
--
-- This made every getMyProfileFn call fail for customers (it selects from
-- public.customers using the user-scoped/RLS client), which left the
-- customer portal's `customer` state null and made PortalPage render
-- `return null` -- i.e. a blank white page after an otherwise-successful
-- OTP sign-in.
--
-- Fix follows the exact precedented pattern already used for
-- private.has_role() (see 20260620074708_*.sql): move the customers lookup
-- behind a SECURITY DEFINER function in the `private` schema. Table owners
-- are exempt from their own table's RLS (no FORCE ROW LEVEL SECURITY is set
-- anywhere in this project), so evaluating the lookup inside a SECURITY
-- DEFINER function does not re-trigger public.customers' policies, breaking
-- the cycle. No schema/column changes -- policy-only fix.

CREATE OR REPLACE FUNCTION private.customer_id_for_auth_user(_auth_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.customers WHERE auth_user_id = _auth_user_id LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.customer_id_for_auth_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.customer_id_for_auth_user(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Customers read own shop_customers" ON public.shop_customers;

CREATE POLICY "Customers read own shop_customers"
  ON public.shop_customers FOR SELECT TO authenticated
  USING (customer_id = private.customer_id_for_auth_user(auth.uid()));

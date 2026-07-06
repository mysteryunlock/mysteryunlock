-- Phase 4.6 hotfix: grant missing service_role privileges on customers / shop_customers
--
-- Root cause: the Phase 4.3 migration (20260706300000_phase43_customer_auth_schema.sql)
-- granted SELECT/UPDATE on public.customers and SELECT on public.shop_customers to
-- `authenticated`, but never granted any privileges to `service_role` — unlike every
-- other service-role-owned table in this project (access_codes, shops, prizes,
-- user_roles, etc. all have `GRANT ALL ... TO service_role;`).
--
-- Supabase's service_role bypasses RLS but still requires standard Postgres table
-- grants. Without this, every insert into public.customers via the admin client
-- (customerVerifyOtpFn) failed with `42501 permission denied for table customers`,
-- causing 100% of customer OTP sign-ins to fail after a seemingly-successful
-- verifyOtp call. This is an additive, privilege-only fix — no schema/columns/RLS
-- policy changes.

GRANT ALL ON public.customers      TO service_role;
GRANT ALL ON public.shop_customers TO service_role;

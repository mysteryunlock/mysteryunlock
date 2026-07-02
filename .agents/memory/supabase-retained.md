---
name: Supabase retained as auth+DB
description: Why Supabase was not replaced with Replit Auth / Replit DB during migration.
---

The app uses Supabase for both authentication AND database. Auth is deeply integrated:
- Admin-approved signup flow (`pending_signups` table, server-side approval)
- JWT Bearer token middleware (`requireSupabaseAuth`) on all protected server functions
- Password reset with OTP verification via `supabase.auth.verifyOtp`
- Super-admin role system (`user_roles` table, `private.has_role` function)
- `supabase.auth.admin.*` calls for creating/deleting users on approval

**Why:** Replacing with Replit Auth would require redesigning all of: the signup flow, auth middleware, password reset, and admin user management — effectively a full rewrite of core features.

**How to apply:** Keep using `@supabase/supabase-js`. Secrets needed:
- `SUPABASE_SERVICE_ROLE_KEY` → Replit Secret
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_*` → Replit shared env vars

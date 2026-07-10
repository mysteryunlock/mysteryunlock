---
name: Auth page OTP step-up
description: How email OTP step-up verification works on the sign-in page, and a race condition to guard against when touching this flow.
---

After `signInWithPassword` succeeds, the app checks `localStorage.getItem("mu_last_auth")`:
- If absent OR timestamp > 3 days old → signs out, calls `signInWithOtp({ shouldCreateUser: false })`, shows OTP step
- If trusted → navigates to dashboard directly
- On successful OTP verify → sets `mu_last_auth = Date.now()`, then navigates

Google OAuth uses `signInWithOAuth({ provider: 'google' })` via `/auth/callback`.

**Race condition (fixed 2026-07-10):** a page-level `onAuthStateChange` listener auto-navigated to `/dashboard` on any `SIGNED_IN` event. `signInWithPassword` itself fires `SIGNED_IN` as soon as the password check succeeds — before the device-trust check has a chance to run and (for untrusted devices) sign the user back out for OTP. This raced the dashboard load against the sign-out, producing an infinite "couldn't load dashboard" retry loop for brand-new devices/browsers.

**Why:** any global auth listener that auto-navigates on `SIGNED_IN` must ignore that event while an interactive flow (tracked via a `didInteract` ref/flag) is running, since interactive flows already navigate explicitly once truly finished. The listener should only handle sessions established outside those flows (session restore, another tab, OAuth popup).

**How to apply:** when modifying the sign-in/sign-up flow in `src/routes/auth.tsx`, keep the `onAuthStateChange` listener gated on `!didInteract.current` — don't let it fire before a manual sign-in's own trust-check/sign-out logic completes.

**What requires manual Supabase dashboard config:**
1. **Google OAuth**: must enable Google provider in Supabase Auth → Providers, add Google OAuth client ID/secret, add site URL to Google Cloud Console allowed origins.
2. **Custom SMTP (support@mysteryunlock.com)**: Supabase → Settings → Auth → SMTP Settings. Without this, OTP emails come from noreply@mail.supabase.io.
3. **OTP email template**: Supabase → Auth → Email Templates → Magic Link — the 6-digit code is sent as part of this template.

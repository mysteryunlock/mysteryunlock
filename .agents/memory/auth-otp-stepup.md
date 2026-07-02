---
name: Auth page OTP step-up
description: How email OTP step-up verification works on the sign-in page, and what requires Supabase dashboard config.
---

After `signInWithPassword` succeeds, the app checks `localStorage.getItem("mu_trusted_ts")`:
- If absent OR timestamp > 2 days old → signs out, calls `signInWithOtp({ shouldCreateUser: false })`, shows OTP step
- If trusted → navigates to dashboard
- On successful OTP verify → calls `trustDevice()` which sets `mu_trusted_ts = Date.now()`

Google OAuth uses `signInWithOAuth({ provider: 'google' })`. The `onAuthStateChange` SIGNED_IN handler trusts the device and navigates on any OAuth callback.

**What requires manual Supabase dashboard config:**
1. **Google OAuth**: must enable Google provider in Supabase Auth → Providers, add Google OAuth client ID/secret, add site URL to Google Cloud Console allowed origins.
2. **Custom SMTP (support@mysteryunlock.com)**: Supabase → Settings → Auth → SMTP Settings. Without this, OTP emails come from noreply@mail.supabase.io.
3. **OTP email template**: Supabase → Auth → Email Templates → Magic Link — the 6-digit code is sent as part of this template.

**Why:** Device trust prevents constant OTP re-verification while still catching new devices and stale sessions (>2 days). This is a client-side signal — not cryptographically enforced — but provides meaningful UX security improvement.

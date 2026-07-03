---
name: Supabase auth in server functions
description: Pitfalls when doing Supabase auth operations from TanStack Start server functions with bearer tokens
---

# Supabase auth operations server-side

**Rule:** A server-side Supabase client built with only `global.headers.Authorization` (bearer token) has NO auth session. Session-driven methods like `supabase.auth.updateUser()` fail with "Auth session missing". Call the GoTrue REST endpoint directly instead (e.g. `PUT {SUPABASE_URL}/auth/v1/user` with `Authorization: Bearer <token>` + `apikey` headers) — same behavior, no session dependency.

**Why:** GoTrue client methods check an internal session object, not the global headers. Discovered when change-email via server fn was reviewed; direct `updateUser` on the middleware client would have reproduced the original bug.

**How to apply:** Any server fn needing user-context auth mutations (email change, etc.) should use direct REST calls with the request's bearer token. Admin mutations can use `supabaseAdmin.auth.admin.*` instead.

# Token attacher refresh fallback

**Rule:** The client middleware that attaches the bearer token to server fn calls falls back to `refreshSession()` only when a `sb-*-auth-token` key exists in localStorage. Never refresh unconditionally — anonymous visitors call public server fns too.

**Why:** Mobile browsers suspend tabs; on resume the access token can be expired and `getSession()` returns null briefly, causing "Unauthorized: No authorization header" on authed server fns. The guarded refresh fixes this without spamming refresh attempts for logged-out users.

# OAuth redirect

**Rule:** `signInWithOAuth` redirectTo must use `window.location.origin` — never bake env-derived domains into client code (they get frozen into the production bundle at build time).

**Why:** A `REPLIT_DEV_DOMAIN` override baked the dev preview URL into the deployed bundle, sending production Google sign-ins to a dead `.pike.replit.dev` URL. Supabase URL config allowlists all environments via wildcards (`https://*.pike.replit.dev/**`, custom domain, `*.replit.app`), so origin-based redirects work everywhere.

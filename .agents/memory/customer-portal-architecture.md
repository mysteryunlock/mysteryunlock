---
name: Customer Portal architecture
description: Phase 4.4 — prize_claims table, _customer route group, customer-facing portal, dashboard claims tab, save-prize flow on result page.
---

## Route structure

`_customer` is a pathless layout group (like `_authenticated`). Child files use dot-notation to create nested URLs:

| File | URL |
|---|---|
| `_customer/route.tsx` | layout only — beforeLoad checks auth, redirects to `/auth` |
| `_customer/portal.tsx` | `/portal` — overview |
| `_customer/portal.history.tsx` | `/portal/history` |
| `_customer/portal.prizes.tsx` | `/portal/prizes` |
| `_customer/portal.profile.tsx` | `/portal/profile` |

All routes use `ssr: false`. Role check (customer vs shop owner) happens in the page component via `getMyProfileFn()` — if Forbidden, navigate to `/dashboard`.

## Auth flow

After `customerVerifyOtpFn` returns `{ access_token, refresh_token }`, call `supabase.auth.setSession(tokens)`. The `attachSupabaseAuth` global function middleware (registered in `start.ts`) then reads `supabase.auth.getSession()` on every subsequent `useServerFn` call and injects `Authorization: Bearer <token>` — so the next server function call automatically picks up the new session.

## prize_claims table

- Migration: `supabase/migrations/20260706400000_phase44_prize_claims.sql`
- Must be applied manually via Supabase SQL editor
- `claim_code`: 24-char hex UNIQUE, shown as QR code in customer portal for in-store redemption
- UNIQUE `(customer_id, code)` — upsert is idempotent (safe to retry)
- FK: `code REFERENCES access_codes(code)` — access_codes PK is `code` text (not UUID)
- RLS: customers SELECT own; shop owners SELECT+UPDATE their shop; INSERT is service-role only

## Server functions (prize-claims.functions.ts)

- `createPrizeClaimFn` — customer: upsert claim; verifies shop slug matches code's shop; backfills customer_id on access_codes if missing (email match)
- `getMyPrizeClaimsFn` — customer: list own claims with shop names
- `getMyFullHistoryFn` — customer: full spin history + shop names + attached claim stubs
- `getShopClaimsFn` — shop owner: list all claims with customer info
- `markClaimRedeemedFn` — shop owner: status → 'claimed'
- `verifyClaimCodeFn` — public: look up by claim_code for in-store scan

## Dashboard integration

Added `"claims"` to `TabKey` in `src/components/dashboard/types.ts`.
Added `ClaimsTab` + `SecondaryHeader` `TabMount` in `dashboard.tsx`.
`ClaimsTab` shows claim list with filter (all/unclaimed/claimed) and "Redeem" button.

## Result page integration

On win result page: "Save prize to my account" button opens `CustomerSignInDialog`. After successful OTP sign-in, `setSession` → `createPrizeClaimFn` auto-called. Toast shows "Prize saved!" with link to `/portal/prizes`.

## Import protection warning

`customer-auth.functions.ts` contains `requireCustomer` (plain async fn) which does `await import("@/integrations/supabase/client.server")`. When client routes import `createServerFn` exports from this file, Vite's import-protection plugin emits a warning about the dynamic import. This is non-breaking — the dynamic import is never executed on the client (only called from server fn handlers). Build succeeds cleanly.

**Why:** The `requireCustomer` helper needs to remain importable by Phase 4.4 server functions. Moving it to a `.server.ts` file would break the frozen Phase 4.3 code.

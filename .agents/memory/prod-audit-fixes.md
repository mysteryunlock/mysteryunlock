---
name: Production audit fixes
description: Bugs found and fixed during full-project backend audit before backend freeze. Documents patterns for future reference.
---

## GoTrue REST email lookup pattern
Use `findUserByEmail()` in `pending-signups.functions.ts` instead of `listUsers()` — the GoTrue Admin REST endpoint at `${SUPABASE_URL}/auth/v1/admin/users?email=...&page=1&per_page=5` does a server-side filtered query (O(1)) vs the JS client's `listUsers()` which is paginated with no email filter (O(N)).

**Why:** `listUsers({ page:1, perPage:200 })` only sees the first 200 users; a user who joined after the 200th slot would pass the "does this email already exist?" check incorrectly, allowing a duplicate shop to be created at approval time.

**How to apply:** Any auth user lookup by email should use the GoTrue REST endpoint or the same `findUserByEmail()` helper. Never use `listUsers()` with a fixed perPage for correctness-critical lookups.

## Rate limit bucket isolation
`checkEmailRegisteredFn` and `sendPasswordOtpFn` must NOT share a rate-limit Map. They were both using `_sendRates` (3/60s), meaning 3 email-check calls would exhaust the OTP send quota. Fixed by adding `_checkRates` (10/60s) used only by `checkEmailLookupRate()`.

**Why:** Users who click "continue" on the auth form multiple times before the OTP arrives would burn their OTP send quota via the email-check call, then get blocked when actually requesting the OTP.

## Removed consumeAccessCode
This public server function (no auth, no rate limiting) atomically marked a code as `is_used=true` without recording any prize. It was never called from the UI (confirmed by grep). It was a code-burning vector — anyone who obtained a valid code could call this endpoint to burn it.

**Why:** The correct code consumption flow is `spinAndRecord` which atomically consumes and records the prize. `consumeAccessCode` was dead code with a security footprint.

## Table scan limits
- `getCampaignsStats` (campaigns.functions.ts): access_codes SELECT now has `.limit(100_000)` — was unbounded
- `getCustomerSpins` (access-codes.functions.ts): `.limit(2_000)` added — was unbounded, loading entire shop spin history into memory for in-memory filter by customerKey

## CSPRNG for pickWinnerForSlug
`prizes.functions.ts` `pickWinnerForSlug` used `Math.random()`. Replaced with `crypto.getRandomValues(new Uint32Array(1))` for consistency with `spinAndRecord`. The visual spin animation now uses the same quality randomness as the actual prize assignment.

---
name: Backend freeze
description: Backend is frozen as of 2026-07-06. Documents what is frozen, what rules apply, and what the exception threshold is.
---

## Freeze date
2026-07-06 (after full production audit, 7 bugs fixed, all server functions verified)

## What is frozen

- `src/lib/*.functions.ts` — all server functions
- `src/integrations/supabase/auth-middleware.ts`
- `src/integrations/supabase/client.server.ts`
- `src/lib/validation.ts`
- `src/server.ts`, `src/start.ts`
- `supabase/migrations/` — all DB schema and RLS policies

## What is NOT frozen

- `src/routes/` — new routes and pages are unrestricted
- `src/components/` — all UI components
- `src/hooks/` — React hooks
- New server functions may be added (additive only, no changes to existing signatures)

## Exception threshold

Only a **Critical or High severity production bug** justifies modifying frozen files. Examples:
- Authentication bypass (Critical)
- Data exposure of another user's PII (Critical)
- Spin outcome can be manipulated by the client (Critical)
- Server crash on valid input (High)
- Rate limit bypassed allowing mass code consumption (High)

Examples that do NOT qualify:
- UX improvements to existing flows
- Performance optimizations to non-critical paths
- Refactoring for code cleanliness
- Adding logging or metrics

## Frozen phases

| Phase | Scope |
|-------|-------|
| 4.3 | Customer auth schema — `customer-auth.functions.ts`, migration `20260706300000` |
| 4.4 | Prize claims — `prize-claims.functions.ts`, migration `20260706400000` |
| Full backend audit | All server functions, 7 security/correctness bugs fixed |

## Next work

Phase 4.5+ — additive UI and feature work only.

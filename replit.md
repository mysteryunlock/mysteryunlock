# Mystery Unlock

A spin-to-win SaaS platform. Business owners create branded prize wheels, share a QR code, and track every winner from a dashboard.

## Stack

- **Framework**: TanStack Start (SSR React with file-based routing)
- **UI**: Tailwind CSS v4, Radix UI, shadcn/ui components
- **Backend**: Supabase (auth + database)
- **Build**: Vite (via `@lovable.dev/vite-tanstack-config`), Bun as package manager
- **PWA**: Service worker via vite-plugin-pwa

## Running the app

```bash
bun run dev
```

The dev server runs on port 5000. The "Start application" workflow handles this automatically in Replit.

## Environment

Supabase credentials are in `.env` (committed). The `SESSION_SECRET` is stored as a Replit secret.

## Project structure

- `src/routes/` — File-based routes (TanStack Start convention)
- `src/components/` — Shared UI components
- `src/lib/` — Server functions, Supabase client, utilities
- `src/hooks/` — React hooks
- `supabase/` — Supabase config/migrations

## User preferences

- Use Bun as the package manager (not npm or pnpm)

---

## BACKEND FREEZE — effective 2026-07-06

The following are frozen and must not be modified unless a Critical or High severity production bug is discovered:

- All server functions (`src/lib/*.functions.ts`)
- Authentication and middleware (`src/integrations/supabase/auth-middleware.ts`, `src/integrations/supabase/client.server.ts`)
- Database schema and Supabase migrations (`supabase/migrations/`)
- RLS policies and security rules
- Input validation schemas (`src/lib/validation.ts`)
- Server entry points (`src/server.ts`, `src/start.ts`)

### Frozen phases (fully audited and verified against live DB)

| Phase | Scope | Status |
|-------|-------|--------|
| 4.3 | Customer auth schema | Frozen |
| 4.4 | Prize claims | Frozen |
| Backend audit | All server functions, auth, RLS, security | Frozen |

### Rule for future work

Future phases (4.5+) must be implemented as **additive** changes only:
- New routes, components, and UI are unrestricted
- New server functions may be added if they don't alter existing function signatures or DB schema
- Any database schema change requires explicit justification of Critical/High severity
- No refactoring of completed phases

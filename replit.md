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

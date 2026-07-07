---
name: Phase 5.0 customer-shop connections
description: Additive membership feature reusing customers/shops/shop_customers tables; connect-code pattern for QR scan-to-connect flows.
---

Phase 5.0 added shop membership (business "Customers" tab -> Members & QR; customer "My Shops"/"My QR Code") without a new relationship table — reused `shop_customers` (added status/last_visit/created_at/updated_at columns) plus a `connect_code` column on both `shops` and `customers`.

**Import-protection pitfall (caught in regression):** Any public route (not under a layout group like `_customer`) that imports a server function which itself transitively imports `*.server.*` will trigger TanStack's Vite import-protection warning on the client bundle. Fix: use the browser Supabase client (`src/integrations/supabase/client.ts`) for auth state detection in public routes — `supabase.auth.getSession()` — rather than calling a server fn that pulls in the server chain. `connect.$code.tsx` was fixed this way.

**Why:** Backend freeze in effect (see backend-freeze.md) required additive-only schema changes; existing RLS policies on `shop_customers`/`customers` already covered the new columns since they SELECT/INSERT the whole row, so no RLS changes were needed.

**How to apply:**
- New server fns live in `src/lib/shop-connections.functions.ts` (untouched frozen files). `connect_code` is lazily generated on first read (8-char alphabet excluding ambiguous chars) rather than requiring a synchronous backfill for every row.
- Public scan-to-connect route: `/connect/$code` — resolves shop via service-role client (no auth required to view), but connecting requires customer auth. Since customer-auth.tsx (frozen-adjacent, not to be modified) has no redirect-after-login param, the flow stashes the pending code in `sessionStorage["mu_pending_connect"]` before navigating to `/customer-auth`, then the customer portal home page consumes and clears it on next load to complete the connection. This sessionStorage handoff pattern is reusable for any future "resume action after login" flow without touching the auth route itself.
- `shop_customers` upsert uses `onConflict: "shop_id,customer_id"` on the existing UNIQUE constraint for idempotent connect (prevents duplicate connections).
- Migration `20260706700000_phase50_customer_shop_connections.sql` must be applied manually via the Supabase SQL editor (this project's DB is Supabase, not the Replit-provisioned `DATABASE_URL` — confirmed by querying `SUPABASE_URL` REST API directly, which threw `column shops.connect_code does not exist` prior to manual application).

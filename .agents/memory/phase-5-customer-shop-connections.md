---
name: Phase 5.0 customer-shop connections
description: Additive membership feature reusing customers/shops/shop_customers tables; connect-code pattern for QR scan-to-connect flows.
---

Phase 5.0 added shop membership (business "Customers" tab -> Connected Members; customer "My Shops"/"My QR Code") without a new relationship table — reused `shop_customers` (added status/last_visit/created_at/updated_at columns) plus a `connect_code` column on both `shops` and `customers`.

**Import-protection pitfall (caught in regression):** Any public route (not under a layout group like `_customer`) that imports a server function which itself transitively imports `*.server.*` will trigger TanStack's Vite import-protection warning on the client bundle. Fix: use the browser Supabase client (`src/integrations/supabase/client.ts`) for auth state detection in public routes — `supabase.auth.getSession()` — rather than calling a server fn that pulls in the server chain. `connect.$code.tsx` was fixed this way.

**Why:** Backend freeze in effect (see backend-freeze.md) required additive-only schema changes; existing RLS policies on `shop_customers`/`customers` already covered the new columns since they SELECT/INSERT the whole row, so no RLS changes were needed.

## One QR per shop rule (Phase 5.0 arch)
The single shop QR always points to `/connect/:code`. No separate spin QR is promoted — spin access is reached via the "Spin & Win" button on the connect page.

## connect.$code.tsx state machine
States: loading → not-found | unauthenticated | not-connected | already-connected | just-connected
- Unauthenticated: "Sign in to Connect" + "Spin & Win" (link to /s/:slug)
- Not connected: "Join This Shop" (calls connectToShopFn) + "Spin & Win"
- Already connected / just connected: success banner + "Spin & Win" + "View My Shops"
- `checkShopConnectionFn` is called when logged in to determine if already connected (read-only, safe to call on every load, returns false gracefully for non-customers)

## Dashboard Customer Hub
- `qr` tab (secondary tab reached from Overview quick actions) renders `CustomerHubTab`
- Shows connect QR (QRCodeSVG display + QRCodeCanvas for download PNG), code, copy link, download PNG
- "Customer Hub" quick action on Overview replaces old "QR Code" label
- Customers tab toggle: "Spin CRM" | "Connected Members" (was "Members & QR")
- `ShopConnectionsTab` simplified to members-only list + phone search + expandable profile cards

## Server functions (all additive — never modify existing)
- `checkShopConnectionFn(code)` — read-only; returns `{connected: bool}`; safe every page load; false for non-customers
- `getMemberByCodeFn(customerCode)` — business owner looks up customer by their personal connect_code; throws if no matching shop_customers row for caller's shop

## member.$code.tsx (business owner scans customer QR)
Route `/member/:code` — shows customer name, contact, join date, last visit, status. Redirects to /auth if unauthenticated. Errors gracefully if customer not in owner's shop.

## sessionStorage handoff
`sessionStorage["mu_pending_connect"]` stashes the shop connect code before redirecting to `/customer-auth`. The customer portal home page consumes and clears it on next load. Reusable pattern for any "resume action after login" flow.

## Migration
`20260706700000_phase50_customer_shop_connections.sql` must be applied manually via Supabase SQL editor (live DB, not Replit DATABASE_URL).

**How to apply:**
- New server fns live in `src/lib/shop-connections.functions.ts` (untouched frozen files).
- `shop_customers` upsert uses `onConflict: "shop_id,customer_id"` for idempotent connect.

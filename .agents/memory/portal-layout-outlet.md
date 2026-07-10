---
name: Customer portal layout missing Outlet
description: portal.tsx is the TanStack Router layout parent for all /portal/* routes and MUST render <Outlet /> for child routes to display.
---

## Rule
`src/routes/_customer/portal.tsx` is the layout parent (confirmed in `routeTree.gen.ts`) for every `/portal/*` child route:
- `/portal/shops`, `/portal/history`, `/portal/prizes`, `/portal/profile`, `/portal/qr`, `/portal/prizes/$claimId`

It MUST render `<Outlet />` when a child route is active, otherwise navigation silently does nothing — URL changes but content stays identical.

## Fix applied
Added `useLocation` check at the top of `PortalPage` (after all hooks):
```tsx
if (pathname !== "/portal") return <Outlet />;
```
This lets child routes render themselves (they each have their own full-page component with header) while the portal home content renders only at exactly `/portal`.

**Why:** `active:scale-[0.99]` CSS fires on `touchstart` (gives visual feedback), but TanStack Router navigation fires on `click`. Both fire, navigation succeeds and URL changes — but without Outlet the child component was never inserted into the DOM, making the user see "nothing happened."

## How to apply
Any future route added as `portal.something.tsx` is automatically a child of `portal.tsx` (TanStack Router flat-file dot convention). No Outlet change needed — the existing `if (pathname !== "/portal") return <Outlet />` handles it.

## Logout still worked because
`signOut()` calls `navigate({ to: "/" })` — leaving the `/_customer` layout entirely. Imperative `navigate()` always works regardless of Outlet; only the RENDERING of child route components requires Outlet.

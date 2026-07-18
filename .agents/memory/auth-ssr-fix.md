---
name: Auth route SSR crash fix
description: Why /auth showed "This page didn't load" after signout or fresh browser load, and how it was fixed.
---

## Root cause
The `renderErrorPage()` HTML (from `src/lib/error-page.ts`) was being returned by the server. The custom error middleware in `src/start.ts` + `src/server.ts` catches any unhandled throw during SSR and returns this HTML as a 500.

The `/auth` route had no `ssr: false`, so TanStack Start tried to server-render it on every full-page GET request. Under certain mobile/proxy conditions (Brave browser, Replit proxy headers, or no localStorage session context on the server), the SSR failed.

The `_authenticated/route.tsx` already has `ssr: false` — the auth route was simply missing the same flag.

## Two fixes applied

### 1. `src/routes/auth.tsx` — add `ssr: false`
```ts
export const Route = createFileRoute("/auth")({
  ssr: false,  // prevents SSR failures on full-page navigations to /auth
  ...
});
```

### 2. Replace `window.location.href = "/auth"` with `navigate()`
In `CampaignHub.tsx` and `super-admin.tsx`, signout used `window.location.href = "/auth"` which causes a full HTTP GET to the server (triggering SSR). Replaced with `navigate({ to: "/auth" })` for a client-side SPA navigation that never hits the SSR path.

**Why:** Full page reloads bypass the SPA router and force the server to SSR the destination page. `navigate()` keeps everything in the SPA, avoiding SSR entirely.

## Rule
Any route that depends on client-side state (Supabase session, localStorage, browser APIs) should have `ssr: false`. Pure public marketing pages can be SSR'd; auth/dashboard pages should not be.

Routes with `ssr: false` in this codebase: `_authenticated`, `_customer`, and now `/auth`.

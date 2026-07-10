---
name: TanStack Start cold-start 404
description: Why every deployed route showed 404, and the server-prod.mjs pre-warm fix.
---

## The problem

On cold start, TanStack Start loads its own bundles **lazily** — only when the first HTTP request arrives:

1. `dist/server/server.js` is eagerly imported by `server-prod.mjs`, but it only *defines* functions; it does not load the TanStack Start bundles.
2. On the first request, `getServerEntry()` dynamically imports `server-DqxFDLrJ.js` (~84 KB).
3. That bundle's `loadEntries()` then dynamically imports `router-DRIfzenl.js` (route tree, 43 KB) and `start-CIE-vCVg.js` (14 external bare imports: h3-v2, @tanstack/router-core, seroval, react, supabase-js, …).
4. Total cold-start bundle load: ~500–800 ms.
5. The `"/"` route loader also fires two Supabase calls with a 5-second timeout.

Replit's autoscale health check hits `"/"` immediately after process start. The combined bundle load + Supabase calls exceeded the ~3.2-second health-check deadline. The connection was closed while `renderRouterToStream` was still running, throwing `AbortError: The connection was closed`. TanStack Start's streaming renderer handles this internally by serving the **not-found component** (HTTP 200 + 404 UI), NOT a 500. Replit detects the failed health check, restarts the process, and the loop repeats — so *every* user request during startup saw the custom 404 page.

## The fix

Pre-warm all TanStack Start bundles **before** `Bun.serve()` opens the port in `server-prod.mjs`:

```js
// Pre-warm: trigger all TanStack Start lazy bundle imports before port opens.
// Uses a non-existent path to skip route loaders (only bundle loading occurs).
try {
  const warmup = await ssrServer.fetch(
    new Request(`http://localhost:${PORT}/_warmup`),
    {},
    {}
  );
  await warmup.body?.cancel().catch(() => {});
} catch {
  // Ignore — warmup errors never block startup
}
```

After pre-warm, all bundles are loaded. Health-check requests to `"/"` only need ~200–500 ms for the Supabase loader — well within the timeout.

**Why:** `src/server.ts` is frozen, so the fix goes in `server-prod.mjs` (not frozen). Using `/_warmup` (a 404 path) avoids running heavy route loaders during the warmup.

## Key architecture facts

- `dist/server/assets/router-DRIfzenl.js` exports `router as r` — a frozen module namespace `{ getRouter }`. TanStack Start calls `routerEntry.getRouter()` from this.
- `dist/server/assets/start-CIE-vCVg.js` is only 83 lines but has 14 external bare-module imports — all must be in `node_modules` at server runtime.
- `h3-v2` is a transitive dependency (not in package.json directly) but is always present via `@tanstack/react-start`.
- `define` in `vite.config.ts` bakes `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` into both client and server bundles at build time — no runtime env var needed for those in the bundle.

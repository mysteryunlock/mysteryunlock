---
name: TanStack Start cold-start 404
description: Why deployed routes show 404/500 on cold start, and the two-stage server-prod.mjs pre-warm fix.
---

## The problem

On cold start, TanStack Start loads its own bundles **lazily** — only when the first HTTP request arrives:

1. `dist/server/server.js` is eagerly imported by `server-prod.mjs`, but it only *defines* functions; it does not load the TanStack Start bundles.
2. On the first request, `getServerEntry()` dynamically imports `server-DqxFDLrJ.js` (~84 KB).
3. That bundle's `loadEntries()` then dynamically imports `router-DRIfzenl.js` (route tree, 43 KB) and `start-CIE-vCVg.js` (14 external bare imports: h3-v2, @tanstack/router-core, seroval, react, supabase-js, …).
4. Total cold-start bundle load: ~500–800 ms.
5. The `"/"` route loader also fires Supabase calls that take ~800–1500 ms cold.

Replit's autoscale health check hits `"/"` immediately after process start. The combined bundle load + Supabase calls can exceed the health-check deadline. The connection closes while `renderRouterToStream` is streaming, throwing `DOMException: "The connection was closed"`. Replit marks the deployment unhealthy and shows the "Something went wrong" error page to all users — not just on "/" but on every route including "/auth".

## The fix — two-stage pre-warm in server-prod.mjs

Both stages run **before** `Bun.serve()` opens the port:

```js
// Stage 1: load all lazy bundles (~100–200 ms, no route loaders)
try {
  const warmup = await ssrServer.fetch(
    new Request(`http://localhost:${PORT}/_warmup`), {}, {}
  );
  await warmup.body?.cancel().catch(() => {});
} catch {}

// Stage 2: warm the Supabase TCP connection by hitting "/"
// This makes subsequent health-check probes to "/" complete in ~100–300 ms
try {
  const landingWarmup = await ssrServer.fetch(
    new Request(`http://localhost:${PORT}/`), {}, {}
  );
  await landingWarmup.body?.cancel().catch(() => {});
} catch {}
```

**Why:** `src/server.ts` is frozen, so fixes go in `server-prod.mjs` (not frozen). Stage 1 uses a 404 path to avoid route loaders. Stage 2 pre-runs the landing page Supabase call, keeping the TCP connection alive so subsequent requests are fast.

**Why multiple rapid re-publishes make it worse:** each publish restarts the server, creating a fresh cold-start window. 6+ rapid publishes = 6+ overlapping cold-start windows where users see the error page.

## Key architecture facts

- `dist/server/assets/router-DRIfzenl.js` exports `router as r` — a frozen module namespace `{ getRouter }`. TanStack Start calls `routerEntry.getRouter()` from this.
- `dist/server/assets/start-CIE-vCVg.js` is only 83 lines but has 14 external bare-module imports — all must be in `node_modules` at server runtime.
- `h3-v2` is a transitive dependency (not in package.json directly) but is always present via `@tanstack/react-start`.
- `define` in `vite.config.ts` bakes `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` into both client and server bundles at build time — no runtime env var needed for those in the bundle.

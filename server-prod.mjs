// Must be set before any module that checks process.env.NODE_ENV is imported,
// so React resolves react-dom-server.bun.production.min.js instead of the
// development build. Without this flag, SSR is significantly slower and cold-
// start healthchecks time out before the first render completes.
process.env.NODE_ENV = "production";

import { join } from "node:path";
import { statSync } from "node:fs";

const CLIENT_DIR = join(import.meta.dir, "dist/client");
const PORT = Number(process.env.PORT ?? 5000);

// Load the SSR handler built by TanStack Start
const { default: ssrServer } = await import("./dist/server/server.js");

// Pre-warm stage 1: load all lazy TanStack Start bundles (router, start, server
// chunks) by hitting a non-existent path. This avoids running any route loaders
// so it completes in ~100–200 ms. Without this step, bundle loading alone can
// exceed Replit's health-check deadline.
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

// Pre-warm stage 2: hit the landing page "/" to establish the Supabase TCP
// connection and warm any in-process caches before the port opens. The landing
// page has a Supabase loader that takes ~800–1500 ms cold. After this request
// the TCP connection is kept alive, so subsequent health-check probes to "/"
// complete in ~100–300 ms — well within Replit's deadline.
try {
  const landingWarmup = await ssrServer.fetch(
    new Request(`http://localhost:${PORT}/`),
    {},
    {}
  );
  await landingWarmup.body?.cancel().catch(() => {});
} catch {
  // Ignore — warmup errors never block startup
}

const MIME_TYPES = {
  ".js":          "application/javascript; charset=utf-8",
  ".mjs":         "application/javascript; charset=utf-8",
  ".css":         "text/css; charset=utf-8",
  ".html":        "text/html; charset=utf-8",
  ".json":        "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png":         "image/png",
  ".jpg":         "image/jpeg",
  ".jpeg":        "image/jpeg",
  ".svg":         "image/svg+xml",
  ".ico":         "image/x-icon",
  ".woff":        "font/woff",
  ".woff2":       "font/woff2",
  ".webp":        "image/webp",
  ".txt":         "text/plain; charset=utf-8",
};

function getMime(pathname) {
  const ext = pathname.match(/\.[^./]+$/)?.[0] ?? "";
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

function isStaticFile(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(request) {
    const url = new URL(request.url);
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      pathname = url.pathname;
    }

    // Serve static files from dist/client/
    const filePath = join(CLIENT_DIR, pathname);
    if (isStaticFile(filePath)) {
      const mime = getMime(pathname);
      const isImmutable = pathname.startsWith("/assets/");
      return new Response(Bun.file(filePath), {
        headers: {
          "Content-Type": mime,
          "Cache-Control": isImmutable
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600",
        },
      });
    }

    // Fall back to SSR — catch AbortError (client disconnected mid-stream)
    // so the server stays healthy rather than propagating the error.
    try {
      return await ssrServer.fetch(request, {}, {});
    } catch (err) {
      if (err?.name === "AbortError") return new Response(null, { status: 499 });
      console.error(err);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
});

console.log(`Server running on http://0.0.0.0:${PORT}`);

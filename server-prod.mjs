import { join } from "node:path";
import { statSync } from "node:fs";

const CLIENT_DIR = join(import.meta.dir, "dist/client");
const PORT = Number(process.env.PORT ?? 5000);

// Load the SSR handler built by TanStack Start
const { default: ssrServer } = await import("./dist/server/server.js");

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

    // Fall back to SSR
    return ssrServer.fetch(request, {}, {});
  },
});

console.log(`Server running on http://0.0.0.0:${PORT}`);

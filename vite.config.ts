// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  nitro: {
    preset: "node-server",
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    serverFns: { disableCsrfMiddlewareWarning: true },
  },
  vite: {
    server: {
      port: 5000,
      host: true,
      strictPort: true,
      allowedHosts: true,
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        manifest: false,
        devOptions: { enabled: false },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
          navigateFallback: null,
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin &&
                ["style", "script", "worker"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: { cacheName: "static-resources" },
            },
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin &&
                ["image", "font"].includes(request.destination),
              handler: "CacheFirst",
              options: {
                cacheName: "images-and-fonts",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: /^\/__l5e\/assets-v1\//,
              handler: "CacheFirst",
              options: {
                cacheName: "lovable-assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});

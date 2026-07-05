import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
      serverFns: { disableCsrfMiddlewareWarning: true },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
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
            handler: "NetworkOnly",
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
        ],
      },
    }),
  ],
  define: {
    "process.env.SUPABASE_URL": JSON.stringify(
      process.env.SUPABASE_URL || ""
    ),
    "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      process.env.SUPABASE_PUBLISHABLE_KEY || ""
    ),
    "process.env.REPLIT_DEV_DOMAIN": JSON.stringify(
      process.env.REPLIT_DEV_DOMAIN || ""
    ),
  },
  server: {
    port: 5000,
    host: true,
    strictPort: true,
    allowedHosts: true,
    watch: {
      ignored: ["**/.cache/**", "**/node_modules/**"],
    },
  },
});

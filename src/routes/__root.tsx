import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pushDebugEvent } from "@/lib/debug-auth-log";
import { DebugAuthPanel } from "@/components/DebugAuthPanel";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { PwaInstallPrompt } from "../components/PwaInstallPrompt";
import { registerServiceWorker } from "../lib/register-sw";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1f3460" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Mystery Unlock" },
      { title: "Mystery Unlock" },
      { name: "description", content: "Mystery Unlock — premium prize campaigns for retail shops. Spin · Win · Enjoy." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Mystery Unlock" },
      { property: "og:description", content: "Mystery Unlock — premium prize campaigns for retail shops. Spin · Win · Enjoy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Mystery Unlock" },
      { name: "twitter:description", content: "Mystery Unlock — premium prize campaigns for retail shops. Spin · Win · Enjoy." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/2ec05fa8-7ef3-4484-8784-ed06a106fa88" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/2ec05fa8-7ef3-4484-8784-ed06a106fa88" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/spinnopal-icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "icon", href: "/spinnopal-icon-512.png", type: "image/png", sizes: "512x512" },
      { rel: "apple-touch-icon", href: "/spinnopal-icon-512.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [showDebug] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debugAuth') === '1'
  );

  useEffect(() => {
    registerServiceWorker();
  }, []);

  // ── localStorage sb-* monitor (catches SAME-TAB writes/deletes) ─────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const orig = {
      setItem: localStorage.setItem.bind(localStorage),
      removeItem: localStorage.removeItem.bind(localStorage),
      clear: localStorage.clear.bind(localStorage),
    };
    (localStorage as any).setItem = function(key: string, value: string) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        console.log('[ls-monitor] ✅ WRITE sb-key:', key, '— valueLen:', value.length);
        pushDebugEvent('__root.tsx', 'ls-monitor', 'localStorage:WRITE', { key, valueLen: value.length }, 'success');
      }
      return orig.setItem(key, value);
    };
    (localStorage as any).removeItem = function(key: string) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        console.warn('[ls-monitor] ❌ DELETE sb-key:', key);
        console.trace('[ls-monitor] DELETE stack trace ↑');
        pushDebugEvent('__root.tsx', 'ls-monitor', 'localStorage:DELETE', { key }, 'error');
      }
      return orig.removeItem(key);
    };
    (localStorage as any).clear = function() {
      console.warn('[ls-monitor] ❌ localStorage.clear() — ALL KEYS WIPED');
      console.trace('[ls-monitor] clear() stack trace ↑');
      pushDebugEvent('__root.tsx', 'ls-monitor', 'localStorage:CLEAR', {}, 'error');
      return orig.clear();
    };
    // Cross-tab changes (different tab writes/removes the key)
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('sb-') && e.key.endsWith('-auth-token')) {
        const action = !e.oldValue && e.newValue ? 'ADDED'
          : e.oldValue && !e.newValue ? 'REMOVED'
          : e.oldValue && e.newValue ? 'UPDATED' : 'CLEARED';
        console.log('[storage-event] cross-tab sb-key change:', { key: e.key, action, hasNewValue: !!e.newValue });
        pushDebugEvent('__root.tsx', 'storage-event', `cross-tab:${action}`, { key: e.key, hasNewValue: !!e.newValue }, action === 'REMOVED' ? 'error' : 'info');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      (localStorage as any).setItem = orig.setItem;
      (localStorage as any).removeItem = orig.removeItem;
      (localStorage as any).clear = orig.clear;
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // ── Global auth-state diagnostics ────────────────────────────────────────
  useEffect(() => {
    console.log("[RootComponent] registering onAuthStateChange listener");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const sbKeys: string[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith('sb-') && k.endsWith('-auth-token')) sbKeys.push(k);
        }
      } catch {}
      console.log(`[onAuthStateChange] event=${event}`, {
        hasSession: !!session,
        userId: session?.user?.id ?? null,
        expiresAt: session?.expires_at ?? null,
        sbKeysInLocalStorage: sbKeys.length > 0 ? sbKeys : '⚠️ NONE',
      });
      pushDebugEvent('__root.tsx', 'onAuthStateChange', `authEvent:${event}`, {
        hasSession: !!session,
        userId: session?.user?.id ?? null,
        expiresAt: session?.expires_at ?? null,
        sbKeys: sbKeys.length > 0 ? sbKeys : '⚠️ NONE',
      }, event === 'SIGNED_IN' ? 'success' : event === 'SIGNED_OUT' ? 'warn' : 'info');
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <PwaInstallPrompt />
      {showDebug && <DebugAuthPanel />}
    </QueryClientProvider>
  );
}


import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { pushDebugEvent } from "@/lib/debug-auth-log";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const _t0 = Date.now();
    console.log("[beforeLoad] /_authenticated: ENTER", { ts: new Date().toISOString() });
    try {
      const _tSession = Date.now();
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("[beforeLoad] getSession() result:", {
        elapsed: Date.now() - _tSession,
        hasSession: !!sessionData.session,
        userId: sessionData.session?.user?.id ?? null,
        expiresAt: sessionData.session?.expires_at ?? null,
        accessTokenPrefix: sessionData.session?.access_token?.slice(0, 12) ?? null,
      });

      const _tUser = Date.now();
      const { data, error } = await supabase.auth.getUser();
      const _userElapsed = Date.now() - _tUser;
      console.log("[beforeLoad] getUser() result:", {
        elapsed: _userElapsed,
        hasUser: !!data.user,
        userId: data.user?.id ?? null,
        error: error ? { message: error.message, status: (error as any).status } : null,
      });
      pushDebugEvent('_authenticated/route.tsx', 'beforeLoad', 'getUser:result', {
        elapsed: _userElapsed,
        hasUser: !!data.user,
        userId: data.user?.id ?? null,
        errorMsg: error?.message ?? null,
        errorStatus: (error as any)?.status ?? null,
      }, error ? 'error' : data.user ? 'success' : 'warn');

      if (error || !data.user) {
        console.error("[beforeLoad] getUser() returned no user — redirecting to /auth", { error });
        pushDebugEvent('_authenticated/route.tsx', 'beforeLoad', 'redirect:/auth', { reason: error?.message ?? 'no user' }, 'error');
        throw redirect({ to: "/auth" });
      }
      console.log("[beforeLoad] /_authenticated: EXIT passed, user =", data.user.id, "| total elapsed:", Date.now() - _t0);
      pushDebugEvent('_authenticated/route.tsx', 'beforeLoad', 'PASS', { userId: data.user.id, totalElapsed: Date.now() - _t0 }, 'success');
      return { user: data.user };
    } catch (err) {
      if (err != null && typeof err === "object" && "to" in err) throw err;
      console.error("[beforeLoad] /_authenticated: UNEXPECTED ERROR (total elapsed:", Date.now() - _t0, ")", {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null,
        cause: (err as any)?.cause ?? null,
        status: (err as any)?.status ?? null,
      });
      pushDebugEvent('_authenticated/route.tsx', 'beforeLoad', 'UNEXPECTED_ERROR', {
        message: err instanceof Error ? err.message : String(err),
        totalElapsed: Date.now() - _t0,
      }, 'error');
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});

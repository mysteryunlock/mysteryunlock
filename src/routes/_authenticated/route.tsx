import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    console.log("[beforeLoad] /_authenticated: entered");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("[beforeLoad] getSession() result:", {
        hasSession: !!sessionData.session,
        userId: sessionData.session?.user?.id ?? null,
        expiresAt: sessionData.session?.expires_at ?? null,
        accessTokenPrefix: sessionData.session?.access_token?.slice(0, 12) ?? null,
      });

      const { data, error } = await supabase.auth.getUser();
      console.log("[beforeLoad] getUser() result:", {
        hasUser: !!data.user,
        userId: data.user?.id ?? null,
        error: error ? { message: error.message, status: (error as any).status } : null,
      });

      if (error || !data.user) {
        console.error("[beforeLoad] getUser() returned no user — redirecting to /auth", { error });
        throw redirect({ to: "/auth" });
      }
      console.log("[beforeLoad] /_authenticated: passed, user =", data.user.id);
      return { user: data.user };
    } catch (err) {
      if (err != null && typeof err === "object" && "to" in err) throw err;
      console.error("[beforeLoad] /_authenticated: unexpected error", err);
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});

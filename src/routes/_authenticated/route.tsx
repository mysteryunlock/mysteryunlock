import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Use getSession() (localStorage read — no network) rather than getUser()
    // (live network call). getUser() can transiently fail right after OTP
    // verification when Supabase's session is still propagating, creating a
    // redirect loop: dashboard → auth → dashboard → … until TanStack Router
    // gives up and shows "This page didn't load". getSession() is reliable
    // because it reads from memory/localStorage and falls back to a token
    // refresh — the actual auth enforcement happens inside each server function
    // via requireSupabaseAuth, so this guard only needs to detect "no session".
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw redirect({ to: "/auth" });
      return { user: data.session.user };
    } catch (err) {
      // Re-throw TanStack redirects; convert everything else to an auth redirect.
      if (err != null && typeof err === "object" && "to" in err) throw err;
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});

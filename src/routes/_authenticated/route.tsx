import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });
      return { user: data.user };
    } catch (err) {
      // If it's a TanStack redirect, re-throw it so the router handles it
      if (err != null && typeof err === "object" && "to" in err) throw err;
      // Any other error (network failure, token decode error, etc.) — treat as unauthenticated
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});

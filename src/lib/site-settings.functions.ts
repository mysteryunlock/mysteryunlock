import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("site_settings").select("key, value");
    if (error) return { settings: {} };
    const settings: Record<string, unknown> = {};
    for (const row of data ?? []) {
      settings[row.key] = row.value;
    }
    return { settings };
  } catch {
    return { settings: {} };
  }
});

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
  return supabaseAdmin;
}

export const updateSiteSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ key: z.string().min(1).max(80), value: z.unknown() }))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: data.key, value: data.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

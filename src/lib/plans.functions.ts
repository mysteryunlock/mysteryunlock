import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PublicPlan = {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  price_amount: number;
  currency: string;
  period: string;
  features: string[];
  is_highlighted: boolean;
  sort_order: number;
  cta_label: string | null;
  contact_url: string | null;
};

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function isSuperAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "super_admin")
    .maybeSingle();
  return !!data;
}

function normalize(row: any): PublicPlan {
  const feats = Array.isArray(row.features)
    ? row.features.filter((f: unknown) => typeof f === "string")
    : [];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    tagline: row.tagline ?? null,
    price_amount: Number(row.price_amount ?? 0),
    currency: row.currency ?? "NPR",
    period: row.period ?? "month",
    features: feats,
    is_highlighted: !!row.is_highlighted,
    sort_order: Number(row.sort_order ?? 0),
    cta_label: row.cta_label ?? null,
    contact_url: row.contact_url ?? null,
  };
}

export const listActivePlans = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await publicClient();
  const { data, error } = await sb
    .from("subscription_plans")
    .select("id, code, name, tagline, price_amount, currency, period, features, is_highlighted, sort_order, cta_label, contact_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { plans: (data ?? []).map(normalize) };
});

export const listAllPlansAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { plans: (data ?? []).map((r: any) => ({ ...normalize(r), is_active: !!r.is_active })) };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/i),
  name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(200).nullable().optional(),
  price_amount: z.number().min(0).max(10_000_000),
  currency: z.string().trim().min(1).max(8),
  period: z.string().trim().min(1).max(20),
  features: z.array(z.string().trim().min(1).max(200)).max(20),
  is_highlighted: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(999),
  cta_label: z.string().trim().max(60).nullable().optional(),
  contact_url: z.string().trim().max(300).nullable().optional(),
});

export const upsertPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(upsertSchema)
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      code: data.code,
      name: data.name,
      tagline: data.tagline ?? null,
      price_amount: data.price_amount,
      currency: data.currency,
      period: data.period,
      features: data.features,
      is_highlighted: data.is_highlighted,
      is_active: data.is_active,
      sort_order: data.sort_order,
      cta_label: data.cta_label ?? null,
      contact_url: data.contact_url ?? null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("subscription_plans").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("subscription_plans").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins!.id };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("subscription_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

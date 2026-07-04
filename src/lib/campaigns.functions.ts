import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugSchema, campaignNameSchema } from "@/lib/validation";

const themeSchema = z
  .object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  })
  .partial()
  .default({});

async function assertOwner(ctx: { supabase: any; userId: string }, shopId: string) {
  const { data, error } = await ctx.supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (error || !data) throw new Error("Not authorized for this shop");
}

// Resolve shop_id from slug (admin), with subscription gating mirroring shops.functions.
async function publicShopIdForSlug(slug: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: shop } = await supabaseAdmin
    .from("shops")
    .select("id, is_active, subscription_status, trial_ends_at, current_period_end")
    .eq("slug", slug)
    .maybeSingle();
  if (!shop || !shop.is_active) return null;
  const now = Date.now();
  const trialEnd = shop.trial_ends_at ? new Date(shop.trial_ends_at).getTime() : null;
  const periodEnd = shop.current_period_end ? new Date(shop.current_period_end).getTime() : null;
  if (shop.subscription_status === "suspended") return null;
  if (shop.subscription_status === "trial" && trialEnd && trialEnd < now) return null;
  if ((shop.subscription_status === "active" || shop.subscription_status === "past_due") && periodEnd && periodEnd < now) return null;
  return shop.id;
}

// PUBLIC: list active campaigns for a shop slug (for picker page)
export const listPublicCampaigns = createServerFn({ method: "GET" })
  .validator(z.object({ slug: slugSchema }))
  .handler(async ({ data }) => {
    const shopId = await publicShopIdForSlug(data.slug);
    if (!shopId) return { campaigns: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("campaigns")
      .select("id, name, slug, theme, is_default")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    return { campaigns: rows ?? [] };
  });

// AUTH: list all campaigns for a shop I own
export const listMyCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { data: rows, error } = await context.supabase
      .from("campaigns")
      .select("id, name, slug, theme, is_active, is_default, created_at")
      .eq("shop_id", data.shopId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { campaigns: rows ?? [] };
  });

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      name: campaignNameSchema,
      slug: slugSchema,
      theme: themeSchema.optional(),
      is_active: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { data: row, error } = await context.supabase
      .from("campaigns")
      .insert({
        shop_id: data.shopId,
        name: data.name,
        slug: data.slug,
        theme: data.theme ?? {},
        is_active: data.is_active ?? true,
        is_default: false,
      })
      .select("id, name, slug, theme, is_active, is_default")
      .single();
    if (error) throw new Error(error.message);
    return { campaign: row };
  });

export const updateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      id: z.string().uuid(),
      name: campaignNameSchema.optional(),
      slug: slugSchema.optional(),
      theme: themeSchema.optional(),
      is_active: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const patch: {
      name?: string;
      slug?: string;
      theme?: any;
      is_active?: boolean;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.slug !== undefined) patch.slug = data.slug;
    if (data.theme !== undefined) patch.theme = data.theme;
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    const { error } = await context.supabase
      .from("campaigns")
      .update(patch)
      .eq("id", data.id)
      .eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };

  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid(), id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    // Don't allow deleting the default campaign.
    const { data: row } = await context.supabase
      .from("campaigns")
      .select("is_default")
      .eq("id", data.id)
      .eq("shop_id", data.shopId)
      .maybeSingle();
    if (!row) throw new Error("Campaign not found");
    if (row.is_default) throw new Error("Cannot delete the default campaign");
    const { error } = await context.supabase
      .from("campaigns")
      .delete()
      .eq("id", data.id)
      .eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

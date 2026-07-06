import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugSchema, campaignNameSchema } from "@/lib/validation";

// Extended theme schema — fully backward-compatible (all fields optional)
const themeSchema = z
  .object({
    // existing
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    // new: campaign metadata
    description: z.string().max(500).optional(),
    start_date: z.string().max(20).optional(),
    end_date: z.string().max(20).optional(),
    timezone: z.string().max(60).optional(),
    // new: limits
    max_spins: z.number().int().min(0).max(10_000_000).optional(),
    max_winners: z.number().int().min(0).max(10_000_000).optional(),
    daily_limit: z.number().int().min(0).max(1_000_000).optional(),
    // new: status flags (stored in theme to avoid schema migration)
    is_draft: z.boolean().optional(),
    is_archived: z.boolean().optional(),
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
      .select("id, name, slug, theme, is_active, is_default, created_at")
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
    const patch: Record<string, unknown> = {};
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

// Duplicate a campaign — copies campaign row + all its prizes.
// Access codes are NOT copied (they're customer records).
export const duplicateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid(), id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    // Fetch source campaign
    const { data: src, error: srcErr } = await context.supabase
      .from("campaigns")
      .select("name, slug, theme")
      .eq("id", data.id)
      .eq("shop_id", data.shopId)
      .maybeSingle();
    if (srcErr || !src) throw new Error("Campaign not found");

    // Find a unique slug (try <slug>-copy, <slug>-copy-2, …)
    const baseSlug = src.slug.slice(0, 33);
    let slug = `${baseSlug}-copy`;
    for (let attempt = 1; attempt <= 9; attempt++) {
      const { data: existing } = await context.supabase
        .from("campaigns")
        .select("id")
        .eq("shop_id", data.shopId)
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-copy-${attempt + 1}`;
    }
    slug = slug.slice(0, 40);

    // Create the new campaign (inactive, not default)
    const newTheme = { ...(src.theme ?? {}), is_draft: true, is_archived: false };
    const { data: newCampaign, error: createErr } = await context.supabase
      .from("campaigns")
      .insert({
        shop_id: data.shopId,
        name: `${src.name} (Copy)`,
        slug,
        theme: newTheme,
        is_active: false,
        is_default: false,
      })
      .select("id, name, slug, theme, is_active, is_default, created_at")
      .single();
    if (createErr || !newCampaign) throw new Error("Failed to duplicate campaign");

    // Copy prizes (generate fresh IDs to satisfy (shop_id, id) PK)
    const { data: prizes } = await context.supabase
      .from("prizes")
      .select("id, name, short, image_url, is_win, probability, sort_order")
      .eq("shop_id", data.shopId)
      .eq("campaign_id", data.id);

    if (prizes && prizes.length > 0) {
      const ts = Date.now().toString(36).slice(-7);
      const newPrizes = prizes.map((p: any, i: number) => ({
        id: `d-${ts}-${i}`,
        name: p.name,
        short: p.short,
        image_url: p.image_url,
        is_win: p.is_win,
        probability: p.probability,
        sort_order: p.sort_order,
        shop_id: data.shopId,
        campaign_id: newCampaign.id,
      }));
      const { error: prizeErr } = await context.supabase
        .from("prizes")
        .insert(newPrizes);
      if (prizeErr) {
        // Non-fatal: campaign was created, prizes failed. Clean up campaign.
        await context.supabase.from("campaigns").delete().eq("id", newCampaign.id).eq("shop_id", data.shopId);
        throw new Error("Failed to copy prizes: " + prizeErr.message);
      }
    }

    return { campaign: newCampaign };
  });

// Batch per-campaign analytics — one call for all campaigns in a shop.
// Returns a map keyed by campaign_id.
// access_codes is service-role only (RLS blocks authenticated), so we use supabaseAdmin.
export const getCampaignsStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("access_codes")
      .select("campaign_id, is_used, prize_won")
      .eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);

    const stats: Record<string, { total_codes: number; total_spins: number; winners: number; conversion: number }> = {};
    for (const row of rows ?? []) {
      const cid: string = (row as any).campaign_id ?? "__none__";
      if (!stats[cid]) stats[cid] = { total_codes: 0, total_spins: 0, winners: 0, conversion: 0 };
      stats[cid].total_codes++;
      if (row.is_used) {
        stats[cid].total_spins++;
        // Count as winner if prize was recorded and it's not "Try Again" variants
        if ((row as any).prize_won && !/^try\s*again$/i.test(String((row as any).prize_won).trim())) {
          stats[cid].winners++;
        }
      }
    }
    for (const cid in stats) {
      const s = stats[cid];
      s.conversion = s.total_codes > 0 ? Math.round((s.total_spins / s.total_codes) * 100) : 0;
    }

    return { stats };
  });

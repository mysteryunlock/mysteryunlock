import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugSchema } from "@/lib/validation";

const prizeInput = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/i),
  name: z.string().trim().min(1).max(80),
  short: z.string().trim().min(1).max(40),
  image_url: z.string().trim().min(1).max(15_000_000),
  is_win: z.boolean(),
  probability: z.number().int().min(0).max(1000),
  sort_order: z.number().int().min(0).max(1000),
});

async function assertOwner(ctx: { supabase: any; userId: string }, shopId: string) {
  // ── PERF AUDIT: assertOwner DB query ──
  const _t = performance.now();
  const { data, error } = await ctx.supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  console.log(`[PrizesPerf:server]   assertOwner DB query: ${(performance.now() - _t).toFixed(1)} ms`);
  if (error || !data) throw new Error("Not authorized for this shop");
}

async function publicShopIdForSlug(slug: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: shop, error } = await supabaseAdmin
    .from("shops")
    .select("id, is_active, subscription_status, trial_ends_at, current_period_end")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !shop || !shop.is_active) return null;

  const now = Date.now();
  const trialEnd = shop.trial_ends_at ? new Date(shop.trial_ends_at).getTime() : null;
  const periodEnd = shop.current_period_end ? new Date(shop.current_period_end).getTime() : null;
  if (shop.subscription_status === "suspended") return null;
  if (shop.subscription_status === "trial" && trialEnd && trialEnd < now) return null;
  if ((shop.subscription_status === "active" || shop.subscription_status === "past_due") && periodEnd && periodEnd < now) return null;
  return shop.id;
}

// PUBLIC: list prizes by slug (+ optional campaign slug). When no campaign slug
// is given, returns the default campaign's prizes; falls back to all shop prizes
// when no campaigns are configured (legacy data).
export const listPrizesBySlug = createServerFn({ method: "GET" })
  .validator(z.object({ slug: slugSchema, campaignSlug: slugSchema.optional() }))
  .handler(async ({ data }) => {
    const shopId = await publicShopIdForSlug(data.slug);
    if (!shopId) return { prizes: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve campaign
    const { data: campaign } = data.campaignSlug
      ? await supabaseAdmin.from("campaigns").select("id, is_active")
          .eq("shop_id", shopId).eq("slug", data.campaignSlug).maybeSingle()
      : await supabaseAdmin.from("campaigns").select("id, is_active")
          .eq("shop_id", shopId).eq("is_default", true).maybeSingle();
    if (data.campaignSlug && (!campaign || !campaign.is_active)) return { prizes: [], campaignFound: false };

    let q = supabaseAdmin
      .from("prizes")
      .select("id, name, short, image_url, is_win, probability, sort_order")
      .eq("shop_id", shopId)
      .order("sort_order", { ascending: true });
    if (campaign?.id) q = q.eq("campaign_id", campaign.id);
    const { data: prizes, error } = await q;
    if (error) throw new Error(error.message);
    return { prizes: prizes ?? [], campaignFound: true };
  });


// AUTH: list prizes for a shop I own (optionally scoped to a campaign)
export const listMyPrizes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid(), campaignId: z.string().uuid().optional() }))
  .handler(async ({ data, context }) => {
    // ── PERF AUDIT: server-side timing ──────────────────────────────────────
    const _t0 = performance.now();
    console.log(`[PrizesPerf:server] ── listMyPrizes handler entered ────────────────`);

    // S1: assertOwner (shops SELECT — auth check)
    const _tAssert = performance.now();
    await assertOwner(context, data.shopId);
    // assertOwner logs its own inner DB query time; this captures total including overhead
    console.log(`[PrizesPerf:server] S1  assertOwner total: ${(performance.now() - _tAssert).toFixed(1)} ms`);

    // S2: prizes SELECT
    const _tQuery = performance.now();
    let q = context.supabase
      .from("prizes")
      .select("id, name, short, image_url, is_win, probability, sort_order, campaign_id")
      .eq("shop_id", data.shopId)
      .order("sort_order", { ascending: true });
    if (data.campaignId) q = q.eq("campaign_id", data.campaignId);
    const { data: prizes, error } = await q;
    console.log(`[PrizesPerf:server] S2  prizes SELECT: ${(performance.now() - _tQuery).toFixed(1)} ms  rows=${prizes?.length ?? 0}`);

    if (error) throw new Error(error.message);

    const _total = performance.now() - _t0;
    console.log(`[PrizesPerf:server] S3  handler total (assertOwner + query): ${_total.toFixed(1)} ms`);
    console.log(`[PrizesPerf:server] ────────────────────────────────────────────────`);
    // ── end PERF AUDIT ───────────────────────────────────────────────────────

    return { prizes: prizes ?? [] };
  });

export const upsertPrize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid(), campaignId: z.string().uuid().optional(), prize: prizeInput }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const row = { ...data.prize, shop_id: data.shopId, ...(data.campaignId ? { campaign_id: data.campaignId } : {}) };
    const { error } = await context.supabase
      .from("prizes")
      .upsert(row, { onConflict: "shop_id,id" });

    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const deletePrize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid(), id: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { error } = await context.supabase
      .from("prizes")
      .delete()
      .eq("shop_id", data.shopId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProbabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      probs: z
        .array(z.object({ id: z.string(), probability: z.number().int().min(0).max(1000) }))
        .max(50),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    for (const p of data.probs) {
      const { error } = await context.supabase
        .from("prizes")
        .update({ probability: p.probability })
        .eq("shop_id", data.shopId)
        .eq("id", p.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// PUBLIC: pick winner for a shop slug
export const pickWinnerForSlug = createServerFn({ method: "POST" })
  .validator(z.object({ slug: slugSchema }))
  .handler(async ({ data }) => {
    const shopId = await publicShopIdForSlug(data.slug);
    if (!shopId) throw new Error("Shop not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin
      .from("prizes")
      .select("id, probability")
      .eq("shop_id", shopId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const items = list ?? [];
    if (items.length === 0) throw new Error("No prizes configured");
    const pool = items.filter((p) => (p.probability ?? 0) > 0);
    const cand = pool.length > 0 ? pool : items;
    const total = cand.reduce((s, p) => s + (p.probability || 1), 0) || 1;
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    let r = (arr[0] / 0x1_0000_0000) * total;
    for (const p of cand) {
      r -= p.probability || 1;
      if (r <= 0) return { id: p.id };
    }
    return { id: cand[0].id };
  });

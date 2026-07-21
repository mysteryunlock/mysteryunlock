import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugSchema } from "@/lib/validation";

// Prize metadata (no probability — probabilities are managed exclusively by
// updateProbabilities so the distribution editor owns the full 100% contract).
const prizeInput = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/i),
  name: z.string().trim().min(1).max(80),
  short: z.string().trim().min(1).max(40),
  image_url: z.string().trim().min(1).max(15_000_000),
  is_win: z.boolean(),
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

// AUTH: upsert prize metadata (name, short, image, is_win, sort_order).
// Probability is NOT managed here — it is owned exclusively by updateProbabilities
// so that the full 100% distribution contract is always enforced atomically.
// New prizes are seeded with the shop's effective minimum probability; existing
// prizes keep their current probability unchanged.
export const upsertPrize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid(), campaignId: z.string().uuid().optional(), prize: prizeInput }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    // Fetch shop minimum to seed new prizes
    const { data: shopRow } = await context.supabase
      .from("shops")
      .select("minimum_probability")
      .eq("id", data.shopId)
      .maybeSingle();
    const effectiveMin = Number((shopRow as any)?.minimum_probability ?? 5);

    // Check whether this prize already exists so we can preserve its probability
    const { data: existingPrize } = await context.supabase
      .from("prizes")
      .select("id, probability")
      .eq("shop_id", data.shopId)
      .eq("id", data.prize.id)
      .maybeSingle();
    const isNew = !existingPrize;

    const row: Record<string, unknown> = {
      ...data.prize,
      shop_id: data.shopId,
      // New prizes start at the shop minimum; existing prizes keep their probability
      // (the distribution editor is the only place that changes probability).
      probability: isNew
        ? effectiveMin
        : Number((existingPrize as any)?.probability ?? effectiveMin),
      ...(data.campaignId ? { campaign_id: data.campaignId } : {}),
    };

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

// AUTH: save the full probability distribution for a campaign.
// Enforces three rules atomically:
//   1. Every prize probability must be >= the shop's minimum_probability.
//   2. Every prize probability must be <= 100.
//   3. The sum of all prize probabilities must equal exactly 100.
export const updateProbabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      probs: z
        .array(z.object({ id: z.string(), probability: z.number().int().min(0).max(100) }))
        .min(1)
        .max(50),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    // Rule 1 & 2: per-prize range validation
    const { data: shopRow } = await context.supabase
      .from("shops")
      .select("minimum_probability")
      .eq("id", data.shopId)
      .maybeSingle();
    const effectiveMin = Number((shopRow as any)?.minimum_probability ?? 5);

    const belowMin = data.probs.filter((p) => p.probability < effectiveMin);
    if (belowMin.length > 0) {
      throw new Error(
        `This prize cannot be below the platform minimum of ${effectiveMin}%.`,
      );
    }

    // Rule 3: distribution must total exactly 100%
    const total = data.probs.reduce((s, p) => s + p.probability, 0);
    if (total !== 100) {
      const diff = Math.abs(100 - total);
      const direction = total < 100 ? `Add ${diff}%` : `Remove ${diff}%`;
      throw new Error(
        `The total probability must equal exactly 100%. Your current total is ${total}%. ${direction} before saving.`,
      );
    }

    // Fetch old probabilities for audit log before updating
    const prizeIds = data.probs.map((p) => p.id);
    const { data: oldPrizes } = await context.supabase
      .from("prizes")
      .select("id, probability, name")
      .eq("shop_id", data.shopId)
      .in("id", prizeIds);

    for (const p of data.probs) {
      const { error } = await context.supabase
        .from("prizes")
        .update({ probability: p.probability })
        .eq("shop_id", data.shopId)
        .eq("id", p.id);
      if (error) throw new Error(error.message);
    }

    // Audit log: record changed probabilities (non-fatal)
    try {
      const changed = data.probs.filter((p) => {
        const old = (oldPrizes ?? []).find((op: any) => op.id === p.id);
        return old && Number(old.probability) !== p.probability;
      });
      if (changed.length > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: auditErr } = await supabaseAdmin.from("admin_audit_log").insert(
          changed.map((p) => {
            const old = (oldPrizes ?? []).find((op: any) => op.id === p.id) as any;
            return {
              admin_user_id: context.userId,
              shop_id: data.shopId,
              action: "prize_probability_updated",
              old_value: { prize_id: p.id, prize_name: old?.name ?? null, probability: old?.probability ?? null },
              new_value: { prize_id: p.id, prize_name: old?.name ?? null, probability: p.probability },
            } as never;
          }),
        );
        if (auditErr) console.error("[Prize Audit] distribution save audit failed:", auditErr.message);
      }
    } catch (e) {
      console.error("[Prize Audit] distribution save audit error:", e);
    }

    return { ok: true };
  });

// PUBLIC: pick winner for a shop slug using weighted random selection.
// Prizes with probability 0 are excluded from the pool (only relevant when
// the platform minimum is 0 and a merchant explicitly sets a prize to 0%).
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

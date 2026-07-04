import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugSchema, codeChars } from "@/lib/validation";

async function shopIdForSlug(slug: string): Promise<string | null> {
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

// Resolve the campaign_id to use for a request.
// - If campaignSlug provided, look it up under the shop (must be active).
// - Else return the default campaign for the shop.
async function resolveCampaignId(shopId: string, campaignSlug?: string | null): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (campaignSlug) {
    const { data } = await supabaseAdmin
      .from("campaigns")
      .select("id, is_active")
      .eq("shop_id", shopId)
      .eq("slug", campaignSlug)
      .maybeSingle();
    if (!data || !data.is_active) return null;
    return data.id;
  }
  const { data } = await supabaseAdmin
    .from("campaigns")
    .select("id")
    .eq("shop_id", shopId)
    .eq("is_default", true)
    .maybeSingle();
  return data?.id ?? null;
}


async function assertOwner(ctx: { supabase: any; userId: string }, shopId: string) {
  const { data, error } = await ctx.supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (error || !data) throw new Error("Not authorized for this shop");
}

// ---------- PUBLIC ----------

export const validateAccessCode = createServerFn({ method: "POST" })
  .validator(z.object({ slug: slugSchema, code: codeChars, campaignSlug: slugSchema.optional() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shopId = await shopIdForSlug(data.slug);
    if (!shopId) return { ok: false as const, reason: "shop" as const };
    const normalized = data.code.toUpperCase();
    let q = supabaseAdmin
      .from("access_codes")
      .select("code, is_used, spun_at, campaign_id")
      .eq("shop_id", shopId)
      .eq("code", normalized);
    if (data.campaignSlug) {
      const cid = await resolveCampaignId(shopId, data.campaignSlug);
      if (!cid) return { ok: false as const, reason: "invalid" as const };
      q = q.eq("campaign_id", cid);
    }
    const { data: row, error } = await q.maybeSingle();
    if (error) throw new Error("Server error");
    if (!row) return { ok: false as const, reason: "invalid" as const };
    if (row.is_used) return { ok: false as const, reason: "used" as const, spun_at: row.spun_at ?? null };
    return { ok: true as const, code: row.code };
  });


export const consumeAccessCode = createServerFn({ method: "POST" })
  .validator(z.object({ slug: slugSchema, code: codeChars }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shopId = await shopIdForSlug(data.slug);
    if (!shopId) return { ok: false as const };
    const normalized = data.code.toUpperCase();
    const { data: updated, error } = await supabaseAdmin
      .from("access_codes")
      .update({ is_used: true, spun_at: new Date().toISOString() })
      .eq("shop_id", shopId)
      .eq("code", normalized)
      .eq("is_used", false)
      .select("code")
      .maybeSingle();
    if (error) throw new Error("Server error");
    if (!updated) return { ok: false as const };
    return { ok: true as const };
  });

// Atomic: consume the code, pick a winner server-side, and record the prize.

export const spinAndRecord = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: slugSchema,
      code: codeChars,
      campaignSlug: slugSchema.optional(),
      name: z.string().trim().min(1, "Name cannot be empty").max(60, "Name must be 60 characters or fewer").optional(),
      contact: z.union([
        z.string().trim()
          .min(5, "Phone number is too short")
          .max(30, "Phone number is too long")
          .regex(/^[+\d][\d\s\-()]{4,29}$/, "Enter a valid phone number (e.g. +1 555-1234)"),
        z.literal(""),
      ]).optional(),
      email: z.union([
        z.string().trim().toLowerCase()
          .email("Please enter a valid email address")
          .max(255, "Email must be 255 characters or fewer"),
        z.literal(""),
      ]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const shopId = await shopIdForSlug(data.slug);
    if (!shopId) return { ok: false as const, reason: "shop" as const };
    const normalized = data.code.toUpperCase();

    // 0) Find the code first so we can read its campaign_id.
    let lookup = supabaseAdmin
      .from("access_codes")
      .select("code, campaign_id, is_used")
      .eq("shop_id", shopId)
      .eq("code", normalized);
    if (data.campaignSlug) {
      const cid = await resolveCampaignId(shopId, data.campaignSlug);
      if (!cid) return { ok: false as const, reason: "invalid" as const };
      lookup = lookup.eq("campaign_id", cid);
    }
    const { data: codeRow, error: lookupErr } = await lookup.maybeSingle();
    if (lookupErr) throw new Error("Server error");
    if (!codeRow) return { ok: false as const, reason: "invalid" as const };
    if (codeRow.is_used) return { ok: false as const, reason: "invalid" as const };

    const campaignId: string | null = (codeRow as { campaign_id: string | null }).campaign_id ?? await resolveCampaignId(shopId);

    // 1) Atomically consume.
    const { data: consumed, error: consumeErr } = await supabaseAdmin
      .from("access_codes")
      .update({ is_used: true, spun_at: new Date().toISOString() })
      .eq("shop_id", shopId)
      .eq("code", normalized)
      .eq("is_used", false)
      .select("code")
      .maybeSingle();
    if (consumeErr) throw new Error("Server error");
    if (!consumed) return { ok: false as const, reason: "invalid" as const };

    // 2) Pick from this campaign's prize pool.
    let prizeQ = supabaseAdmin
      .from("prizes")
      .select("id, name, short, image_url, is_win, probability, sort_order, campaign_id")
      .eq("shop_id", shopId)
      .order("sort_order", { ascending: true });
    if (campaignId) prizeQ = prizeQ.eq("campaign_id", campaignId);
    const { data: prizes, error: prizesErr } = await prizeQ;
    if (prizesErr) throw new Error("Server error");
    const items = prizes ?? [];
    if (items.length === 0) throw new Error("No prizes configured");
    const pool = items.filter((p) => (p.probability ?? 0) > 0);
    const cand = pool.length > 0 ? pool : items;
    const total = cand.reduce((s, p) => s + (p.probability || 1), 0) || 1;
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    let r = (buf[0] / 0xffffffff) * total;
    let winner = cand[0];
    for (const p of cand) {
      r -= p.probability || 1;
      if (r <= 0) { winner = p; break; }
    }

    // 3) Record the server-picked prize.
    const { error: recordErr } = await supabaseAdmin
      .from("access_codes")
      .update({
        prize_won: String(winner.name).slice(0, 100),
        customer_name: data.name ?? null,
        customer_contact: data.contact ? data.contact : null,
        customer_email: data.email ? data.email : null,
      })
      .eq("shop_id", shopId)
      .eq("code", normalized);
    if (recordErr) throw new Error("Server error");

    return { ok: true as const, prize: winner };
  });


// ---------- AUTH (shop owner) ----------

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint32Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 8; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

export const generateAccessCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    shopId: z.string().uuid(),
    count: z.number().int().min(1, "Must generate at least 1 code").max(500, "Cannot generate more than 500 codes at once"),
    campaignId: z.string().uuid().optional(),
  }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Default to the shop's default campaign if not provided.
    let campaignId = data.campaignId ?? null;
    if (!campaignId) {
      const { data: def } = await supabaseAdmin
        .from("campaigns").select("id")
        .eq("shop_id", data.shopId).eq("is_default", true).maybeSingle();
      campaignId = def?.id ?? null;
    }
    const codes = new Set<string>();
    while (codes.size < data.count) codes.add(randomCode());
    const rows = Array.from(codes).map((code) => ({ code, shop_id: data.shopId, campaign_id: campaignId }));
    const { data: inserted, error } = await supabaseAdmin
      .from("access_codes")
      .insert(rows)
      .select("code");
    if (error) throw new Error(error.message);
    return { codes: (inserted ?? []).map((r: { code: string }) => r.code) };
  });


export const listAccessCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("access_codes")
      .select("code, is_used, spun_at, prize_won, customer_name, customer_contact, customer_email, created_at")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const deleteUnusedCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("access_codes")
      .delete()
      .eq("shop_id", data.shopId)
      .eq("is_used", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSpinRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("access_codes")
      .select("code, spun_at, prize_won, customer_name, customer_contact, customer_email")
      .eq("shop_id", data.shopId)
      .not("prize_won", "is", null)
      .order("spun_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const deleteSpinRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid(), code: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("access_codes")
      .update({ prize_won: null, customer_name: null, spun_at: null, is_used: false })
      .eq("shop_id", data.shopId)
      .eq("code", data.code.toUpperCase());
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetSpinRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("access_codes")
      .update({ prize_won: null, customer_name: null, spun_at: null, is_used: false })
      .eq("shop_id", data.shopId)
      .not("prize_won", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

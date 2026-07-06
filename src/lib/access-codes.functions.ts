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
      .select("code, spun_at, prize_won, customer_name, customer_contact, customer_email, campaign_id")
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

function custKey(row: {
  customer_contact: string | null;
  customer_email: string | null;
  customer_name: string | null;
  code: string;
}): string {
  return (row.customer_contact || row.customer_email || row.customer_name || row.code).toLowerCase();
}

function isWinRow(prize_won: string | null): boolean {
  const p = (prize_won || "").trim().toLowerCase();
  return !!p && p !== "try again" && p !== "tryagain" && p !== "no win";
}

function computeSegments(totalSpins: number, totalWins: number, lastSeen: string | null, firstSeen: string | null): string[] {
  const segments: string[] = [];
  const now = Date.now();
  if (totalWins > 0) segments.push("Winner");
  if (totalSpins >= 5) segments.push("VIP");
  else if (totalSpins >= 2) segments.push("Multi-Spin");
  if (firstSeen && now - new Date(firstSeen).getTime() <= 7 * 24 * 60 * 60 * 1000) segments.push("New");
  else if (lastSeen && now - new Date(lastSeen).getTime() > 30 * 24 * 60 * 60 * 1000) segments.push("Lapsed");
  return segments;
}

export const getCrmCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    shopId: z.string().uuid(),
    campaignId: z.string().uuid().optional(),
  }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("access_codes")
      .select("code, spun_at, prize_won, customer_name, customer_contact, customer_email, campaign_id")
      .eq("shop_id", data.shopId)
      .not("prize_won", "is", null)
      .order("spun_at", { ascending: false })
      .limit(5000);
    if (data.campaignId) q = q.eq("campaign_id", data.campaignId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const spinRows = rows ?? [];

    const campaignIds = [...new Set(spinRows.map((r) => r.campaign_id).filter(Boolean) as string[])];
    let campaignNameMap: Record<string, string> = {};
    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabaseAdmin
        .from("campaigns")
        .select("id, name")
        .in("id", campaignIds);
      for (const c of campaigns ?? []) campaignNameMap[c.id] = c.name;
    }

    const map = new Map<string, {
      name: string | null;
      contact: string | null;
      email: string | null;
      spins: number;
      wins: number;
      prizes: Set<string>;
      firstSeen: string | null;
      lastSeen: string | null;
      campaignIds: Set<string>;
    }>();

    for (const r of spinRows) {
      const key = custKey(r);
      if (!map.has(key)) {
        map.set(key, {
          name: r.customer_name ?? null,
          contact: r.customer_contact ?? null,
          email: r.customer_email ?? null,
          spins: 0,
          wins: 0,
          prizes: new Set(),
          firstSeen: null,
          lastSeen: null,
          campaignIds: new Set(),
        });
      }
      const entry = map.get(key)!;
      entry.spins += 1;
      if (isWinRow(r.prize_won)) {
        entry.wins += 1;
        if (r.prize_won) entry.prizes.add(r.prize_won);
      }
      if (r.spun_at) {
        if (!entry.lastSeen || r.spun_at > entry.lastSeen) entry.lastSeen = r.spun_at;
        if (!entry.firstSeen || r.spun_at < entry.firstSeen) entry.firstSeen = r.spun_at;
      }
      if (r.campaign_id) entry.campaignIds.add(r.campaign_id);
      if (r.customer_name && !entry.name) entry.name = r.customer_name;
      if (r.customer_contact && !entry.contact) entry.contact = r.customer_contact;
      if (r.customer_email && !entry.email) entry.email = r.customer_email;
    }

    const customers = Array.from(map.entries()).map(([key, e]) => ({
      key,
      name: e.name,
      contact: e.contact,
      email: e.email,
      totalSpins: e.spins,
      totalWins: e.wins,
      prizes: Array.from(e.prizes),
      firstSeen: e.firstSeen,
      lastSeen: e.lastSeen,
      campaignIds: Array.from(e.campaignIds),
      segments: computeSegments(e.spins, e.wins, e.lastSeen, e.firstSeen),
    }));

    customers.sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));

    return { customers, campaignNames: campaignNameMap };
  });

export const getCustomerSpins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    shopId: z.string().uuid(),
    customerKey: z.string().min(1).max(255),
  }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("access_codes")
      .select("code, spun_at, prize_won, customer_name, customer_contact, customer_email, campaign_id")
      .eq("shop_id", data.shopId)
      .not("prize_won", "is", null)
      .order("spun_at", { ascending: false })
      .limit(2_000);
    if (error) throw new Error(error.message);

    const matched = (rows ?? []).filter((r) => custKey(r) === data.customerKey.toLowerCase());

    const campaignIds = [...new Set(matched.map((r) => r.campaign_id).filter(Boolean) as string[])];
    let campaignNameMap: Record<string, string> = {};
    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabaseAdmin
        .from("campaigns")
        .select("id, name")
        .in("id", campaignIds);
      for (const c of campaigns ?? []) campaignNameMap[c.id] = c.name;
    }

    const spins = matched.map((r) => ({
      code: r.code,
      spun_at: r.spun_at ?? null,
      prize_won: r.prize_won ?? null,
      campaign_id: r.campaign_id ?? null,
      campaign_name: r.campaign_id ? (campaignNameMap[r.campaign_id] ?? null) : null,
    }));

    return { spins };
  });

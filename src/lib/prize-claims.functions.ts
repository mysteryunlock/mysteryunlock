import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCustomer } from "@/lib/customer-auth.functions";
import { slugSchema, codeChars } from "@/lib/validation";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PrizeClaim = {
  id: string;
  shop_id: string;
  shop_name?: string;
  customer_id: string;
  code: string;
  prize_name: string;
  status: "unclaimed" | "claimed" | "expired";
  claimed_at: string | null;
  expires_at: string | null;
  claim_code: string;
  created_at: string;
};

export type SpinWithContext = {
  code: string;
  shop_id: string;
  shop_name: string;
  campaign_id: string | null;
  campaign_name: string | null;
  spun_at: string | null;
  prize_won: string | null;
  claim?: { id: string; status: string; claim_code: string } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Batch-resolve shop names from a list of shop IDs. */
async function resolveShopNames(
  shopIds: string[],
): Promise<Record<string, string>> {
  if (shopIds.length === 0) return {};
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("shops")
    .select("id, name")
    .in("id", shopIds);
  const map: Record<string, string> = {};
  for (const s of data ?? []) map[s.id] = s.name;
  return map;
}

// ── CUSTOMER: create a prize claim ───────────────────────────────────────────

/**
 * Idempotent: calling this twice for the same (customer, code) pair returns
 * the existing claim rather than creating a duplicate (UNIQUE constraint).
 *
 * Security: verifies the spin code belongs to this customer (customer_id FK
 * OR customer_email match), and that the code belongs to the supplied shop
 * (prevents cross-shop claim injection).
 */
export const createPrizeClaimFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      code:     codeChars,
      shopSlug: slugSchema,
    }),
  )
  .handler(async ({ data, context }) => {
    const { customerId } = await requireCustomer(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Look up the spin record.
    const { data: codeRec, error: codeErr } = await supabaseAdmin
      .from("access_codes")
      .select("code, shop_id, prize_won, customer_id, customer_email, spun_at")
      .eq("code", data.code)
      .maybeSingle();

    if (codeErr || !codeRec)            throw new Error("Spin code not found.");
    if (!codeRec.spun_at)               throw new Error("This code has not been spun yet.");
    if (!codeRec.prize_won)             throw new Error("No prize recorded for this spin.");

    // 2. Verify the code belongs to this shop (anti-spoofing).
    const { data: shop, error: shopErr } = await supabaseAdmin
      .from("shops")
      .select("id, slug")
      .eq("id", codeRec.shop_id)
      .maybeSingle();
    if (shopErr || !shop || shop.slug !== data.shopSlug)
      throw new Error("Code does not belong to this shop.");

    // 3. Verify this customer owns the spin.
    //    Primary check: customer_id FK already set (by Phase 4.3 backfill).
    //    Fallback: match by customer_email (spin was anonymous; customer
    //    signed up after spinning but the FK hasn't been set yet).
    if (codeRec.customer_id !== customerId) {
      if (!codeRec.customer_email) {
        throw new Error("This spin is not linked to your account. Please use the email you provided when spinning.");
      }
      // Fetch the customer's own email for comparison.
      const { data: cust } = await supabaseAdmin
        .from("customers")
        .select("email")
        .eq("id", customerId)
        .maybeSingle();
      if (!cust || cust.email !== codeRec.customer_email.toLowerCase()) {
        throw new Error("This spin is not linked to your account.");
      }
      // Opportunistic backfill — link the code to this customer.
      await supabaseAdmin
        .from("access_codes")
        .update({ customer_id: customerId })
        .eq("code", data.code)
        .is("customer_id", null);
    }

    // 4. Upsert prize_claims — idempotent on (customer_id, code).
    const { data: claim, error: upsertErr } = await supabaseAdmin
      .from("prize_claims")
      .upsert(
        {
          shop_id:     shop.id,
          customer_id: customerId,
          code:        data.code,
          prize_name:  codeRec.prize_won,
        },
        { onConflict: "customer_id,code" },
      )
      .select("id, claim_code, prize_name, status, created_at, expires_at")
      .single();

    if (upsertErr || !claim) throw new Error("Failed to save prize claim. Please try again.");

    return { claim };
  });

// ── CUSTOMER: list own prize claims ──────────────────────────────────────────

export const getMyPrizeClaimsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid().optional(),
      status: z.enum(["unclaimed", "claimed", "expired"]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { customerId } = await requireCustomer(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("prize_claims")
      .select("id, shop_id, customer_id, code, prize_name, status, claimed_at, expires_at, claim_code, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.shopId) q = q.eq("shop_id", data.shopId);
    if (data.status) q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const shopNames = await resolveShopNames([
      ...new Set((rows ?? []).map((r) => r.shop_id)),
    ]);

    const claims: PrizeClaim[] = (rows ?? []).map((r) => ({
      ...r,
      status:     r.status as PrizeClaim["status"],
      shop_name:  shopNames[r.shop_id] ?? r.shop_id,
    }));

    return { claims };
  });

// ── CUSTOMER: full spin history with shop names + claim status ────────────────

/**
 * Extends Phase 4.3's getMySpinHistoryFn with:
 *   - Resolved shop names (batch query)
 *   - Attached prize_claim stub if this spin has an active claim
 */
export const getMyFullHistoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { customerId } = await requireCustomer(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch spin records for this customer.
    let spinQ = supabaseAdmin
      .from("access_codes")
      .select("code, shop_id, campaign_id, spun_at, prize_won")
      .eq("customer_id", customerId)
      .not("spun_at", "is", null)
      .order("spun_at", { ascending: false })
      .limit(200);
    if (data.shopId) spinQ = spinQ.eq("shop_id", data.shopId);
    const { data: spins, error: spinErr } = await spinQ;
    if (spinErr) throw new Error(spinErr.message);

    const spinRows = spins ?? [];

    // 2. Batch fetch campaign names.
    const campaignIds = [...new Set(spinRows.map((r) => r.campaign_id).filter((id): id is string => !!id))];
    let campaignNames: Record<string, string> = {};
    if (campaignIds.length > 0) {
      const { data: camps } = await supabaseAdmin
        .from("campaigns")
        .select("id, name")
        .in("id", campaignIds);
      for (const c of camps ?? []) campaignNames[c.id] = c.name;
    }

    // 3. Batch fetch shop names.
    const shopIds = [...new Set(spinRows.map((r) => r.shop_id))];
    const shopNames = await resolveShopNames(shopIds);

    // 4. Fetch this customer's claims for any of these codes.
    const codes = spinRows.map((r) => r.code);
    let claimMap: Record<string, { id: string; status: string; claim_code: string }> = {};
    if (codes.length > 0) {
      const { data: claims } = await supabaseAdmin
        .from("prize_claims")
        .select("id, code, status, claim_code")
        .eq("customer_id", customerId)
        .in("code", codes);
      for (const c of claims ?? []) claimMap[c.code] = { id: c.id, status: c.status, claim_code: c.claim_code };
    }

    // 5. Merge.
    const history: SpinWithContext[] = spinRows.map((r) => ({
      code:          r.code,
      shop_id:       r.shop_id,
      shop_name:     shopNames[r.shop_id] ?? r.shop_id,
      campaign_id:   r.campaign_id ?? null,
      campaign_name: r.campaign_id ? (campaignNames[r.campaign_id] ?? null) : null,
      spun_at:       r.spun_at ?? null,
      prize_won:     r.prize_won ?? null,
      claim:         claimMap[r.code] ?? null,
    }));

    return { history };
  });

// ── SHOP OWNER: list claims for their shop ────────────────────────────────────

export const getShopClaimsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      status: z.enum(["unclaimed", "claimed", "expired"]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify caller owns this shop.
    const { data: shop, error: shopErr } = await supabaseAdmin
      .from("shops")
      .select("id, owner_user_id")
      .eq("id", data.shopId)
      .maybeSingle();
    if (shopErr || !shop || shop.owner_user_id !== context.userId)
      throw new Error("Forbidden: you do not own this shop.");

    let q = supabaseAdmin
      .from("prize_claims")
      .select(`
        id, code, prize_name, status, claimed_at, expires_at,
        claim_code, created_at, customer_id,
        customers ( email, name, phone )
      `)
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.status) q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return { claims: rows ?? [] };
  });

// ── SHOP OWNER: mark a prize as redeemed ─────────────────────────────────────

export const markClaimRedeemedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      claimId: z.string().uuid(),
      shopId:  z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify caller owns the shop that this claim belongs to.
    const { data: claim, error: claimErr } = await supabaseAdmin
      .from("prize_claims")
      .select("id, shop_id, status")
      .eq("id", data.claimId)
      .maybeSingle();
    if (claimErr || !claim) throw new Error("Claim not found.");

    const { data: shop } = await supabaseAdmin
      .from("shops")
      .select("id, owner_user_id")
      .eq("id", claim.shop_id)
      .maybeSingle();
    if (!shop || shop.owner_user_id !== context.userId || shop.id !== data.shopId)
      throw new Error("Forbidden: you do not own the shop for this claim.");

    if (claim.status === "claimed")
      return { ok: true as const, alreadyClaimed: true };

    const { error: updateErr } = await supabaseAdmin
      .from("prize_claims")
      .update({ status: "claimed", claimed_at: new Date().toISOString() })
      .eq("id", data.claimId);
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true as const, alreadyClaimed: false };
  });

// ── PUBLIC: verify a claim_code for in-store scan ────────────────────────────

/**
 * No auth required. Returns basic claim info for in-store verification.
 * Returns null (not an error) when the claim_code is not found, so callers
 * can distinguish "invalid code" from server errors.
 */
export const verifyClaimCodeFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      claimCode: z.string().min(1).max(64),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: claim } = await supabaseAdmin
      .from("prize_claims")
      .select(`
        id, prize_name, status, claimed_at, expires_at, created_at,
        customers ( name, email ),
        shops ( name, slug )
      `)
      .eq("claim_code", data.claimCode)
      .maybeSingle();

    if (!claim) return { found: false as const, claim: null };

    // Auto-expire if past TTL.
    if (claim.expires_at && new Date(claim.expires_at) < new Date() && claim.status === "unclaimed") {
      await supabaseAdmin
        .from("prize_claims")
        .update({ status: "expired" })
        .eq("id", claim.id);
      return {
        found: true as const,
        claim: { ...claim, status: "expired" },
      };
    }

    return { found: true as const, claim };
  });

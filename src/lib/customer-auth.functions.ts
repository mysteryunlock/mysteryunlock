import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import ws from "ws";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailSchema, slugSchema } from "@/lib/validation";

// ── Rate limiters (mirrors auth.functions.ts pattern) ─────────────────────────
// In-memory, per email. Supabase enforces its own limits too; these add an
// extra application-level guard within a single server process.

type RateRecord = { count: number; windowStart: number; lockedUntil?: number };
const _sendRates   = new Map<string, RateRecord>(); // OTP send:   3 per 60 s
const _verifyRates = new Map<string, RateRecord>(); // OTP verify: 5 per 10 min → 15 min lockout

function checkSendRate(key: string): void {
  const now = Date.now();
  const WINDOW = 60_000;
  const MAX = 3;
  const rec = _sendRates.get(key) ?? { count: 0, windowStart: now };
  if (now - rec.windowStart > WINDOW) { rec.count = 0; rec.windowStart = now; }
  if (rec.count >= MAX) throw new Error("Too many requests. Please wait a minute before trying again.");
  rec.count++;
  _sendRates.set(key, rec);
}

function checkVerifyRate(key: string): void {
  const now = Date.now();
  const WINDOW  = 10 * 60_000;
  const MAX     = 5;
  const LOCKOUT = 15 * 60_000;
  const rec = _verifyRates.get(key) ?? { count: 0, windowStart: now };
  if (rec.lockedUntil && now < rec.lockedUntil) {
    const mins = Math.ceil((rec.lockedUntil - now) / 60_000);
    throw new Error(`Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
  if (now - rec.windowStart > WINDOW) { rec.count = 0; rec.windowStart = now; delete rec.lockedUntil; }
  if (rec.count >= MAX) {
    rec.lockedUntil = now + LOCKOUT;
    _verifyRates.set(key, rec);
    throw new Error("Too many failed attempts. Please wait 15 minutes before trying again.");
  }
  rec.count++;
  _verifyRates.set(key, rec);
}

function clearVerifyRate(key: string): void {
  _verifyRates.delete(key);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve the shop UUID for a given slug, enforcing subscription gating.
 * Returns null if the shop does not exist, is inactive, or is subscription-lapsed.
 * Mirrors the same guard in access-codes.functions.ts.
 */
async function shopIdForSlug(slug: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: shop, error } = await supabaseAdmin
    .from("shops")
    .select("id, is_active, subscription_status, trial_ends_at, current_period_end")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !shop || !shop.is_active) return null;
  const now = Date.now();
  const trialEnd  = shop.trial_ends_at      ? new Date(shop.trial_ends_at).getTime()      : null;
  const periodEnd = shop.current_period_end ? new Date(shop.current_period_end).getTime() : null;
  if (shop.subscription_status === "suspended") return null;
  if (shop.subscription_status === "trial"    && trialEnd  && trialEnd  < now) return null;
  if ((shop.subscription_status === "active" || shop.subscription_status === "past_due")
      && periodEnd && periodEnd < now) return null;
  return shop.id;
}

/**
 * Guard: confirm the calling user has a customers row.
 * Used by all authenticated customer endpoints to reject shop owners and
 * unauthenticated users who somehow obtain a valid JWT.
 * Throws "Forbidden" if no matching customers.auth_user_id row exists.
 */
export async function requireCustomer(userId: string): Promise<{ customerId: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: this endpoint is for customer accounts only.");
  return { customerId: data.id };
}

// ── PUBLIC ────────────────────────────────────────────────────────────────────

/**
 * Send a one-time sign-in code to the customer's email.
 * Creates a Supabase Auth account automatically if one does not exist.
 * Always returns { ok: true } — never leaks whether the email or shop is valid
 * to prevent enumeration. Shop validation still runs to avoid OTP spam.
 */
export const customerSignInFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email:    emailSchema,
      shopSlug: slugSchema,
    }),
  )
  .handler(async ({ data }) => {
    // App-level rate limit before hitting Supabase auth API.
    checkSendRate(data.email);

    // Validate shop is real and active before spending an OTP send.
    // Fail silently to the caller — never reveal shop status via error messages.
    const shopId = await shopIdForSlug(data.shopSlug);
    if (!shopId) {
      console.warn("[customerSignInFn] shop not found or inactive:", data.shopSlug);
      return { ok: true as const };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        realtime: { transport: ws },
      },
    );

    const { error } = await sb.auth.signInWithOtp({
      email: data.email,
      options: { shouldCreateUser: true },
    });
    // Log failures but always return ok — don't expose whether email/OTP send failed.
    if (error) console.warn("[customerSignInFn] OTP send error:", error.message);

    return { ok: true as const };
  });

/**
 * Verify the OTP the customer received, then:
 *   1. Upsert their customers row (keyed by lowercase email).
 *   2. Link auth_user_id to the Supabase Auth account.
 *   3. Upsert a shop_customers junction row for this shop.
 *   4. Backfill customer_id on any prior access_codes rows with a matching email.
 *
 * Returns session tokens. The client must call supabase.auth.setSession()
 * with these tokens to persist the session in the browser.
 */
export const customerVerifyOtpFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email:    emailSchema,
      token:    z.string().length(6).regex(/^\d{6}$/, "Code must be 6 digits"),
      shopSlug: slugSchema,
    }),
  )
  .handler(async ({ data }) => {
    // Rate-limit verification attempts before hitting Supabase.
    checkVerifyRate(data.email);

    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        realtime: { transport: ws },
      },
    );

    // 1. Verify OTP — type "email" matches signInWithOtp tokens.
    const { data: verified, error: verifyErr } = await sb.auth.verifyOtp({
      email: data.email,
      token: data.token,
      type:  "email",
    });
    if (verifyErr || !verified.session || !verified.user) {
      throw new Error("Invalid or expired code. Please try again.");
    }
    clearVerifyRate(data.email);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalizedEmail = data.email.toLowerCase().trim();
    const authUserId      = verified.user.id;

    // 2. Look up the shop. If it disappeared between signIn and verify, throw.
    const shopId = await shopIdForSlug(data.shopSlug);
    if (!shopId) throw new Error("Shop not found or no longer active.");

    // 3. Upsert customers row by lowercase email.
    //    The unique constraint is a functional index on lower(email), so we cannot
    //    use Supabase's .upsert({ onConflict: "email" }) directly. Instead we do
    //    a SELECT → INSERT or UPDATE to avoid a race-condition gap.
    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("id, auth_user_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let customerId: string;

    if (existing) {
      customerId = existing.id;
      // Re-link the auth account if it changed (e.g. user deleted + recreated account).
      if (existing.auth_user_id !== authUserId) {
        const { error: linkErr } = await supabaseAdmin
          .from("customers")
          .update({ auth_user_id: authUserId })
          .eq("id", existing.id);
        if (linkErr) console.warn("[customerVerifyOtpFn] auth_user_id link error:", linkErr.message);
      }
    } else {
      const { data: newCustomer, error: insertErr } = await supabaseAdmin
        .from("customers")
        .insert({ email: normalizedEmail, auth_user_id: authUserId })
        .select("id")
        .single();

      if (insertErr) {
        // Postgres 23505 = unique_violation: a concurrent request (e.g. double-tap)
        // inserted the row between our SELECT and this INSERT.  Recover gracefully
        // by fetching the row that the sibling request just created.
        if (insertErr.code === "23505") {
          const { data: raceRow } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("email", normalizedEmail)
            .maybeSingle();
          if (!raceRow) throw new Error("Failed to create customer profile. Please try again.");
          customerId = raceRow.id;
        } else {
          throw new Error("Failed to create customer profile. Please try again.");
        }
      } else if (!newCustomer) {
        throw new Error("Failed to create customer profile. Please try again.");
      } else {
        customerId = newCustomer.id;
      }
    }

    // 4. Upsert shop_customers junction — one row per (shop, customer) pair.
    //    Ignore conflict — first_seen should stay as the original date.
    const { error: scErr } = await supabaseAdmin
      .from("shop_customers")
      .upsert(
        { shop_id: shopId, customer_id: customerId },
        { onConflict: "shop_id,customer_id" },
      );
    if (scErr) console.warn("[customerVerifyOtpFn] shop_customers upsert error:", scErr.message);

    // 5. Backfill: link any prior spin records at this shop whose email matches.
    //    Only updates rows that are not yet linked (customer_id IS NULL) to avoid
    //    overwriting any legitimate existing links.
    const { error: backfillErr } = await supabaseAdmin
      .from("access_codes")
      .update({ customer_id: customerId })
      .eq("shop_id", shopId)
      .eq("customer_email", normalizedEmail)
      .is("customer_id", null);
    if (backfillErr) console.warn("[customerVerifyOtpFn] backfill error:", backfillErr.message);

    // Return tokens for the client to call supabase.auth.setSession().
    // SECURITY: tokens are returned over TLS to the authenticated caller only.
    return {
      access_token:  verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      expires_in:    verified.session.expires_in,
      customer_id:   customerId,
    };
  });

// ── AUTHENTICATED (customer only) ─────────────────────────────────────────────

/**
 * Return the calling customer's profile from the customers table.
 * Uses the user-scoped RLS client — the RLS policy "Customers read own profile"
 * already restricts the result to the caller's row.
 */
export const getMyProfileFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Guard: verify caller is a customer (not a shop owner).
    await requireCustomer(context.userId);

    const { data, error } = await context.supabase
      .from("customers")
      .select("id, email, name, phone, created_at, updated_at")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data)  throw new Error("Customer profile not found.");
    return { customer: data };
  });

/**
 * Update the calling customer's display name and/or phone number.
 * Uses the user-scoped RLS client — the "Customers update own profile" policy
 * enforces that callers can only modify their own row.
 */
export const updateMyProfileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      name:  z.string().trim().min(1, "Name cannot be empty").max(80, "Name must be 80 characters or fewer").optional(),
      phone: z.union([
        z.string().trim()
          .min(5, "Phone number is too short")
          .max(30, "Phone number is too long")
          .regex(/^[+\d][\d\s\-()]{4,29}$/, "Enter a valid phone number (e.g. +1 555-1234)"),
        z.literal(""),
      ]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    // Guard: verify caller is a customer.
    await requireCustomer(context.userId);

    const patch: { name?: string; phone?: string | null } = {};
    if (data.name  !== undefined) patch.name  = data.name;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { error } = await context.supabase
      .from("customers")
      .update(patch)
      .eq("auth_user_id", context.userId);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });

/**
 * Return the calling customer's spin history from access_codes.
 * Optionally filtered to a single shop by shopId.
 *
 * Uses supabaseAdmin because access_codes is REVOKE ALL on anon/authenticated —
 * all reads go through service role. The customer_id column ensures we only
 * return the caller's own spin records.
 */
export const getMySpinHistoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    // Guard: verify caller is a customer and retrieve their customer UUID.
    const { customerId } = await requireCustomer(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("access_codes")
      .select("code, shop_id, campaign_id, spun_at, prize_won, customer_name")
      .eq("customer_id", customerId)
      .not("spun_at", "is", null)
      .order("spun_at", { ascending: false })
      .limit(200);

    if (data.shopId) q = q.eq("shop_id", data.shopId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Resolve campaign names in one batch query.
    const campaignIds = [
      ...new Set(
        (rows ?? []).map((r) => r.campaign_id).filter((id): id is string => !!id),
      ),
    ];
    let campaignNames: Record<string, string> = {};
    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabaseAdmin
        .from("campaigns")
        .select("id, name")
        .in("id", campaignIds);
      for (const c of campaigns ?? []) campaignNames[c.id] = c.name;
    }

    const spins = (rows ?? []).map((r) => ({
      code:          r.code,
      shop_id:       r.shop_id,
      campaign_id:   r.campaign_id ?? null,
      campaign_name: r.campaign_id ? (campaignNames[r.campaign_id] ?? null) : null,
      spun_at:       r.spun_at ?? null,
      prize_won:     r.prize_won ?? null,
    }));

    return { spins };
  });

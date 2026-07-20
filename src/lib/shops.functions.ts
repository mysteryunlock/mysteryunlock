import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailSchema, slugSchema, nameSchema } from "@/lib/validation";

async function publicClient() {
  // Server-side publishable client for anon-readable data during SSR or public fns.
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

// ------------ PUBLIC (customer-facing) ------------

export const getPublicShop = createServerFn({ method: "GET" })
  .validator(z.object({ slug: slugSchema }))
  .handler(async ({ data }) => {
    // Use admin client server-side to evaluate subscription gating without exposing
    // sensitive columns (subscription_status, trial_ends_at, etc.) to anon over the Data API.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shop, error } = await supabaseAdmin
      .from("shops")
      .select("id, name, slug, logo_url, is_active, subscription_status, trial_ends_at, current_period_end")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error("Server error");
    if (!shop || !shop.is_active) return { shop: null as null };
    const now = Date.now();
    const status = shop.subscription_status as string;
    const trialEnd = shop.trial_ends_at ? new Date(shop.trial_ends_at).getTime() : null;
    const periodEnd = shop.current_period_end ? new Date(shop.current_period_end).getTime() : null;
    if (status === "suspended") return { shop: null as null };
    if (status === "trial" && trialEnd && trialEnd < now) return { shop: null as null };
    if (status === "active" && periodEnd && periodEnd < now) return { shop: null as null };
    if (status === "past_due" && periodEnd && periodEnd < now) return { shop: null as null };
    // Return only safe public fields — never leak sensitive columns to the client.
    return {
      shop: {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        logo_url: shop.logo_url,
        is_active: shop.is_active,
      },
    };
  });


export const getPublicPrizes = createServerFn({ method: "GET" })
  .validator(z.object({ slug: slugSchema }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shop } = await supabaseAdmin
      .from("shops")
      .select("id")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!shop) return { prizes: [] };
    const { data: prizes, error } = await supabaseAdmin
      .from("prizes")
      .select("id, name, short, image_url, is_win, probability, sort_order")
      .eq("shop_id", shop.id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error("Server error");
    return { prizes: prizes ?? [] };
  });


// ------------ AUTHENTICATED (shop owner) ------------

export const listMyShops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const _t0 = Date.now();
    console.log("[listMyShops] ENTER", { ts: new Date().toISOString(), userId: context.userId });
    const _tSql = Date.now();
    console.log("[listMyShops] SQL: started");
    const { data, error } = await context.supabase
      .from("shops")
      .select("id, owner_user_id, name, slug, logo_url, is_active, subscription_status, trial_ends_at, current_period_end, minimum_probability")
      .eq("owner_user_id", context.userId)
      .order("created_at", { ascending: true });
    console.log("[listMyShops] SQL: completed", {
      elapsed: Date.now() - _tSql,
      rowCount: data?.length ?? null,
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        status: (error as any).status,
        statusText: (error as any).statusText,
      } : null,
    });
    if (error) {
      console.error("[FIRST FAILURE] listMyShops: SQL error", {
        totalElapsed: Date.now() - _t0,
        fullError: JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error))),
        userId: context.userId,
      });
      throw new Error(error.message);
    }
    // Auto-grant super_admin if the logged-in user's email matches SUPER_ADMIN_EMAIL env var.
    // This replaces the old password-bootstrap mechanism — no shared password needed.
    let superAdmin = await isSuperAdmin(context);
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    if (superAdminEmail && !superAdmin) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      if (userData?.user?.email?.toLowerCase() === superAdminEmail) {
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: context.userId, role: "super_admin" }, { onConflict: "user_id,role" });
        superAdmin = true;
      }
    }
    const result = { shops: data ?? [], superAdmin };
    console.log("[listMyShops] EXIT", { elapsed: Date.now() - _t0, shopCount: result.shops.length, superAdmin });
    return result;
  });

export const createShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ name: nameSchema, slug: slugSchema, email: emailSchema.optional() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("shops")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (existing) throw new Error("That URL is taken — try another.");
    const { data: shop, error } = await context.supabase
      .from("shops")
      .insert({ name: data.name, slug: data.slug, owner_user_id: context.userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { shop };
  });

export const updateMyShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      name: nameSchema.optional(),
      slug: slugSchema.optional(),
      logo_url: z.string().max(15_000_000).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const patch: { name?: string; slug?: string; logo_url?: string | null } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.slug !== undefined) patch.slug = data.slug;
    if (data.logo_url !== undefined) patch.logo_url = data.logo_url;
    if (Object.keys(patch).length === 0) return { ok: true };

    if (data.slug) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing } = await supabaseAdmin
        .from("shops")
        .select("id")
        .eq("slug", data.slug)
        .neq("id", data.id)
        .maybeSingle();
      if (existing) throw new Error("That URL is taken — try another.");
    }

    const { data: shop, error } = await context.supabase
      .from("shops")
      .update(patch)
      .eq("id", data.id)
      .eq("owner_user_id", context.userId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!shop) throw new Error("Not found or not authorized");
    return { shop };
  });

// ------------ SUPER ADMIN ------------

export const listAllShops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shops, error } = await supabaseAdmin
      .from("shops")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Owner emails + counts — all 3 sub-queries run in parallel per shop
    const enriched = await Promise.all(
      (shops ?? []).map(async (s) => {
        const [userResult, codesResult, spinsResult] = await Promise.all([
          s.owner_user_id
            ? supabaseAdmin.auth.admin.getUserById(s.owner_user_id)
            : Promise.resolve({ data: { user: null } }),
          supabaseAdmin
            .from("access_codes")
            .select("*", { count: "exact", head: true })
            .eq("shop_id", s.id),
          supabaseAdmin
            .from("access_codes")
            .select("*", { count: "exact", head: true })
            .eq("shop_id", s.id)
            .not("spun_at", "is", null),
        ]);
        const u = userResult.data?.user;
        return {
          ...s,
          owner_email: u?.email ?? null,
          owner_last_sign_in_at: u?.last_sign_in_at ?? null,
          owner_email_confirmed_at: u?.email_confirmed_at ?? null,
          codes_count: codesResult.count ?? 0,
          spins_count: spinsResult.count ?? 0,
        };
      }),
    );
    return { shops: enriched };
  });

export const listAllCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: customers, error } = await supabaseAdmin
      .from("customers")
      .select("id, auth_user_id, name, email, phone, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Enrich each customer with their connected shop count
    const enriched = await Promise.all(
      (customers ?? []).map(async (c) => {
        const { count } = await supabaseAdmin
          .from("shop_customers")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", c.id);
        return { ...c, connected_shops: count ?? 0 };
      }),
    );
    return { customers: enriched };
  });

export const setShopActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid(), is_active: z.boolean() }))
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("shops").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("shops").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const claimShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shops")
      .update({ owner_user_id: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ SUPER ADMIN: owner account controls ------------

async function getShopOwnerId(shopId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("shops").select("owner_user_id").eq("id", shopId).maybeSingle();
  return data?.owner_user_id ?? null;
}

export const sendOwnerPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid(), redirectTo: z.string().url().optional() }))
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const ownerId = await getShopOwnerId(data.shopId);
    if (!ownerId) throw new Error("Shop has no owner");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(ownerId);
    const email = u.user?.email;
    if (!email) throw new Error("Owner has no email");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    return { ok: true, email };
  });

export const forceSetOwnerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid(), password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password must be 128 characters or fewer") }))
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const ownerId = await getShopOwnerId(data.shopId);
    if (!ownerId) throw new Error("Shop has no owner");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(ownerId, { password: data.password });
    if (error) throw new Error(error.message);
    // Also revoke active sessions so the owner must use the new password.
    await supabaseAdmin.auth.admin.signOut(ownerId, "global").catch(() => {});
    return { ok: true };
  });

export const signOutOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const ownerId = await getShopOwnerId(data.shopId);
    if (!ownerId) throw new Error("Shop has no owner");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.signOut(ownerId, "global");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ SUPER ADMIN: shop details ------------

export const getShopDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shop, error: shopErr } = await supabaseAdmin
      .from("shops").select("*").eq("id", data.shopId).maybeSingle();
    if (shopErr) throw new Error(shopErr.message);
    if (!shop) throw new Error("Not found");

    let owner: { email: string | null; last_sign_in_at: string | null; email_confirmed_at: string | null; created_at: string | null } | null = null;
    if (shop.owner_user_id) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(shop.owner_user_id);
      if (u.user) {
        owner = {
          email: u.user.email ?? null,
          last_sign_in_at: u.user.last_sign_in_at ?? null,
          email_confirmed_at: u.user.email_confirmed_at ?? null,
          created_at: u.user.created_at ?? null,
        };
      }
    }

    const { data: prizes } = await supabaseAdmin
      .from("prizes").select("id, name, short, image_url, is_win, probability, sort_order")
      .eq("shop_id", data.shopId).order("sort_order", { ascending: true });

    const { data: codes } = await supabaseAdmin
      .from("access_codes").select("code, is_used, customer_name, customer_contact, customer_email, prize_won, spun_at, created_at")
      .eq("shop_id", data.shopId).order("created_at", { ascending: false }).limit(500);

    const { data: spins } = await supabaseAdmin
      .from("access_codes").select("code, customer_name, customer_contact, customer_email, prize_won, spun_at")
      .eq("shop_id", data.shopId).not("spun_at", "is", null)
      .order("spun_at", { ascending: false }).limit(50);

    const { data: payments } = await supabaseAdmin
      .from("shop_payments").select("*").eq("shop_id", data.shopId)
      .order("created_at", { ascending: false }).limit(50);

    return { shop, owner, prizes: prizes ?? [], codes: codes ?? [], spins: spins ?? [], payments: payments ?? [] };
  });

// ------------ SUBSCRIPTION (super admin) ------------

const planSchema = z.enum(["free", "pro", "lifetime"]);
const statusSchema = z.enum(["trial", "active", "past_due", "suspended"]);

export const updateShopSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      plan: planSchema.optional(),
      subscription_status: statusSchema.optional(),
      current_period_end: z.string().datetime().nullable().optional(),
      trial_ends_at: z.string().datetime().nullable().optional(),
      billing_notes: z.string().max(2000).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    for (const k of ["plan", "subscription_status", "current_period_end", "trial_ends_at", "billing_notes"] as const) {
      if (data[k] !== undefined) patch[k] = data[k];
    }
    // Mirror suspension into is_active so public page hides shop immediately
    if (data.subscription_status === "suspended") patch.is_active = false;
    if (data.subscription_status === "active" || data.subscription_status === "trial") patch.is_active = true;
    const { error } = await supabaseAdmin.from("shops").update(patch as never).eq("id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const extendShopPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid(), months: z.number().int().min(1, "Must extend by at least 1 month").max(60, "Cannot extend by more than 60 months") }))
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shop } = await supabaseAdmin
      .from("shops").select("current_period_end").eq("id", data.shopId).maybeSingle();
    const base = shop?.current_period_end ? new Date(shop.current_period_end) : new Date();
    const next = base.getTime() < Date.now() ? new Date() : base;
    next.setMonth(next.getMonth() + data.months);
    const { error } = await supabaseAdmin.from("shops")
      .update({ current_period_end: next.toISOString(), subscription_status: "active", is_active: true })
      .eq("id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true, current_period_end: next.toISOString() };
  });

export const recordShopPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      amount: z.number().positive("Amount must be a positive number").max(10_000_000, "Amount exceeds the maximum allowed"),
      currency: z.string().min(1, "Currency code is required").max(8, "Currency code must be 8 characters or fewer").default("NPR"),
      method: z.string().max(40, "Payment method must be 40 characters or fewer").optional(),
      reference: z.string().max(120, "Reference must be 120 characters or fewer").optional(),
      months: z.number().int().min(0, "Months cannot be negative").max(60, "Cannot extend by more than 60 months").optional(),
      notes: z.string().max(1000, "Notes must be 1,000 characters or fewer").optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let period_start: string | null = null;
    let period_end: string | null = null;
    if (data.months && data.months > 0) {
      const { data: shop } = await supabaseAdmin
        .from("shops").select("current_period_end").eq("id", data.shopId).maybeSingle();
      const base = shop?.current_period_end ? new Date(shop.current_period_end) : new Date();
      const start = base.getTime() < Date.now() ? new Date() : base;
      period_start = start.toISOString();
      const end = new Date(start);
      end.setMonth(end.getMonth() + data.months);
      period_end = end.toISOString();
      await supabaseAdmin.from("shops")
        .update({ current_period_end: period_end, subscription_status: "active", is_active: true })
        .eq("id", data.shopId);
    }
    const { error } = await supabaseAdmin.from("shop_payments").insert({
      shop_id: data.shopId,
      amount: data.amount,
      currency: data.currency,
      method: data.method ?? null,
      reference: data.reference ?? null,
      period_start, period_end,
      notes: data.notes ?? null,
      recorded_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ MINIMUM PROBABILITY (super admin) ------------

export const setShopMinimumProbability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      minimum_probability: z
        .number()
        .min(0, "Minimum probability cannot be negative")
        .max(100, "Minimum probability cannot exceed 100"),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Read old value for audit log
    const { data: current } = await supabaseAdmin
      .from("shops")
      .select("minimum_probability")
      .eq("id", data.shopId)
      .maybeSingle();
    const oldValue = (current as any)?.minimum_probability ?? 5;

    const { error } = await supabaseAdmin
      .from("shops")
      .update({ minimum_probability: data.minimum_probability } as never)
      .eq("id", data.shopId);
    if (error) throw new Error(error.message);

    // Write audit record — non-fatal if it fails, but always log errors so
    // they surface in server logs instead of being silently swallowed.
    // NOTE: Supabase JS v2 insert() never throws; it returns { data, error }.
    // A try/catch alone cannot catch database-level errors — we must check .error.
    const { error: auditError } = await supabaseAdmin
      .from("admin_audit_log")
      .insert({
        admin_user_id: context.userId,
        shop_id: data.shopId,
        action: "set_minimum_probability",
        old_value: { minimum_probability: oldValue },
        new_value: { minimum_probability: data.minimum_probability },
      } as never);
    if (auditError) {
      console.error("[Admin Audit] Failed to write audit log for set_minimum_probability:", auditError.message, auditError.details ?? "");
    } else {
      console.log(`[Admin Audit] set_minimum_probability: shop=${data.shopId} old=${oldValue} new=${data.minimum_probability}`);
    }

    return { ok: true };
  });

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: shop } = await context.supabase
      .from("shops")
      .select("id, plan, subscription_status, trial_ends_at, current_period_end, billing_notes")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!shop) return { shop: null, payments: [] };
    const { data: payments } = await context.supabase
      .from("shop_payments").select("amount, currency, method, reference, period_start, period_end, notes, created_at")
      .eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(20);
    return { shop, payments: payments ?? [] };
  });



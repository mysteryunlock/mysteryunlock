import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailSchema, slugSchema, nameSchema } from "@/lib/validation";

const ADMIN_NOTIFY_EMAIL = "support@mysteryunlock.com";

// ---------------------------------------------------------------------------
// Per-email rate limiter for sign-up submissions.
// Prevents rapid requests from probing which emails are already registered.
// 5 attempts per email per 15 minutes.
// ---------------------------------------------------------------------------
type RateRecord = { count: number; windowStart: number };
const _signupRates = new Map<string, RateRecord>();

function checkSignupRate(email: string): void {
  const now = Date.now();
  const WINDOW = 15 * 60_000; // 15 minutes
  const MAX = 5;
  const key = email.toLowerCase();
  const rec = _signupRates.get(key) ?? { count: 0, windowStart: now };
  if (now - rec.windowStart > WINDOW) { rec.count = 0; rec.windowStart = now; }
  if (rec.count >= MAX) throw new Error("Too many requests. Please wait a few minutes before trying again.");
  rec.count++;
  _signupRates.set(key, rec);
}

async function isSuperAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles").select("role")
    .eq("user_id", ctx.userId).eq("role", "super_admin").maybeSingle();
  return !!data;
}

async function notifyAdmin(args: { email: string; shop_name: string; slug: string }) {
  // Best-effort notification. Only fires if SITE_URL and a /api/send-email route are configured.
  // The admin can always see new requests in the super-admin dashboard regardless.
  try {
    const origin = process.env.SITE_URL || process.env.PUBLIC_SITE_URL || "";
    if (!origin) return;
    await fetch(`${origin}/api/notify-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopName: args.shop_name,
        slug: args.slug,
        email: args.email,
      }),
    });
  } catch {/* ignore — in-app badge still works */}
}

// ----- PUBLIC: submit a new signup request -----
export const submitSignupRequest = createServerFn({ method: "POST" })
  .validator(
    z.object({
      shop_name: nameSchema,
      slug: slugSchema,
      email: emailSchema,
      // password intentionally not accepted — stored credentials are a security risk.
      // On approval the user receives a "set your password" email instead.
    }),
  )
  .handler(async ({ data }) => {
    // Rate-limit per email before any database lookups to prevent enumeration.
    checkSignupRate(data.email);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Does this email already have an active shop? (user who verified OTP already exists in Supabase auth)
    // Return { ok: true } silently rather than a distinguishable error — revealing that the
    // email is registered would let an attacker enumerate accounts via rapid sign-up attempts.
    // Legitimate users are already caught by the client-side checkEmailRegisteredFn check before
    // they reach this server function.
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existingUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (existingUser) {
      const { data: existingShop } = await supabaseAdmin
        .from("shops").select("id").eq("owner_user_id", existingUser.id).maybeSingle();
      if (existingShop) return { ok: true };
    }

    // Slug taken by an active shop?
    const { data: shopTaken } = await supabaseAdmin
      .from("shops").select("id").eq("slug", data.slug).maybeSingle();
    if (shopTaken) throw new Error("That shop URL is taken — try another.");

    // Already a pending request for this email?
    // Return { ok: true } silently rather than a distinguishable error — throwing here would
    // let an attacker distinguish a newly-submitted (unregistered) email from a registered
    // one via a two-attempt probe: registered emails hit the early-return above and always
    // succeed, while unregistered emails would succeed on attempt 1 and throw on attempt 2.
    // Returning ok on both attempts makes all paths indistinguishable externally.
    const { data: dup } = await supabaseAdmin
      .from("pending_signups")
      .select("id").ilike("email", data.email).eq("status", "pending").maybeSingle();
    if (dup) return { ok: true };

    // password column is left empty — credentials are never stored server-side.
    const { error } = await supabaseAdmin.from("pending_signups").insert({
      email: data.email,
      password: "",
      shop_name: data.shop_name,
      slug: data.slug,
    });
    if (error) throw new Error(error.message);

    await notifyAdmin({ email: data.email, shop_name: data.shop_name, slug: data.slug });
    return { ok: true };
  });

// ----- PUBLIC: check the status of a request by email -----
export const getSignupRequestStatus = createServerFn({ method: "POST" })
  .validator(z.object({ email: emailSchema }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("pending_signups")
      .select("status, review_notes, created_at, reviewed_at")
      .ilike("email", data.email)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();
    return { request: row ?? null };
  });

// ----- ADMIN: list signup requests -----
export const listSignupRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("pending_signups")
      .select("id, email, shop_name, slug, status, review_notes, reviewed_at, created_at")
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    const requests = data ?? [];
    return {
      requests,
      pendingCount: requests.filter((r) => r.status === "pending").length,
    };
  });

// ----- ADMIN: approve -----
export const approveSignupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("pending_signups").select("*").eq("id", data.id).maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error(`Already ${req.status}`);

    // Re-check slug availability at approval time
    const { data: shopTaken } = await supabaseAdmin
      .from("shops").select("id").eq("slug", req.slug).maybeSingle();
    if (shopTaken) throw new Error("Shop URL is no longer available. Reject and ask the user to pick a new one.");

    // Find or create the Supabase auth user.
    // (User may already exist if they verified their email via OTP during signup.)
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 });
    const existingUser = allUsers?.users?.find((u) => u.email?.toLowerCase() === req.email.toLowerCase());

    let userId: string;
    if (existingUser) {
      // User already has an auth account (OTP path) — no credential change needed.
      userId = existingUser.id;
    } else {
      // Brand-new user — create without a password. We never store plaintext credentials;
      // the user will receive a "set your password" email so they can choose their own.
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: req.email,
        email_confirm: true,
      });
      if (createErr || !created.user) throw new Error(createErr?.message || "Could not create user");
      userId = created.user.id;

      // Send a password-reset / "set password" email so the user can sign in.
      // Best-effort — approval still succeeds even if the email fails.
      await supabaseAdmin.auth.resetPasswordForEmail(req.email).catch(() => {});
    }

    // Create the shop
    const { error: shopErr } = await supabaseAdmin.from("shops").insert({
      name: req.shop_name,
      slug: req.slug,
      owner_user_id: userId,
    });
    if (shopErr) {
      // Rollback only if we just created the user (don't delete pre-existing OTP users)
      if (!existingUser) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      }
      throw new Error(shopErr.message);
    }

    // Mark approved + ensure password field is cleared
    await supabaseAdmin.from("pending_signups")
      .update({ status: "approved", password: "", reviewed_at: new Date().toISOString(), reviewed_by: context.userId })
      .eq("id", data.id);

    return { ok: true };
  });

// ----- ADMIN: reject -----
export const rejectSignupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid(), notes: z.string().max(500).optional() }))
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req } = await supabaseAdmin
      .from("pending_signups").select("status").eq("id", data.id).maybeSingle();
    if (!req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error(`Already ${req.status}`);

    const { error } = await supabaseAdmin.from("pending_signups").update({
      status: "rejected",
      password: "",
      review_notes: data.notes || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.userId,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- ADMIN: delete (cleanup) -----
export const deleteSignupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("pending_signups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

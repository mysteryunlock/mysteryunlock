import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailSchema } from "@/lib/validation";

const slugSchema = z
  .string().trim().toLowerCase().min(2).max(40)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Use lowercase letters, numbers and dashes only");
const nameSchema = z.string().trim().min(1).max(80);

const ADMIN_NOTIFY_EMAIL = "support@mysteryunlock.com";

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
      password: z.string().min(6).max(128),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Does this email already have an active shop? (user who verified OTP already exists in Supabase auth)
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existingUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (existingUser) {
      const { data: existingShop } = await supabaseAdmin
        .from("shops").select("id").eq("owner_user_id", existingUser.id).maybeSingle();
      if (existingShop) throw new Error("This email already has an active shop. Try signing in instead.");
    }

    // Slug taken by an active shop?
    const { data: shopTaken } = await supabaseAdmin
      .from("shops").select("id").eq("slug", data.slug).maybeSingle();
    if (shopTaken) throw new Error("That shop URL is taken — try another.");

    // Already a pending request for this email?
    const { data: dup } = await supabaseAdmin
      .from("pending_signups")
      .select("id").ilike("email", data.email).eq("status", "pending").maybeSingle();
    if (dup) throw new Error("You already have a pending request. Please wait for admin approval.");

    const { error } = await supabaseAdmin.from("pending_signups").insert({
      email: data.email,
      password: data.password,
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

    // Find or create the Supabase auth user
    // (user may already exist if they verified their email via OTP during signup)
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 });
    const existingUser = allUsers?.users?.find((u) => u.email?.toLowerCase() === req.email.toLowerCase());

    let userId: string;
    if (existingUser) {
      // User already exists — update their password to match what was stored in the request
      userId = existingUser.id;
      if (req.password) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: req.password }).catch(() => {});
      }
    } else {
      // Create a brand-new user (legacy path: request submitted before OTP flow)
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: req.email,
        password: req.password,
        email_confirm: true,
      });
      if (createErr || !created.user) throw new Error(createErr?.message || "Could not create user");
      userId = created.user.id;
    }

    // Create the shop
    const { error: shopErr } = await supabaseAdmin.from("shops").insert({
      name: req.shop_name,
      slug: req.slug,
      owner_user_id: userId,
    });
    if (shopErr) {
      // rollback only if we just created the user (don't delete pre-existing OTP users)
      if (!existingUser) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      }
      throw new Error(shopErr.message);
    }

    // Mark approved + clear stored password
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

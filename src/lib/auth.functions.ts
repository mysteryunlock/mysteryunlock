import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import ws from "ws";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter (per email).
// Supabase already enforces rate limits on its auth API, but this adds an
// extra application-level guard that survives within a single server process.
// ---------------------------------------------------------------------------
type RateRecord = { count: number; windowStart: number; lockedUntil?: number };
const _sendRates = new Map<string, RateRecord>();   // OTP send: 3 per 60 s
const _verifyRates = new Map<string, RateRecord>(); // Verify: 5 attempts per 10 min, then 15 min lockout

function checkSendRate(email: string): void {
  const now = Date.now();
  const WINDOW = 60_000;     // 60 seconds
  const MAX = 3;             // max 3 sends per window
  const rec = _sendRates.get(email) ?? { count: 0, windowStart: now };
  if (now - rec.windowStart > WINDOW) { rec.count = 0; rec.windowStart = now; }
  if (rec.count >= MAX) throw new Error("Too many requests. Please wait a minute before trying again.");
  rec.count++;
  _sendRates.set(email, rec);
}

function checkVerifyRate(email: string): void {
  const now = Date.now();
  const WINDOW = 10 * 60_000;   // 10 minutes
  const MAX = 5;                 // max 5 attempts per window
  const LOCKOUT = 15 * 60_000;  // 15-minute lockout after MAX failures
  const rec = _verifyRates.get(email) ?? { count: 0, windowStart: now };
  if (rec.lockedUntil && now < rec.lockedUntil) {
    const mins = Math.ceil((rec.lockedUntil - now) / 60_000);
    throw new Error(`Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
  if (now - rec.windowStart > WINDOW) { rec.count = 0; rec.windowStart = now; delete rec.lockedUntil; }
  if (rec.count >= MAX) { rec.lockedUntil = now + LOCKOUT; _verifyRates.set(email, rec); throw new Error("Too many failed attempts. Please wait 15 minutes before trying again."); }
  rec.count++;
  _verifyRates.set(email, rec);
}

function clearVerifyRate(email: string): void {
  _verifyRates.delete(email);
}

/**
 * Send a confirmation link to a new email address.
 * Uses the authenticated supabase client from the middleware (bearer-token based),
 * which avoids the "Auth session missing" error that occurs when calling
 * supabase.auth.updateUser directly from the browser after a tab reload.
 */
export const changeEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ newEmail: z.string().email() }))
  .handler(async ({ data }) => {
    // supabase.auth.updateUser() requires a client-side auth session, which a
    // bearer-token-only server client doesn't have. Call the Auth REST
    // endpoint directly instead — same behavior (sends the confirmation email
    // to the new address), no session dependency.
    const { getRequest } = await import("@tanstack/react-start/server");
    const authHeader = getRequest()?.headers.get("authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: {
        Authorization: authHeader,
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: data.newEmail }),
    });
    if (!res.ok) {
      let message = "Failed to send confirmation email.";
      try {
        const body = (await res.json()) as { msg?: string; message?: string; error_description?: string };
        message = body.msg ?? body.message ?? body.error_description ?? message;
      } catch {}
      throw new Error(message);
    }
    return { ok: true };
  });

/**
 * Change password after verifying the current one.
 * Uses the admin API server-side so it works regardless of whether
 * Supabase's "Secure password change" setting is on or off.
 */
export const changePasswordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Get the user's email
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = userData.user?.email;
    if (!email) throw new Error("Could not find your account email.");

    // 2. Verify current password by attempting a sign-in
    const { error: verifyErr } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password: data.currentPassword,
    });
    if (verifyErr) throw new Error("Current password is incorrect.");

    // 3. Force-update using admin API (bypasses secure-password-change requirement)
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      context.userId,
      { password: data.newPassword },
    );
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true };
  });

/**
 * Check whether an email address is already registered in Supabase Auth.
 * Uses the admin REST API (service-role key) so it works without a session.
 * Returns { exists: boolean }.
 */
export const checkEmailRegisteredFn = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const url = new URL(`${process.env.SUPABASE_URL}/auth/v1/admin/users`);
    url.searchParams.set("email", data.email);
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "1");
    const res = await fetch(url.toString(), {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`,
      },
    });
    if (!res.ok) {
      console.warn("[checkEmailRegisteredFn] admin lookup failed:", res.status);
      return { exists: false };
    }
    const body = (await res.json()) as { users?: unknown[] } | unknown[] | null;
    const users = Array.isArray(body) ? body : (body as { users?: unknown[] })?.users ?? [];
    return { exists: users.length > 0 };
  });

/**
 * Send a one-time password to the user's email for password reset.
 */
export const sendPasswordOtpFn = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    // App-level rate limit before hitting Supabase
    checkSendRate(data.email.toLowerCase());

    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false }, realtime: { transport: ws } },
    );
    // Use resetPasswordForEmail so the email comes from the "Reset Password"
    // template (semantically correct). No redirectTo — code-only flow.
    const { error } = await sb.auth.resetPasswordForEmail(data.email);
    // Always return ok — don't leak whether the email exists or failed
    if (error) console.warn("[sendPasswordOtpFn]", error.message);
    return { ok: true };
  });

/**
 * Verify the OTP and immediately set a new password.
 * Verifies via the anon client, then uses admin API to set the password.
 */
export const verifyOtpAndSetPasswordFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email(),
      otp: z.string().length(6).regex(/^\d{6}$/, "Code must be 6 digits"),
      newPassword: z.string().min(8).max(128),
    }),
  )
  .handler(async ({ data }) => {
    // App-level rate limit — prevents brute-forcing the OTP space
    checkVerifyRate(data.email.toLowerCase());

    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false }, realtime: { transport: ws } },
    );

    // 1. Verify OTP — type "recovery" matches resetPasswordForEmail
    const { data: session, error: otpErr } = await sb.auth.verifyOtp({
      email: data.email,
      token: data.otp,
      type: "recovery",
    });
    if (otpErr || !session.user) throw new Error("Invalid or expired code. Please try again.");

    // OTP verified successfully — clear the attempt counter
    clearVerifyRate(data.email.toLowerCase());

    // 2. Use admin API to set the new password
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      session.user.id,
      { password: data.newPassword },
    );
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true };
  });

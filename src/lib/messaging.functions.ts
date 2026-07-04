import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(ctx: { supabase: any; userId: string }, shopId: string) {
  const { data, error } = await ctx.supabase
    .from("shops")
    .select("id, name")
    .eq("id", shopId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (error || !data) throw new Error("Not authorized for this shop");
  return data as { id: string; name: string };
}

const recipientSchema = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().toLowerCase().email().max(255),
  prize: z.string().max(120).optional().nullable(),
});

// ---------- EMAIL (bulk) ----------
// Sends each recipient individually via the Lovable Emails transactional queue.
// Requires: email domain configured + email infra scaffolded.
export const sendBulkEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      subject: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(5000),
      recipients: z.array(recipientSchema).min(1).max(500),
    }),
  )
  .handler(async ({ data, context }) => {
    const shop = await assertOwner(context, data.shopId);

    // Use the Lovable transactional email send route (scaffolded by setup).
    // If not scaffolded, the route returns 404 and we surface a clear message.
    const origin = process.env.SITE_URL || "";
    if (!origin) {
      return {
        ok: false as const,
        reason: "not_configured" as const,
        message: "Email sending is not configured yet. Set up an email domain first.",
      };
    }

    const substitute = (text: string, r: { name?: string | null; prize?: string | null }) =>
      text
        .replaceAll("{customer_name}", r.name || "")
        .replaceAll("{prize_name}", r.prize || "")
        .replaceAll("{shop_name}", shop.name)
        .replaceAll("{{name}}", r.name || "")
        .replaceAll("{{prize}}", r.prize || "")
        .replaceAll("{{shop}}", shop.name);

    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const r of data.recipients) {
      const personalizedBody = substitute(data.body, r);
      const personalizedSubject = substitute(data.subject, r);

      try {
        const resp = await fetch(`${origin}/lovable/email/transactional/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateName: "generic-broadcast",
            recipientEmail: r.email,
            templateData: { subject: personalizedSubject, body: personalizedBody, name: r.name },
          }),
        });
        results.push({ email: r.email, ok: resp.ok, error: resp.ok ? undefined : await resp.text() });
      } catch (e) {
        results.push({ email: r.email, ok: false, error: e instanceof Error ? e.message : "send failed" });
      }
    }
    const sent = results.filter((r) => r.ok).length;
    return { ok: true as const, sent, total: results.length, results };
  });

// ---------- WHATSAPP CLOUD API (bulk) ----------
// Requires secrets: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID.
// Sends a free-form text. Note: outside the 24-hour customer-service window
// Meta requires a pre-approved template; this endpoint will return a per-recipient
// error in that case so the user sees what failed.
const waRecipient = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  contact: z.string().trim().min(5).max(30),
  prize: z.string().max(120).optional().nullable(),
});

export const sendBulkWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      body: z.string().trim().min(1).max(4000),
      recipients: z.array(waRecipient).min(1).max(500),
    }),
  )
  .handler(async ({ data, context }) => {
    const shop = await assertOwner(context, data.shopId);

    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
      return {
        ok: false as const,
        reason: "not_configured" as const,
        message:
          "WhatsApp Business API isn't configured yet. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID secrets.",
      };
    }

    const substitute = (text: string, r: { name?: string | null; prize?: string | null }) =>
      text
        .replaceAll("{customer_name}", r.name || "")
        .replaceAll("{prize_name}", r.prize || "")
        .replaceAll("{shop_name}", shop.name)
        .replaceAll("{{name}}", r.name || "")
        .replaceAll("{{prize}}", r.prize || "")
        .replaceAll("{{shop}}", shop.name);

    const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
    const results: { to: string; ok: boolean; error?: string }[] = [];
    for (const r of data.recipients) {
      const to = r.contact.replace(/[^\d+]/g, "").replace(/^\+/, "");
      if (!to || to.length < 6) {
        results.push({ to: r.contact, ok: false, error: "invalid phone number" });
        continue;
      }
      const body = substitute(data.body, r);

      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { preview_url: false, body },
          }),
        });
        if (resp.ok) {
          results.push({ to, ok: true });
        } else {
          const errText = await resp.text();
          results.push({ to, ok: false, error: errText.slice(0, 300) });
        }
      } catch (e) {
        results.push({ to, ok: false, error: e instanceof Error ? e.message : "send failed" });
      }
    }
    const sent = results.filter((r) => r.ok).length;
    return { ok: true as const, sent, total: results.length, results };
  });

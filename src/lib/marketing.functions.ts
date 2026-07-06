import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ── Auth helper ────────────────────────────────────────────────────────────────

async function assertOwner(
  ctx: { supabase: any; userId: string },
  shopId: string,
) {
  const { data, error } = await ctx.supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (error || !data) throw new Error("Not authorized for this shop");
}

// ── saveBroadcast ──────────────────────────────────────────────────────────────
// Records a completed broadcast in the database.
// Called client-side after each send flow completes.

export const saveBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId:         z.string().uuid(),
      channel:        z.enum(["sms", "whatsapp", "email"]),
      name:           z.string().max(120).optional().nullable(),
      subject:        z.string().max(200).optional().nullable(),
      body:           z.string().min(1).max(4000),
      segmentFilter:  z.string().max(40).default("all"),
      campaignId:     z.string().uuid().optional().nullable(),
      recipientCount: z.number().int().min(0),
      sentCount:      z.number().int().min(0),
      failedCount:    z.number().int().min(0),
      status:         z.enum(["sent", "partial", "failed", "opened"]),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    const { error } = await (context.supabase as any)
      .from("marketing_broadcasts")
      .insert({
        shop_id:         data.shopId,
        channel:         data.channel,
        name:            data.name ?? null,
        subject:         data.subject ?? null,
        body:            data.body,
        segment_filter:  data.segmentFilter,
        campaign_id:     data.campaignId ?? null,
        recipient_count: data.recipientCount,
        sent_count:      data.sentCount,
        failed_count:    data.failedCount,
        status:          data.status,
        sent_at:         new Date().toISOString(),
        created_by:      context.userId,
      });

    if (error) throw new Error(`Failed to save broadcast: ${error.message}`);
    return { ok: true };
  });

// ── listBroadcasts ────────────────────────────────────────────────────────────
// Returns the 50 most recent broadcasts for the given shop, newest first.

export const listBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    const { data: rows, error } = await (context.supabase as any)
      .from("marketing_broadcasts")
      .select(
        "id, channel, name, subject, body, segment_filter, campaign_id, recipient_count, sent_count, failed_count, status, sent_at, created_at",
      )
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return { broadcasts: rows ?? [] };
  });

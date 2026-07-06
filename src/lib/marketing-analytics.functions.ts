import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ── Auth helper (mirrors existing pattern) ────────────────────────────────────

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

// ── getMarketingAnalytics ─────────────────────────────────────────────────────
// Reads all broadcasts for a shop within the given range and returns aggregated
// analytics: totals, delivery rate, channel split, timeline, segment breakdown,
// and top 10 broadcasts.

export const getMarketingAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      range:  z.enum(["7d", "30d", "90d", "all"]),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    // ── Date range filter ──────────────────────────────────────────────────
    let fromDate: string | null = null;
    if (data.range !== "all") {
      const days = data.range === "7d" ? 7 : data.range === "30d" ? 30 : 90;
      const d = new Date();
      d.setDate(d.getDate() - days);
      fromDate = d.toISOString();
    }

    let query = (context.supabase as any)
      .from("marketing_broadcasts")
      .select(
        "id, channel, name, subject, body, segment_filter, recipient_count, sent_count, failed_count, status, sent_at, created_at",
      )
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false });

    if (fromDate) {
      query = query.gte("created_at", fromDate);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const broadcasts: Record<string, unknown>[] = rows ?? [];

    // ── Totals ────────────────────────────────────────────────────────────
    let totalRecipients = 0;
    let totalDelivered  = 0;
    let totalFailed     = 0;

    for (const r of broadcasts) {
      totalRecipients += Number(r.recipient_count ?? 0);
      totalDelivered  += Number(r.sent_count      ?? 0);
      totalFailed     += Number(r.failed_count     ?? 0);
    }

    const totals = {
      broadcasts: broadcasts.length,
      recipients: totalRecipients,
      delivered:  totalDelivered,
      failed:     totalFailed,
    };

    const deliveryRate =
      totals.recipients > 0
        ? Math.round((totals.delivered / totals.recipients) * 100)
        : 0;

    // ── Channel breakdown ────────────────────────────────────────────────
    const channels = { sms: 0, whatsapp: 0, email: 0 };
    for (const r of broadcasts) {
      const ch = String(r.channel ?? "");
      if (ch === "sms" || ch === "whatsapp" || ch === "email") {
        channels[ch]++;
      }
    }

    // ── Timeline: group by calendar date ─────────────────────────────────
    const timelineMap = new Map<string, { broadcasts: number; recipients: number }>();
    for (const r of broadcasts) {
      const raw  = String(r.created_at ?? r.sent_at ?? "");
      const date = raw.slice(0, 10); // "YYYY-MM-DD"
      if (!date) continue;
      const entry = timelineMap.get(date) ?? { broadcasts: 0, recipients: 0 };
      entry.broadcasts++;
      entry.recipients += Number(r.recipient_count ?? 0);
      timelineMap.set(date, entry);
    }
    const timeline = Array.from(timelineMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, broadcasts: v.broadcasts, recipients: v.recipients }));

    // ── Segment breakdown ─────────────────────────────────────────────────
    const segmentMap = new Map<string, number>();
    for (const r of broadcasts) {
      const seg = String(r.segment_filter ?? "all");
      segmentMap.set(seg, (segmentMap.get(seg) ?? 0) + 1);
    }
    const segmentBreakdown = Array.from(segmentMap.entries())
      .map(([segment, count]) => ({ segment, broadcasts: count }))
      .sort((a, b) => b.broadcasts - a.broadcasts);

    // ── Top 10 broadcasts ─────────────────────────────────────────────────
    const topBroadcasts = broadcasts.slice(0, 10).map((r) => ({
      id:             String(r.id),
      name:
        String(
          r.name ??
          (r.channel === "email" ? r.subject : String(r.body ?? "").slice(0, 40)) ??
          "Broadcast",
        ),
      channel:        String(r.channel ?? ""),
      recipientCount: Number(r.recipient_count ?? 0),
      sentCount:      Number(r.sent_count      ?? 0),
      failedCount:    Number(r.failed_count     ?? 0),
      sentAt:         String(r.sent_at ?? r.created_at ?? ""),
    }));

    return { totals, deliveryRate, channels, timeline, segmentBreakdown, topBroadcasts };
  });

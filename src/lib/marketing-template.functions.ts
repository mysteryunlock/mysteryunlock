import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ── Schema-guard helpers ───────────────────────────────────────────────────────

/**
 * Returns true when the Postgres error message indicates a missing relation or
 * column — i.e. the migration 20260706200000_marketing_templates.sql has not
 * yet been applied to the live database.
 */
export function isSchemaMissingError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("undefined column") ||
    lower.includes("column") && lower.includes("relation")
  );
}

/**
 * Wraps a Supabase error as a JavaScript Error. When the error looks like a
 * missing schema object it replaces the cryptic Postgres message with an
 * actionable instruction for the operator.
 */
export function guardSchema(
  error: { message: string },
  hint: string,
): Error {
  if (isSchemaMissingError(error.message)) {
    return new Error(
      `Database migration not applied (${hint}). ` +
        "Open the Supabase SQL editor and run " +
        "supabase/migrations/20260706200000_marketing_templates.sql — " +
        "or copy from supabase/pending_migrations.sql. " +
        `(Postgres said: ${error.message})`,
    );
  }
  return new Error(error.message);
}

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

// ── Template row → client shape ────────────────────────────────────────────────

function mapTemplate(r: Record<string, unknown>) {
  return {
    id:        String(r.id),
    shopId:    String(r.shop_id),
    name:      String(r.name),
    category:  String(r.category ?? "Custom"),
    subject:   r.subject != null ? String(r.subject) : null,
    body:      String(r.body ?? ""),
    favorite:  Boolean(r.favorite),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE CRUD
// ══════════════════════════════════════════════════════════════════════════════

// ── checkMarketingSchema ──────────────────────────────────────────────────────
// Probes the live database for the objects added by migration
// 20260706200000_marketing_templates.sql.  Returns { ok, missing } so the UI
// can surface a banner before any write attempt fails.

export const checkMarketingSchema = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    const missing: string[] = [];

    // 1. marketing_templates table
    const { error: tplErr } = await (context.supabase as any)
      .from("marketing_templates")
      .select("id")
      .limit(0);
    if (tplErr && isSchemaMissingError(tplErr.message)) {
      missing.push("marketing_templates table");
    }

    // 2. scheduled_at column on marketing_broadcasts
    const { error: colErr } = await (context.supabase as any)
      .from("marketing_broadcasts")
      .select("scheduled_at")
      .limit(0);
    if (colErr && isSchemaMissingError(colErr.message)) {
      missing.push("scheduled_at column on marketing_broadcasts");
    }

    return { ok: missing.length === 0, missing };
  });

// ── listTemplates ─────────────────────────────────────────────────────────────

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    const { data: rows, error } = await (context.supabase as any)
      .from("marketing_templates")
      .select("id, shop_id, name, category, subject, body, favorite, created_at, updated_at")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false });

    if (error) throw guardSchema(error, "listTemplates");
    return { templates: (rows ?? []).map(mapTemplate) };
  });

// ── createTemplate ────────────────────────────────────────────────────────────

export const createTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId:   z.string().uuid(),
      name:     z.string().min(1).max(120),
      category: z.string().max(40).default("Custom"),
      subject:  z.string().max(200).optional().nullable(),
      body:     z.string().min(1).max(4000),
      favorite: z.boolean().default(false),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    const { data: row, error } = await (context.supabase as any)
      .from("marketing_templates")
      .insert({
        shop_id:  data.shopId,
        name:     data.name,
        category: data.category,
        subject:  data.subject ?? null,
        body:     data.body,
        favorite: data.favorite,
      })
      .select()
      .single();

    if (error) throw guardSchema(error, "createTemplate");
    return { template: mapTemplate(row) };
  });

// ── updateTemplate ────────────────────────────────────────────────────────────

export const updateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId:     z.string().uuid(),
      templateId: z.string().uuid(),
      name:       z.string().min(1).max(120),
      category:   z.string().max(40).default("Custom"),
      subject:    z.string().max(200).optional().nullable(),
      body:       z.string().min(1).max(4000),
      favorite:   z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    const { data: row, error } = await (context.supabase as any)
      .from("marketing_templates")
      .update({
        name:       data.name,
        category:   data.category,
        subject:    data.subject ?? null,
        body:       data.body,
        favorite:   data.favorite,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.templateId)
      .eq("shop_id", data.shopId)
      .select()
      .single();

    if (error) throw guardSchema(error, "updateTemplate");
    return { template: mapTemplate(row) };
  });

// ── deleteTemplate ────────────────────────────────────────────────────────────

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId:     z.string().uuid(),
      templateId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    const { error } = await (context.supabase as any)
      .from("marketing_templates")
      .delete()
      .eq("id", data.templateId)
      .eq("shop_id", data.shopId);

    if (error) throw guardSchema(error, "deleteTemplate");
    return { ok: true };
  });

// ── duplicateTemplate ─────────────────────────────────────────────────────────

export const duplicateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId:     z.string().uuid(),
      templateId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    const { data: orig, error: fetchErr } = await (context.supabase as any)
      .from("marketing_templates")
      .select("name, category, subject, body")
      .eq("id", data.templateId)
      .eq("shop_id", data.shopId)
      .single();

    if (fetchErr) throw guardSchema(fetchErr, "duplicateTemplate:fetch");
    if (!orig) throw new Error("Template not found");

    const { data: row, error } = await (context.supabase as any)
      .from("marketing_templates")
      .insert({
        shop_id:  data.shopId,
        name:     `Copy of ${orig.name}`,
        category: orig.category,
        subject:  orig.subject,
        body:     orig.body,
        favorite: false,
      })
      .select()
      .single();

    if (error) throw guardSchema(error, "duplicateTemplate:insert");
    return { template: mapTemplate(row) };
  });

// ── toggleFavorite ────────────────────────────────────────────────────────────

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId:     z.string().uuid(),
      templateId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    const { data: current, error: fetchErr } = await (context.supabase as any)
      .from("marketing_templates")
      .select("favorite")
      .eq("id", data.templateId)
      .eq("shop_id", data.shopId)
      .single();

    if (fetchErr) throw guardSchema(fetchErr, "toggleFavorite:fetch");
    if (!current) throw new Error("Template not found");

    const { data: row, error } = await (context.supabase as any)
      .from("marketing_templates")
      .update({ favorite: !current.favorite, updated_at: new Date().toISOString() })
      .eq("id", data.templateId)
      .eq("shop_id", data.shopId)
      .select()
      .single();

    if (error) throw guardSchema(error, "toggleFavorite:update");
    return { template: mapTemplate(row) };
  });

// ══════════════════════════════════════════════════════════════════════════════
// SCHEDULING
// ══════════════════════════════════════════════════════════════════════════════

// ── saveScheduledBroadcast ────────────────────────────────────────────────────
// Persists a broadcast with status = 'scheduled' and a future scheduled_at.

export const saveScheduledBroadcast = createServerFn({ method: "POST" })
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
      scheduledAt:    z.string(), // ISO string
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    const { data: row, error } = await (context.supabase as any)
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
        sent_count:      0,
        failed_count:    0,
        status:          "scheduled",
        scheduled_at:    data.scheduledAt,
        created_by:      context.userId,
      })
      .select()
      .single();

    if (error) throw guardSchema(error, "saveScheduledBroadcast");
    return { ok: true, id: String(row.id) };
  });

// ── listScheduledBroadcasts ───────────────────────────────────────────────────
// Returns all non-cancelled scheduled broadcasts for a shop, newest first.

export const listScheduledBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ shopId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    const { data: rows, error } = await (context.supabase as any)
      .from("marketing_broadcasts")
      .select(
        "id, channel, name, subject, body, segment_filter, campaign_id, recipient_count, status, scheduled_at, created_at",
      )
      .eq("shop_id", data.shopId)
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true });

    if (error) throw guardSchema(error, "listScheduledBroadcasts");

    const broadcasts = (rows ?? []).map((r: Record<string, unknown>) => ({
      id:             String(r.id),
      channel:        String(r.channel),
      name:           r.name != null ? String(r.name) : null,
      subject:        r.subject != null ? String(r.subject) : null,
      body:           String(r.body ?? ""),
      segmentFilter:  String(r.segment_filter ?? "all"),
      recipientCount: Number(r.recipient_count ?? 0),
      scheduledAt:    String(r.scheduled_at ?? ""),
      status:         "scheduled" as const,
      createdAt:      String(r.created_at),
    }));

    return { broadcasts };
  });

// ── cancelScheduledBroadcast ──────────────────────────────────────────────────

export const cancelScheduledBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId:      z.string().uuid(),
      broadcastId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    const { error } = await (context.supabase as any)
      .from("marketing_broadcasts")
      .update({ status: "cancelled" })
      .eq("id", data.broadcastId)
      .eq("shop_id", data.shopId)
      .eq("status", "scheduled");

    if (error) throw guardSchema(error, "cancelScheduledBroadcast");
    return { ok: true };
  });

// ── markBroadcastSent ─────────────────────────────────────────────────────────
// Marks a scheduled broadcast as manually sent.

export const markBroadcastSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId:      z.string().uuid(),
      broadcastId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.shopId);

    const { data: row, error } = await (context.supabase as any)
      .from("marketing_broadcasts")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.broadcastId)
      .eq("shop_id", data.shopId)
      .select("channel, body, subject, segment_filter, recipient_count")
      .single();

    if (error) throw guardSchema(error, "markBroadcastSent");

    return {
      ok:             true,
      channel:        String(row.channel),
      body:           String(row.body ?? ""),
      subject:        row.subject != null ? String(row.subject) : null,
      segmentFilter:  String(row.segment_filter ?? "all"),
      recipientCount: Number(row.recipient_count ?? 0),
    };
  });

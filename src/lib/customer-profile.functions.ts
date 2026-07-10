import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertShopOwner(
  ctx: { supabase: any; userId: string },
  shopId: string,
): Promise<void> {
  const { data, error } = await ctx.supabase
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (error || !data) throw new Error("Not authorized for this shop.");
}

export type CustomerDetail = {
  customerId: string;
  name: string | null;
  email: string;
  phone: string | null;
  connectCode: string | null;
  status: string;
  firstSeen: string | null;
  lastVisit: string | null;
  memberSince: string;
};

export type SpinRecord = {
  code: string;
  spun_at: string | null;
  prize_won: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
};

export const getCustomerDetailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      customerId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertShopOwner(context, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cast to any: customer_id was added via migration and may not be in
    // auto-generated types; the nested select with FK hint also causes
    // type-narrowing failures in some Supabase TS versions.
    const { data: member, error } = await (supabaseAdmin as any)
      .from("shop_customers")
      .select(`
        status, first_seen, last_visit, created_at,
        customers ( name, email, phone, connect_code )
      `)
      .eq("shop_id", data.shopId)
      .eq("customer_id", data.customerId)
      .maybeSingle() as { data: any; error: any };

    if (error) throw new Error(error.message);
    if (!member) throw new Error("Customer not found in this shop.");

    const cust = Array.isArray(member.customers)
      ? member.customers[0]
      : member.customers;

    const result: CustomerDetail = {
      customerId: data.customerId,
      name: cust?.name ?? null,
      email: cust?.email ?? "",
      phone: cust?.phone ?? null,
      connectCode: cust?.connect_code ?? null,
      status: member.status ?? "active",
      firstSeen: member.first_seen ?? null,
      lastVisit: member.last_visit ?? null,
      memberSince: member.created_at,
    };

    return result;
  });

export const getCustomerSpinsByIdFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      shopId: z.string().uuid(),
      customerId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertShopOwner(context, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cast to any: customer_id was added via migration after type generation.
    const { data: rawRows, error } = await (supabaseAdmin as any)
      .from("access_codes")
      .select("code, spun_at, prize_won, campaign_id")
      .eq("shop_id", data.shopId)
      .eq("customer_id", data.customerId)
      .not("spun_at", "is", null)
      .order("spun_at", { ascending: false })
      .limit(500) as { data: any; error: any };

    if (error) throw new Error(error.message);

    const spinRows = (rawRows ?? []) as Array<{
      code: string;
      spun_at: string | null;
      prize_won: string | null;
      campaign_id: string | null;
    }>;

    const campaignIds = [
      ...new Set(spinRows.map((r) => r.campaign_id).filter(Boolean) as string[]),
    ];
    let campaignNameMap: Record<string, string> = {};
    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabaseAdmin
        .from("campaigns")
        .select("id, name")
        .in("id", campaignIds);
      for (const c of (campaigns ?? []) as Array<{ id: string; name: string }>)
        campaignNameMap[c.id] = c.name;
    }

    const spins: SpinRecord[] = spinRows.map((r) => ({
      code: r.code,
      spun_at: r.spun_at,
      prize_won: r.prize_won,
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_id ? (campaignNameMap[r.campaign_id] ?? null) : null,
    }));

    return { spins };
  });

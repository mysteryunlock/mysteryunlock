import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Store, ChevronRight } from "lucide-react";
import { getMyProfileFn } from "@/lib/customer-auth.functions";
import { getMyShopsFn } from "@/lib/shop-connections.functions";
import { CustomerPortalHeader } from "@/components/customer/CustomerPortalHeader";
import { PageSkeleton, CardListSkeleton } from "@/components/customer/PortalSkeleton";
import { EmptyState } from "@/components/customer/EmptyState";

export const Route = createFileRoute("/_customer/portal/shops")({
  head: () => ({ meta: [{ title: "My Shops — Mystery Unlock" }] }),
  component: MyShopsPage,
});

type Customer = { id: string; email: string; name: string | null; phone: string | null; created_at: string };
type ShopConnection = {
  shopId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  status: string;
  lastVisit: string | null;
  connectedAt: string;
};

function fmtRelative(iso: string | null): string {
  if (!iso) return "Never visited";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Visited today";
  if (days === 1) return "Visited yesterday";
  if (days < 7) return `Visited ${days}d ago`;
  if (days < 30) return `Visited ${Math.floor(days / 7)}w ago`;
  if (days < 365) return `Visited ${Math.floor(days / 30)}mo ago`;
  return `Visited ${Math.floor(days / 365)}y ago`;
}

function MyShopsPage() {
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfileFn);
  const fetchShops = useServerFn(getMyShopsFn);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [shops, setShops] = useState<ShopConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopsLoading, setShopsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { customer: c } = await fetchProfile({ data: {} });
      setCustomer(c as Customer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/forbidden/i.test(msg)) { navigate({ to: "/dashboard" }); return; }
    } finally {
      setLoading(false);
    }
    try {
      const res = await fetchShops({ data: {} });
      setShops(res.shops as ShopConnection[]);
    } catch {
      // shops failed silently — list stays empty
    } finally {
      setShopsLoading(false);
    }
  }, [fetchProfile, fetchShops, navigate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton />;
  if (!customer) return null;

  return (
    <div className="min-h-[100dvh] bg-background">
      <CustomerPortalHeader customer={customer} activeTab="portal" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <section className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">My Shops</h1>
          <p className="text-sm text-muted-foreground mt-1">Shops you're connected to as a member</p>
        </section>

        {shopsLoading ? (
          <CardListSkeleton count={4} />
        ) : shops.length === 0 ? (
          <EmptyState
            icon={Store}
            heading="No shops connected yet"
            body="Scan a shop's QR code to connect and become a member."
          />
        ) : (
          <div className="space-y-2">
            {shops.map((s) => (
              <Link
                key={s.shopId}
                to="/s/$slug"
                params={{ slug: s.slug }}
                className="group relative z-10 w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md hover:border-gold/30 active:scale-[0.99] transition-all duration-200 text-left cursor-pointer min-h-[72px]"
              >
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden">
                  {s.logoUrl ? (
                    <img src={s.logoUrl} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{fmtRelative(s.lastVisit)}</p>
                </div>
                {!s.isActive && (
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    Inactive
                  </span>
                )}
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 group-hover:text-gold group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

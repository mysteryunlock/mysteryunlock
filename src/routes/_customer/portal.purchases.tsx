import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingBag } from "lucide-react";
import { getMyProfileFn } from "@/lib/customer-auth.functions";
import { getMyPurchasesFn } from "@/lib/purchases.functions";
import type { Purchase, CustomerPurchaseStats } from "@/lib/purchases.functions";
import { CustomerPortalHeader } from "@/components/customer/CustomerPortalHeader";
import { PageSkeleton } from "@/components/customer/PortalSkeleton";
import { EmptyState } from "@/components/customer/EmptyState";

export const Route = createFileRoute("/_customer/portal/purchases")({
  head: () => ({ meta: [{ title: "Purchases — Mystery Unlock" }] }),
  component: PurchasesPage,
});

type Customer = { id: string; email: string; name: string | null; phone: string | null; created_at: string };

function fmtAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-2xl bg-card border border-border px-4 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-black text-foreground mt-0.5 truncate">{value}</p>
    </div>
  );
}

function PurchasesPage() {
  const navigate       = useNavigate();
  const fetchProfile   = useServerFn(getMyProfileFn);
  const fetchPurchases = useServerFn(getMyPurchasesFn);

  const [customer,  setCustomer]  = useState<Customer | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stats,     setStats]     = useState<CustomerPurchaseStats | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  useEffect(() => {
    (async () => {
      try {
        const profileRes = await fetchProfile({ data: {} });
        setCustomer(profileRes.customer as Customer);

        try {
          const res = await fetchPurchases({ data: {} });
          setPurchases(res.purchases);
          setStats(res.stats);
        } catch (dataErr) {
          const msg = dataErr instanceof Error ? dataErr.message : "";
          setError(msg || "Could not load your purchases. Please try again.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (/forbidden/i.test(msg)) { navigate({ to: "/dashboard" }); return; }
        setError(msg || "Could not load your purchases. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageSkeleton />;
  if (!customer) return null;

  return (
    <div className="min-h-[100dvh] bg-background">
      <CustomerPortalHeader customer={customer} activeTab="purchases" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Heading */}
        <div className="animate-fade-in">
          <h1 className="text-xl font-bold text-foreground tracking-tight">My Purchases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats ? `${stats.totalPurchases} purchase${stats.totalPurchases !== 1 ? "s" : ""}` : "Purchase history across all shops"}
          </p>
        </div>

        {/* Stats strip */}
        {stats && stats.totalPurchases > 0 && (
          <div className="flex gap-3 animate-fade-in">
            <StatPill label="Lifetime Spend"   value={fmtAmount(stats.lifetimeSpend)} />
            <StatPill label="Total Purchases"  value={String(stats.totalPurchases)} />
            <StatPill label="Avg Order Value"  value={fmtAmount(stats.avgOrderValue)} />
          </div>
        )}

        {error && (
          <p className="text-destructive text-sm text-center">{error}</p>
        )}

        {!error && purchases.length === 0 && (
          <EmptyState
            icon="🛍️"
            heading="No purchases yet"
            body="When a shop records a purchase for you, it will appear here."
          />
        )}

        {purchases.length > 0 && (
          <div className="space-y-2 animate-fade-in">
            {purchases.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{p.shop_name ?? "Shop"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.category}
                    {p.notes ? <span className="opacity-70"> · {p.notes}</span> : null}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{fmtDate(p.created_at)}</p>
                </div>
                <p className="text-base font-black text-gold shrink-0 tabular-nums">
                  {fmtAmount(p.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

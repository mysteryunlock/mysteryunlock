import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfileFn } from "@/lib/customer-auth.functions";
import { getMyFullHistoryFn } from "@/lib/prize-claims.functions";
import { CustomerPortalHeader } from "@/components/customer/CustomerPortalHeader";
import { SpinHistoryCard } from "@/components/customer/SpinHistoryCard";
import { PageSkeleton, CardListSkeleton } from "@/components/customer/PortalSkeleton";
import { EmptyState } from "@/components/customer/EmptyState";
import { HistoryFilters, applyHistoryFilters } from "@/components/customer/HistoryFilters";
import type { HistoryFilter } from "@/components/customer/HistoryFilters";
import type { SpinWithContext } from "@/lib/prize-claims.functions";

export const Route = createFileRoute("/_customer/portal/history")({
  head: () => ({ meta: [{ title: "Spin History — Mystery Unlock" }] }),
  component: HistoryPage,
});

type Customer = { id: string; email: string; name: string | null; phone: string | null; created_at: string };

const DEFAULT_FILTERS: HistoryFilter = { result: "all", shop: "", period: "all" };

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function groupByMonth(spins: SpinWithContext[]): { month: string; items: SpinWithContext[] }[] {
  const groups: { month: string; items: SpinWithContext[] }[] = [];
  for (const spin of spins) {
    const month = spin.spun_at ? monthLabel(spin.spun_at) : "Unknown date";
    const last = groups[groups.length - 1];
    if (last && last.month === month) {
      last.items.push(spin);
    } else {
      groups.push({ month, items: [spin] });
    }
  }
  return groups;
}

function HistoryPage() {
  const navigate     = useNavigate();
  const fetchProfile = useServerFn(getMyProfileFn);
  const fetchHistory = useServerFn(getMyFullHistoryFn);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history,  setHistory]  = useState<SpinWithContext[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [filters,  setFilters]  = useState<HistoryFilter>(DEFAULT_FILTERS);

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, histRes] = await Promise.all([
          fetchProfile({ data: {} }),
          fetchHistory({ data: {} }),
        ]);
        setCustomer(profileRes.customer as Customer);
        setHistory(histRes.history);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (/forbidden/i.test(msg)) { navigate({ to: "/dashboard" }); return; }
        setError("Could not load your spin history. Please try again.");
      } finally { setLoading(false); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const uniqueShops = useMemo(
    () => [...new Set(history.map((s) => s.shop_name))].sort(),
    [history],
  );

  const filtered = useMemo(
    () => applyHistoryFilters(history, filters),
    [history, filters],
  );

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  const wins = history.filter((s) => !!s.prize_won).length;

  if (loading) return <PageSkeleton />;
  if (!customer) return null;

  return (
    <div className="min-h-screen bg-[#0F1115]">
      <CustomerPortalHeader customer={customer} activeTab="history" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-black">Spin History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {history.length} spin{history.length !== 1 ? "s" : ""} · {wins} win{wins !== 1 ? "s" : ""}
          </p>
        </div>

        {error && (
          <p className="text-destructive text-sm text-center">{error}</p>
        )}

        {!error && history.length === 0 && (
          <EmptyState
            icon="🎡"
            heading="No spins yet"
            body="Your spin history from participating shops will appear here."
          />
        )}

        {history.length > 0 && (
          <>
            <HistoryFilters
              filters={filters}
              shops={uniqueShops}
              onChange={setFilters}
              filteredCount={filtered.length}
              totalCount={history.length}
            />

            {filtered.length === 0 ? (
              <EmptyState
                icon="🔍"
                heading="No results"
                body="No spins match your current filters."
                action={{ label: "Clear filters", onClick: () => setFilters(DEFAULT_FILTERS) }}
              />
            ) : (
              <div className="space-y-6">
                {grouped.map(({ month, items }) => (
                  <section key={month}>
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      {month}
                    </h2>
                    <div className="space-y-2">
                      {items.map((spin) => (
                        <SpinHistoryCard key={spin.code} spin={spin} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

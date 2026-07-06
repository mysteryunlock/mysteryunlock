import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfileFn } from "@/lib/customer-auth.functions";
import { getMyFullHistoryFn } from "@/lib/prize-claims.functions";
import { CustomerPortalHeader } from "@/components/customer/CustomerPortalHeader";
import { SpinHistoryCard } from "@/components/customer/SpinHistoryCard";
import type { SpinWithContext } from "@/lib/prize-claims.functions";

export const Route = createFileRoute("/_customer/portal/history")({
  head: () => ({ meta: [{ title: "Spin History — Mystery Unlock" }] }),
  component: HistoryPage,
});

type Customer = { id: string; email: string; name: string | null; phone: string | null };

function HistoryPage() {
  const navigate     = useNavigate();
  const fetchProfile = useServerFn(getMyProfileFn);
  const fetchHistory = useServerFn(getMyFullHistoryFn);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history,  setHistory]  = useState<SpinWithContext[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1115] flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!customer) return null;

  const wins = history.filter((s) => !!s.prize_won).length;

  return (
    <div className="min-h-screen bg-[#0F1115]">
      <CustomerPortalHeader customer={customer} activeTab="history" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black">Spin History</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {history.length} spin{history.length !== 1 ? "s" : ""} · {wins} win{wins !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {error && (
          <p className="text-destructive text-sm text-center">{error}</p>
        )}

        {!error && history.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🎡</p>
            <p className="font-bold text-foreground">No spins yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Your spin history from participating shops will appear here.
            </p>
          </div>
        )}

        {history.length > 0 && (
          <div className="space-y-2">
            {history.map((spin) => (
              <SpinHistoryCard key={spin.code} spin={spin} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

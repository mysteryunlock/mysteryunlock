import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfileFn } from "@/lib/customer-auth.functions";
import { getMyPrizeClaimsFn } from "@/lib/prize-claims.functions";
import { CustomerPortalHeader } from "@/components/customer/CustomerPortalHeader";
import { PrizeClaimCard } from "@/components/customer/PrizeClaimCard";
import type { PrizeClaim } from "@/lib/prize-claims.functions";

export const Route = createFileRoute("/_customer/portal/prizes")({
  head: () => ({ meta: [{ title: "My Prizes — Mystery Unlock" }] }),
  component: PrizesPage,
});

type Customer = { id: string; email: string; name: string | null; phone: string | null };

type FilterStatus = "all" | "unclaimed" | "claimed";

function PrizesPage() {
  const navigate     = useNavigate();
  const fetchProfile = useServerFn(getMyProfileFn);
  const fetchClaims  = useServerFn(getMyPrizeClaimsFn);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [claims,   setClaims]   = useState<PrizeClaim[]>([]);
  const [filter,   setFilter]   = useState<FilterStatus>("all");
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, claimRes] = await Promise.all([
          fetchProfile({ data: {} }),
          fetchClaims({ data: {} }),
        ]);
        setCustomer(profileRes.customer as Customer);
        setClaims(claimRes.claims);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (/forbidden/i.test(msg)) { navigate({ to: "/dashboard" }); return; }
        setError("Could not load your prizes. Please try again.");
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

  const filtered = filter === "all"
    ? claims
    : claims.filter((c) => c.status === filter);

  const unclaimed = claims.filter((c) => c.status === "unclaimed").length;

  return (
    <div className="min-h-screen bg-[#0F1115]">
      <CustomerPortalHeader customer={customer} activeTab="prizes" />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-black">My Prizes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {claims.length} claim{claims.length !== 1 ? "s" : ""}
            {unclaimed > 0 ? ` · ${unclaimed} unclaimed` : ""}
          </p>
        </div>

        {/* Filter tabs */}
        {claims.length > 0 && (
          <div className="flex gap-1.5">
            {(["all", "unclaimed", "claimed"] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                  filter === f
                    ? "gradient-primary text-[#0F1115]"
                    : "bg-white/5 text-muted-foreground hover:bg-white/8"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-destructive text-sm text-center">{error}</p>
        )}

        {!error && claims.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🏆</p>
            <p className="font-bold text-foreground">No prizes yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              When you win a prize and save your claim, it will appear here with a QR code for redemption.
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((claim) => (
              <PrizeClaimCard key={claim.id} claim={claim} />
            ))}
          </div>
        )}

        {claims.length > 0 && filtered.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">
            No {filter} prizes.
          </p>
        )}
      </main>
    </div>
  );
}

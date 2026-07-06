import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfileFn } from "@/lib/customer-auth.functions";
import { getMyPrizeClaimsFn } from "@/lib/prize-claims.functions";
import { CustomerPortalHeader } from "@/components/customer/CustomerPortalHeader";
import { PrizeClaimCard } from "@/components/customer/PrizeClaimCard";
import { PrizeCardSkeleton } from "@/components/customer/PortalSkeleton";
import { EmptyState } from "@/components/customer/EmptyState";
import type { PrizeClaim } from "@/lib/prize-claims.functions";

export const Route = createFileRoute("/_customer/portal/prizes")({
  head: () => ({ meta: [{ title: "My Prizes — Mystery Unlock" }] }),
  component: PrizesPage,
});

type Customer = { id: string; email: string; name: string | null; phone: string | null; created_at: string };
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
      <div className="min-h-screen bg-[#0F1115]">
        <div className="sticky top-0 z-30 bg-[#0F1115]/95 border-b border-white/8 h-[88px]" />
        <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
          <div className="h-7 w-32 bg-white/8 rounded-lg animate-pulse" />
          <PrizeCardSkeleton count={2} />
        </main>
      </div>
    );
  }

  if (!customer) return null;

  const filtered = filter === "all" ? claims : claims.filter((c) => c.status === filter);
  const unclaimed = claims.filter((c) => c.status === "unclaimed").length;

  const expiringSoon = claims.filter((c) => {
    if (c.status !== "unclaimed" || !c.expires_at) return false;
    const days = Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 7;
  });

  return (
    <div className="min-h-screen bg-[#0F1115]">
      <CustomerPortalHeader customer={customer} activeTab="prizes" unclaimedCount={unclaimed} />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-black">My Prizes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {claims.length} claim{claims.length !== 1 ? "s" : ""}
            {unclaimed > 0 ? ` · ${unclaimed} unclaimed` : ""}
          </p>
        </div>

        {/* Expiring soon warning */}
        {expiringSoon.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
            ⚠️{" "}
            {expiringSoon.length === 1
              ? "1 prize is expiring soon — redeem it before it's gone!"
              : `${expiringSoon.length} prizes are expiring soon — redeem them before they're gone!`}
          </div>
        )}

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
                {f === "unclaimed" && unclaimed > 0 && (
                  <span className="ml-1.5 bg-[#FF7A00] text-[#0F1115] font-black text-[10px] px-1 rounded-full">
                    {unclaimed}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-destructive text-sm text-center">{error}</p>
        )}

        {!error && claims.length === 0 && (
          <EmptyState
            icon="🏆"
            heading="No prizes yet"
            body="When you win a prize and save your claim, it will appear here with a QR code for redemption."
          />
        )}

        {filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((claim) => (
              <PrizeClaimCard key={claim.id} claim={claim} />
            ))}
          </div>
        )}

        {claims.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon="🔍"
            heading={`No ${filter} prizes`}
            body="Try a different filter to see your prizes."
            action={{ label: "Show all", onClick: () => setFilter("all") }}
          />
        )}
      </main>
    </div>
  );
}

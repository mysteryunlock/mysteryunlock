import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { History, Trophy, User } from "lucide-react";
import { getMyProfileFn } from "@/lib/customer-auth.functions";
import { getMyFullHistoryFn, getMyPrizeClaimsFn } from "@/lib/prize-claims.functions";
import { CustomerPortalHeader } from "@/components/customer/CustomerPortalHeader";
import { SpinHistoryCard } from "@/components/customer/SpinHistoryCard";
import { PageSkeleton } from "@/components/customer/PortalSkeleton";
import { EmptyState } from "@/components/customer/EmptyState";
import type { SpinWithContext, PrizeClaim } from "@/lib/prize-claims.functions";

export const Route = createFileRoute("/_customer/portal")({
  head: () => ({ meta: [{ title: "My Portal — Mystery Unlock" }] }),
  component: PortalPage,
});

type Customer = { id: string; email: string; name: string | null; phone: string | null; created_at: string };

function PortalPage() {
  const navigate     = useNavigate();
  const fetchProfile = useServerFn(getMyProfileFn);
  const fetchHistory = useServerFn(getMyFullHistoryFn);
  const fetchClaims  = useServerFn(getMyPrizeClaimsFn);

  const [customer,   setCustomer]   = useState<Customer | null>(null);
  const [recent,     setRecent]     = useState<SpinWithContext[]>([]);
  const [totalSpins, setTotalSpins] = useState(0);
  const [totalWins,  setTotalWins]  = useState(0);
  const [claims,     setClaims]     = useState<PrizeClaim[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { customer: c } = await fetchProfile({ data: {} });
        setCustomer(c as Customer);
        const [histRes, claimRes] = await Promise.all([
          fetchHistory({ data: {} }),
          fetchClaims({ data: { status: "unclaimed" } }),
        ]);
        const hist = histRes.history;
        setTotalSpins(hist.length);
        setTotalWins(hist.filter((s) => !!s.prize_won).length);
        setRecent(hist.slice(0, 5));
        setClaims(claimRes.claims);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (/forbidden/i.test(msg)) {
          navigate({ to: "/dashboard" });
          return;
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageSkeleton />;
  if (!customer) return null;

  const unclaimedCount = claims.length;
  const winRate = totalSpins > 0 ? Math.round((totalWins / totalSpins) * 100) : 0;

  const stats = [
    { label: "Spins",    value: totalSpins,     icon: "🎡" },
    { label: "Wins",     value: totalWins,       icon: "🏆" },
    { label: "Unclaimed",value: unclaimedCount,  icon: "🎁" },
    { label: "Win rate", value: `${winRate}%`,   icon: "📊" },
  ];

  const navCards = [
    {
      to: "/portal/history",
      icon: <History className="w-6 h-6" />,
      label: "Spin History",
      desc: totalSpins > 0
        ? `${totalSpins} spin${totalSpins === 1 ? "" : "s"} · ${totalWins} win${totalWins === 1 ? "" : "s"}`
        : "All your spins across shops",
    },
    {
      to: "/portal/prizes",
      icon: <Trophy className="w-6 h-6" />,
      label: "My Prizes",
      desc: unclaimedCount > 0
        ? `${unclaimedCount} unclaimed prize${unclaimedCount === 1 ? "" : "s"}`
        : "View & redeem prizes",
      badge: unclaimedCount > 0 ? unclaimedCount : null,
    },
    {
      to: "/portal/profile",
      icon: <User className="w-6 h-6" />,
      label: "Profile",
      desc: "Edit your name and phone",
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0F1115]">
      <CustomerPortalHeader customer={customer} activeTab="portal" unclaimedCount={unclaimedCount} />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {/* Greeting */}
        <section>
          <h1 className="text-2xl font-black tracking-wide">
            {customer.name ? `Hey, ${customer.name.split(" ")[0]}!` : "Welcome back!"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{customer.email}</p>
        </section>

        {/* Stats grid */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(({ label, value, icon }) => (
            <div key={label} className="rounded-2xl bg-white/3 border border-white/8 px-4 py-4 flex flex-col gap-1.5">
              <span className="text-xl leading-none">{icon}</span>
              <p className="text-xl font-black text-foreground leading-none">{value}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>

        {/* Navigation cards */}
        <section className="space-y-3">
          {navCards.map((card) => (
            <button
              key={card.to}
              onClick={() => navigate({ to: card.to })}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/3 border border-white/8 hover:border-white/20 hover:bg-white/5 transition text-left"
            >
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-[#0F1115] shrink-0">
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground">{card.label}</p>
                <p className="text-xs text-muted-foreground truncate">{card.desc}</p>
              </div>
              {"badge" in card && card.badge ? (
                <span className="shrink-0 bg-[#FF7A00] text-[#0F1115] font-black text-xs w-6 h-6 rounded-full flex items-center justify-center">
                  {card.badge}
                </span>
              ) : (
                <span className="text-muted-foreground text-lg">›</span>
              )}
            </button>
          ))}
        </section>

        {/* Recent activity */}
        {recent.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
                Recent Activity
              </h2>
              <button
                onClick={() => navigate({ to: "/portal/history" })}
                className="text-xs text-[#FF7A00] hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {recent.map((spin) => (
                <SpinHistoryCard key={spin.code} spin={spin} />
              ))}
            </div>
          </section>
        )}

        {recent.length === 0 && (
          <EmptyState
            icon="🎡"
            heading="No spins yet"
            body="Spin a wheel at a participating shop to see your history here."
          />
        )}
      </main>
    </div>
  );
}

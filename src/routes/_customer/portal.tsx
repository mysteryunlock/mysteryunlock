import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Disc3, Gift, History, Percent, QrCode, Store, Trophy, User } from "lucide-react";
import { getMyProfileFn } from "@/lib/customer-auth.functions";
import { getMyFullHistoryFn, getMyPrizeClaimsFn } from "@/lib/prize-claims.functions";
import { connectToShopFn } from "@/lib/shop-connections.functions";
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
  const connectToShop = useServerFn(connectToShopFn);

  const [customer,   setCustomer]   = useState<Customer | null>(null);
  const [recent,     setRecent]     = useState<SpinWithContext[]>([]);
  const [totalSpins, setTotalSpins] = useState(0);
  const [totalWins,  setTotalWins]  = useState(0);
  const [claims,     setClaims]     = useState<PrizeClaim[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { customer: c } = await fetchProfile({ data: {} });
        setCustomer(c as Customer);

        let pendingCode: string | null = null;
        try { pendingCode = sessionStorage.getItem("mu_pending_connect"); } catch {}
        if (pendingCode) {
          try { sessionStorage.removeItem("mu_pending_connect"); } catch {}
          try {
            const res = await connectToShop({ data: { code: pendingCode } });
            setConnectMsg(`You're now connected to ${res.shop.name}!`);
          } catch (err) {
            setConnectMsg(err instanceof Error ? err.message : "Could not connect to that shop.");
          }
        }

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
  const firstName = customer.name ? customer.name.split(" ")[0] : null;

  const stats = [
    { label: "Spins",     value: totalSpins,        icon: Disc3 },
    { label: "Wins",      value: totalWins,         icon: Trophy },
    { label: "Unclaimed", value: unclaimedCount,    icon: Gift },
    { label: "Win rate",  value: `${winRate}%`,     icon: Percent },
  ];

  const navCards = [
    {
      to: "/portal/history",
      icon: History,
      label: "Spin History",
      desc: totalSpins > 0
        ? `${totalSpins} spin${totalSpins === 1 ? "" : "s"} · ${totalWins} win${totalWins === 1 ? "" : "s"}`
        : "All your spins across shops",
      badge: null as number | null,
    },
    {
      to: "/portal/prizes",
      icon: Trophy,
      label: "My Prizes",
      desc: unclaimedCount > 0
        ? `${unclaimedCount} unclaimed prize${unclaimedCount === 1 ? "" : "s"}`
        : "View & redeem prizes",
      badge: unclaimedCount > 0 ? unclaimedCount : null,
    },
    {
      to: "/portal/profile",
      icon: User,
      label: "Profile",
      desc: "Edit your name and phone",
      badge: null as number | null,
    },
    {
      to: "/portal/shops",
      icon: Store,
      label: "My Shops",
      desc: "Shops you're connected to as a member",
      badge: null as number | null,
    },
    {
      to: "/portal/qr",
      icon: QrCode,
      label: "My QR Code",
      desc: "Show this to connect with a shop",
      badge: null as number | null,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <CustomerPortalHeader customer={customer} activeTab="portal" unclaimedCount={unclaimedCount} />

      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {/* Greeting */}
        <section className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {firstName ? `Welcome back, ${firstName}!` : "Welcome back!"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{customer.email}</p>
        </section>

        {connectMsg && (
          <section className="rounded-2xl bg-gold/10 border border-gold/30 px-4 py-3 text-sm font-semibold text-foreground animate-fade-in">
            {connectMsg}
          </section>
        )}

        {/* Stats grid */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
          {stats.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl bg-card border border-border px-4 py-4 flex flex-col gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
                <Icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-2xl font-black text-foreground leading-none tabular-nums">{value}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>

        {/* Navigation cards */}
        <section className="space-y-3">
          {navCards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="group relative z-10 w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md hover:border-gold/30 active:scale-[0.99] transition-all duration-200 text-left cursor-pointer min-h-[72px]"
            >
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-white shrink-0 shadow-sm">
                <card.icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground">{card.label}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{card.desc}</p>
              </div>
              {card.badge ? (
                <span className="shrink-0 bg-gold text-white font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-sm">
                  {card.badge}
                </span>
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 group-hover:text-gold group-hover:translate-x-0.5 transition-all" />
              )}
            </Link>
          ))}
        </section>

        {/* Recent activity */}
        {recent.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-xs uppercase tracking-wide text-muted-foreground">
                Recent Activity
              </h2>
              <Link
                to="/portal/history"
                className="relative z-10 text-xs font-semibold text-gold hover:underline cursor-pointer"
              >
                View all
              </Link>
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

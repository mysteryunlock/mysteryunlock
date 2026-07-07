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
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [connectIsError, setConnectIsError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { customer: c } = await fetchProfile({ data: {} });
        setCustomer(c as Customer);

        let pendingCode: string | null = null;
        try { pendingCode = sessionStorage.getItem("mu_pending_connect"); } catch {}
        // DEBUG: log pending connect code
        console.log("[DEBUG portal] mu_pending_connect =", pendingCode);
        console.log("[DEBUG portal] sessionStorage keys =", Object.keys(sessionStorage));
        if (pendingCode) {
          try { sessionStorage.removeItem("mu_pending_connect"); } catch {}
          // DEBUG: confirm connectToShopFn is being called
          console.log("[DEBUG portal] → calling connectToShopFn with code:", pendingCode);
          try {
            const res = await connectToShop({ data: { code: pendingCode } });
            // DEBUG: log full response
            console.log("[DEBUG portal] connectToShopFn response:", JSON.stringify(res, null, 2));
            setConnectIsError(false);
            setConnectMsg(`🎉 You're now connected to ${res.shop.name}!`);
          } catch (err: unknown) {
            // DEBUG: log full error object
            console.error("[DEBUG portal] connectToShopFn THREW:", err);
            console.error("[DEBUG portal] error message:", err instanceof Error ? err.message : String(err));
            console.error("[DEBUG portal] error stack:", err instanceof Error ? err.stack : "no stack");
            const asAny = err as Record<string, unknown>;
            if (asAny?.response) console.error("[DEBUG portal] error.response:", asAny.response);
            if (asAny?.data) console.error("[DEBUG portal] error.data:", asAny.data);
            if (asAny?.statusCode) console.error("[DEBUG portal] error.statusCode:", asAny.statusCode);
            const errMsg = err instanceof Error ? err.message : "Could not connect to that shop.";
            setConnectIsError(true);
            setConnectMsg(errMsg);
          }
        } else {
          // DEBUG: no pending code — confirm why
          console.log("[DEBUG portal] no pending code — skipping connectToShopFn");
        }

        const [histRes, claimRes] = await Promise.allSettled([
          fetchHistory({ data: {} }),
          fetchClaims({ data: { status: "unclaimed" } }),
        ]);
        if (histRes.status === "fulfilled") {
          const hist = histRes.value.history;
          setTotalSpins(hist.length);
          setTotalWins(hist.filter((s) => !!s.prize_won).length);
          setRecent(hist.slice(0, 5));
        }
        if (claimRes.status === "fulfilled") {
          setClaims(claimRes.value.claims);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        // DEBUG: log full outer error
        console.error("[DEBUG portal] outer catch THREW:", err);
        console.error("[DEBUG portal] outer catch message:", msg);
        console.error("[DEBUG portal] outer catch stack:", err instanceof Error ? err.stack : "no stack");
        const asAny = err as Record<string, unknown>;
        if (asAny?.data) console.error("[DEBUG portal] outer catch error.data:", asAny.data);
        if (asAny?.statusCode) console.error("[DEBUG portal] outer catch error.statusCode:", asAny.statusCode);
        if (/forbidden/i.test(msg)) {
          navigate({ to: "/dashboard" });
          return;
        }
        setLoadError(msg || "Failed to load your portal. Please refresh.");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageSkeleton />;
  if (loadError || !customer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-8 text-center space-y-4">
          <p className="text-3xl">⚠️</p>
          <p className="font-bold text-foreground">Could not load your portal</p>
          <p className="text-sm text-muted-foreground">{loadError || "Session expired or profile not found."}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-5 py-3 rounded-xl gradient-primary text-white text-sm font-bold shadow-sm hover:opacity-90 transition"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

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
          <section className={`rounded-2xl px-4 py-3 text-sm font-semibold animate-fade-in ${
            connectIsError
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-gold/10 border border-gold/30 text-foreground"
          }`}>
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

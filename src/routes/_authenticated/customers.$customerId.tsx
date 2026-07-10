import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Hash,
  Calendar,
  Clock,
  BadgeCheck,
  ShoppingBag,
  Zap,
  Trophy,
  TrendingUp,
  Target,
  Award,
  Megaphone,
  AlertCircle,
  XCircle,
} from "lucide-react";
import {
  getCustomerDetailFn,
  getCustomerSpinsByIdFn,
} from "@/lib/customer-profile.functions";
import { getCustomerPurchasesFn } from "@/lib/purchases.functions";
import { getShopClaimsFn } from "@/lib/prize-claims.functions";
import type { Purchase, CustomerPurchaseStats } from "@/lib/purchases.functions";
import type { PrizeClaim } from "@/lib/prize-claims.functions";
import type { CustomerDetail, SpinRecord } from "@/lib/customer-profile.functions";

// ── Route ─────────────────────────────────────────────────────────────────────

const searchSchema = z.object({ shopId: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  validateSearch: searchSchema,
  component: CustomerProfilePage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function isWin(prize_won: string | null): boolean {
  const p = (prize_won ?? "").trim().toLowerCase();
  return !!p && p !== "try again" && p !== "tryagain" && p !== "no win";
}

function initials(name: string | null, email: string): string {
  const s = (name ?? "").trim();
  if (!s) return (email[0] ?? "?").toUpperCase();
  const parts = s.split(/\s+/);
  return (
    ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() ||
    s[0].toUpperCase()
  );
}

function computeSegments(
  totalSpins: number,
  totalWins: number,
  lastSeen: string | null,
  firstSeen: string | null,
): string[] {
  const segs: string[] = [];
  const now = Date.now();
  if (totalWins > 0) segs.push("Winner");
  if (totalSpins >= 5) segs.push("VIP");
  else if (totalSpins >= 2) segs.push("Multi-Spin");
  if (firstSeen && now - new Date(firstSeen).getTime() <= 7 * 24 * 60 * 60 * 1000)
    segs.push("New");
  else if (lastSeen && now - new Date(lastSeen).getTime() > 30 * 24 * 60 * 60 * 1000)
    segs.push("Lapsed");
  return segs;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const SEGMENT_META: Record<string, { bg: string; text: string; border: string }> = {
  Winner: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  VIP: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Multi-Spin": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  New: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  Lapsed: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SkeletonPulse({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/20 ${className}`} />;
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white border border-[#0c2340]/8 rounded-[20px] shadow-sm overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#0c2340]/6">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50">
        {title}
      </h3>
      {right}
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white border border-[#0c2340]/8 rounded-[16px] p-4 shadow-sm">
      <div
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${accent} mb-2`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-[11px] font-semibold text-[#4a5b78] uppercase tracking-wide leading-tight">
        {label}
      </p>
      <p className="text-xl font-black text-[#0c2340] mt-0.5 leading-none">{value}</p>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="bg-white border border-[#0c2340]/8 rounded-[16px] p-4 shadow-sm animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-slate-100 mb-2" />
      <div className="h-3 bg-slate-100 rounded w-20 mb-2" />
      <div className="h-6 bg-slate-100 rounded w-14" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="px-5 py-4 border-b border-[#0c2340]/6 animate-pulse last:border-b-0">
      <div className="flex gap-3 items-start">
        <div className="w-9 h-9 rounded-full bg-slate-100 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 bg-slate-100 rounded w-2/3" />
          <div className="h-3 bg-slate-100 rounded w-1/3" />
        </div>
      </div>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm text-[#4a5b78]">{message}</p>
    </div>
  );
}

function ClaimStatusBadge({ status }: { status: string }) {
  const meta =
    {
      unclaimed: {
        cls: "bg-amber-50 text-amber-700 border border-amber-200",
        label: "Unclaimed",
      },
      claimed: {
        cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        label: "Claimed",
      },
      expired: {
        cls: "bg-slate-100 text-slate-500 border border-slate-200",
        label: "Expired",
      },
    }[status] ?? { cls: "bg-slate-100 text-slate-500 border border-slate-200", label: status };
  return (
    <span
      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function CustomerProfilePage() {
  const { shopId } = Route.useSearch();
  const { customerId } = Route.useParams();
  const navigate = useNavigate();

  const fetchDetail    = useServerFn(getCustomerDetailFn);
  const fetchPurchases = useServerFn(getCustomerPurchasesFn);
  const fetchClaims    = useServerFn(getShopClaimsFn);
  const fetchSpins     = useServerFn(getCustomerSpinsByIdFn);

  const fetchDetailRef    = useRef(fetchDetail);
  const fetchPurchasesRef = useRef(fetchPurchases);
  const fetchClaimsRef    = useRef(fetchClaims);
  const fetchSpinsRef     = useRef(fetchSpins);
  fetchDetailRef.current    = fetchDetail;
  fetchPurchasesRef.current = fetchPurchases;
  fetchClaimsRef.current    = fetchClaims;
  fetchSpinsRef.current     = fetchSpins;

  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [profile,   setProfile]   = useState<CustomerDetail | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stats,     setStats]     = useState<CustomerPurchaseStats | null>(null);
  const [spins,     setSpins]     = useState<SpinRecord[]>([]);
  const [claims,    setClaims]    = useState<Array<PrizeClaim & { customer_id: string }>>([]);

  useEffect(() => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [profileRes, purchasesRes, claimsRes, spinsRes] = await Promise.all([
          fetchDetailRef.current({ data: { shopId, customerId } }),
          fetchPurchasesRef.current({ data: { shopId, customerId } }),
          fetchClaimsRef.current({ data: { shopId } }),
          fetchSpinsRef.current({ data: { shopId, customerId } }),
        ]);
        if (cancelled) return;

        setProfile(profileRes as CustomerDetail);
        setPurchases(((purchasesRes as any).purchases ?? []) as Purchase[]);
        setStats((purchasesRes as any).stats as CustomerPurchaseStats);

        const allClaims = ((claimsRes as any).claims ?? []) as Array<
          PrizeClaim & { customer_id: string }
        >;
        setClaims(allClaims.filter((c) => c.customer_id === customerId));
        setSpins(((spinsRes as any).spins ?? []) as SpinRecord[]);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load customer profile.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shopId, customerId]);

  const totalSpins    = spins.length;
  const totalWins     = spins.filter((s) => isWin(s.prize_won)).length;
  const winRatePct    = totalSpins > 0 ? Math.round((totalWins / totalSpins) * 100) : 0;
  const spinFirstSeen = spins.length > 0 ? spins[spins.length - 1].spun_at : null;
  const spinLastSeen  = spins.length > 0 ? spins[0].spun_at : null;
  const segments      = computeSegments(totalSpins, totalWins, spinLastSeen, spinFirstSeen);
  const init          = profile ? initials(profile.name, profile.email) : "?";
  const isWinner      = totalWins > 0;

  // ── No shopId guard ───────────────────────────────────────────────────────
  if (!shopId) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-[#FF6B00] mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#0c2340]">Shop not specified</h2>
          <p className="text-sm text-[#4a5b78] mt-2 mb-6">
            Open this profile from the Members tab in your dashboard.
          </p>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="px-5 py-2.5 rounded-xl bg-[#0c2340] text-white text-sm font-bold hover:bg-[#1a3a5f] transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (!loading && error) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#0c2340]">Failed to load profile</h2>
          <p className="text-sm text-[#4a5b78] mt-2 mb-6">{error}</p>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="px-5 py-2.5 rounded-xl bg-[#0c2340] text-white text-sm font-bold hover:bg-[#1a3a5f] transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">

      {/* ── Gradient header ───────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#0c2340] to-[#1a3a5f] text-white">
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-6">
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="flex items-center gap-1.5 text-white/70 hover:text-white transition text-sm font-semibold mb-5"
          >
            <ArrowLeft className="w-4 h-4" />
            Customer CRM
          </button>

          {loading ? (
            <div className="flex items-center gap-4">
              <SkeletonPulse className="w-16 h-16 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonPulse className="h-5 w-44" />
                <SkeletonPulse className="h-3 w-28" />
                <SkeletonPulse className="h-5 w-20 rounded-full" />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div
                className={`w-16 h-16 rounded-full grid place-items-center text-xl font-bold shrink-0 ${
                  isWinner ? "bg-[#FF6B00]" : "bg-white/20"
                }`}
              >
                {init}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h1 className="text-xl font-bold truncate">
                  {profile?.name || "Anonymous"}
                </h1>
                <p className="text-sm text-white/60 mt-0.5 truncate">{profile?.email}</p>
                {segments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {segments.map((seg) => (
                      <span
                        key={seg}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/20"
                      >
                        {seg}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Page body ─────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5 pb-16">

        {/* ── Customer Overview ──────────────────────────────────────────── */}
        <Card>
          <CardHeader title="Customer Overview" />
          {loading ? (
            <div>
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-5 py-3 border-b border-[#0c2340]/6 last:border-b-0 animate-pulse"
                >
                  <div className="w-4 h-4 rounded bg-slate-100 shrink-0" />
                  <div className="w-28 h-3 bg-slate-100 rounded shrink-0" />
                  <div className="flex-1 h-4 bg-slate-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : profile ? (
            <div className="divide-y divide-[#0c2340]/6">
              {(
                [
                  { icon: User,       label: "Name",         value: profile.name ?? "—" },
                  { icon: Mail,       label: "Email",        value: profile.email || "—" },
                  { icon: Phone,      label: "Phone",        value: profile.phone ?? "—" },
                  { icon: Hash,       label: "Customer ID",  value: `${profile.customerId.slice(0, 8)}…` },
                  { icon: Calendar,   label: "Member Since", value: fmtDate(profile.memberSince) },
                  { icon: Clock,      label: "Last Visit",   value: fmtRelative(profile.lastVisit) },
                  {
                    icon: BadgeCheck,
                    label: "Status",
                    value: (
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          profile.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        {profile.status}
                      </span>
                    ),
                  },
                ] as Array<{ icon: React.ElementType; label: string; value: React.ReactNode }>
              ).map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 px-5 py-3">
                  <Icon className="w-4 h-4 text-[#FF6B00] shrink-0" />
                  <span className="text-sm text-[#4a5b78] w-28 shrink-0">{label}</span>
                  <span className="text-sm font-semibold text-[#0c2340] truncate flex-1">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        {/* ── Business KPIs ──────────────────────────────────────────────── */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50 mb-3 px-1">
            Business KPIs
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)
            ) : (
              <>
                <KpiTile
                  label="Lifetime Spend"
                  value={`₹${fmtCurrency(stats?.lifetimeSpend ?? 0)}`}
                  icon={ShoppingBag}
                  accent="bg-[#FF6B00]/12 text-[#FF6B00]"
                />
                <KpiTile
                  label="Total Purchases"
                  value={stats?.totalPurchases ?? 0}
                  icon={TrendingUp}
                  accent="bg-[#0c2340]/8 text-[#0c2340]"
                />
                <KpiTile
                  label="Avg Order Value"
                  value={`₹${fmtCurrency(stats?.avgOrderValue ?? 0)}`}
                  icon={Target}
                  accent="bg-blue-50 text-blue-600"
                />
                <KpiTile
                  label="Monthly Spend"
                  value={`₹${fmtCurrency(stats?.monthlySpend ?? 0)}`}
                  icon={Calendar}
                  accent="bg-violet-50 text-violet-600"
                />
                <KpiTile
                  label="Total Spins"
                  value={totalSpins}
                  icon={Zap}
                  accent="bg-[#0c2340]/8 text-[#0c2340]"
                />
                <KpiTile
                  label="Total Wins"
                  value={totalWins}
                  icon={Trophy}
                  accent="bg-[#FF6B00]/12 text-[#FF6B00]"
                />
                <KpiTile
                  label="Win Rate"
                  value={totalSpins > 0 ? `${winRatePct}%` : "—"}
                  icon={TrendingUp}
                  accent="bg-emerald-50 text-emerald-600"
                />
                <KpiTile
                  label="Prize Claims"
                  value={claims.length}
                  icon={Award}
                  accent="bg-amber-50 text-amber-600"
                />
              </>
            )}
          </div>
        </div>

        {/* ── Purchase History ───────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Purchase History"
            right={
              <span className="text-xs font-semibold text-[#4a5b78]">
                {loading ? "…" : purchases.length}
              </span>
            }
          />
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : purchases.length === 0 ? (
            <EmptyRow message="No purchases recorded yet." />
          ) : (
            <div className="divide-y divide-[#0c2340]/6">
              {purchases.map((p) => (
                <div key={p.id} className="flex items-start gap-3 px-5 py-4">
                  <div className="h-9 w-9 rounded-full bg-[#FF6B00]/10 grid place-items-center shrink-0">
                    <ShoppingBag className="h-4 w-4 text-[#FF6B00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-[#0c2340]">
                        ₹{fmtCurrency(p.amount)}
                      </p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#4a5b78] border border-[#0c2340]/8 shrink-0 whitespace-nowrap">
                        {p.category}
                      </span>
                    </div>
                    {p.notes && (
                      <p className="text-xs text-[#4a5b78] mt-0.5 line-clamp-2">{p.notes}</p>
                    )}
                    <p className="text-[11px] text-[#0c2340]/40 mt-0.5">{fmtDate(p.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Spin History ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Spin History"
            right={
              <span className="text-xs font-semibold text-[#4a5b78]">
                {loading ? "…" : totalSpins}
              </span>
            }
          />
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : spins.length === 0 ? (
            <EmptyRow message="No spin history found for this customer." />
          ) : (
            <div className="divide-y divide-[#0c2340]/6">
              {spins.map((s) => {
                const won = isWin(s.prize_won);
                return (
                  <div key={s.code} className="flex items-start gap-3 px-5 py-4">
                    <div
                      className={`h-9 w-9 rounded-full grid place-items-center shrink-0 ${
                        won
                          ? "bg-[#FF6B00]/15 text-[#FF6B00]"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <Award className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-[#0c2340] truncate">
                          {s.prize_won || "Try Again"}
                        </p>
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            won
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {won ? "Win" : "Loss"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        {s.spun_at && (
                          <span className="text-[11px] text-[#0c2340]/50">
                            {fmtDateTime(s.spun_at)}
                          </span>
                        )}
                        {s.campaign_name && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#4a5b78]">
                            <Megaphone className="h-3 w-3 shrink-0" />
                            {s.campaign_name}
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-[#0c2340]/30">
                          {s.code}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Prize Claims ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Prize Claims"
            right={
              <span className="text-xs font-semibold text-[#4a5b78]">
                {loading ? "…" : claims.length}
              </span>
            }
          />
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : claims.length === 0 ? (
            <EmptyRow message="No prize claims for this customer." />
          ) : (
            <div className="divide-y divide-[#0c2340]/6">
              {claims.map((c) => (
                <div key={c.id} className="flex items-start gap-3 px-5 py-4">
                  <div className="h-9 w-9 rounded-full bg-amber-50 grid place-items-center shrink-0">
                    <Trophy className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-[#0c2340] truncate">
                        {c.prize_name}
                      </p>
                      <ClaimStatusBadge status={c.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="text-[11px] text-[#0c2340]/50">
                        Saved {fmtDate(c.created_at)}
                      </span>
                      {c.claimed_at && (
                        <span className="text-[11px] text-emerald-600">
                          Redeemed {fmtDate(c.claimed_at)}
                        </span>
                      )}
                      {c.expires_at && c.status !== "claimed" && (
                        <span className="text-[11px] text-amber-600">
                          Expires {fmtDate(c.expires_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity, TrendingUp, Trophy, Sparkles, Pencil, Gift,
  QrCode, Users, MessageSquare, Hash, BarChart3, Zap, Megaphone, ChevronRight,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";
import { listSpinRecords, listAccessCodes } from "@/lib/access-codes.functions";
import {
  KpiCard, EmptyState, SkeletonKpi, SkeletonBlock, SkeletonRow,
} from "@/components/ds";
import { DashCard, SectionHead } from "./ui";
import type { Shop, TabKey, RecordRow, CodeRow } from "./types";
import { initials } from "@/lib/utils";

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function OverviewTab({ shop, onNavigate }: { shop: Shop; onNavigate: (t: TabKey) => void }) {
  const fetchRecords = useServerFn(listSpinRecords);
  const fetchCodes   = useServerFn(listAccessCodes);

  const [rows,    setRows]    = useState<RecordRow[]>([]);
  const [codes,   setCodes]   = useState<CodeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let rowsDone = false, codesDone = false;
    const checkDone = () => { if (rowsDone && codesDone && !cancelled) setLoading(false); };

    fetchRecords({ data: { shopId: shop.id } })
      .then((r) => { if (!cancelled) setRows((r.rows as RecordRow[]) ?? []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { rowsDone = true; checkDone(); });

    fetchCodes({ data: { shopId: shop.id } })
      .then((r) => { if (!cancelled) setCodes((r.rows as CodeRow[]) ?? []); })
      .catch(() => { if (!cancelled) setCodes([]); })
      .finally(() => { codesDone = true; checkDone(); });

    return () => { cancelled = true; };
  }, [fetchRecords, fetchCodes, shop.id]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart     = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekStart      = new Date(now); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0);
    const prevWeekStart  = new Date(weekStart); prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const today = rows.filter((r) => r.spun_at && new Date(r.spun_at) >= todayStart).length;
    const yesterday = rows.filter((r) => {
      if (!r.spun_at) return false;
      const d = new Date(r.spun_at);
      return d >= yesterdayStart && d < todayStart;
    }).length;
    const todayDelta = yesterday === 0 ? (today > 0 ? 100 : 0) : Math.round(((today - yesterday) / yesterday) * 100);

    const thisWeek = rows.filter((r) => r.spun_at && new Date(r.spun_at) >= weekStart).length;
    const prevWeek = rows.filter((r) => {
      if (!r.spun_at) return false;
      const d = new Date(r.spun_at);
      return d >= prevWeekStart && d < weekStart;
    }).length;
    const weekDelta = prevWeek === 0 ? (thisWeek > 0 ? 100 : 0) : Math.round(((thisWeek - prevWeek) / prevWeek) * 100);

    const winners   = rows.filter((r) => r.prize_won && !/try\s*again/i.test(r.prize_won)).length;
    const winRate   = rows.length > 0 ? Math.round((winners / rows.length) * 100) : 0;
    const totalCodes = codes.length;
    const conversion = totalCodes > 0 ? Math.round((rows.length / totalCodes) * 100) : 0;

    const dist: Record<string, number> = {};
    for (const r of rows) {
      const k = r.prize_won || "Unknown";
      if (/try\s*again/i.test(k)) continue;
      dist[k] = (dist[k] || 0) + 1;
    }
    const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0] ?? null;

    const days: { day: string; spins: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const count = rows.filter((r) => {
        if (!r.spun_at) return false;
        const t = new Date(r.spun_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).length;
      days.push({ day: d.toLocaleDateString(undefined, { weekday: "short" }), spins: count });
    }

    return { today, todayDelta, total: rows.length, thisWeek, weekDelta, winners, winRate, conversion, top, days };
  }, [rows, codes]);

  const recent = useMemo(
    () => [...rows].sort((a, b) => (b.spun_at || "").localeCompare(a.spun_at || "")).slice(0, 8),
    [rows],
  );

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in" aria-busy="true" aria-label="Loading dashboard">
        {/* KPI grid */}
        <section className="grid grid-cols-2 gap-3">
          <SkeletonKpi />
          <SkeletonKpi />
          <SkeletonKpi />
          <SkeletonKpi />
        </section>

        {/* Quick actions */}
        <div>
          <SkeletonBlock className="h-3 w-24 mb-3" />
          <div className="grid grid-cols-3 gap-2.5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonBlock key={i} className="h-[76px] rounded-2xl" />
            ))}
          </div>
        </div>

        {/* Chart */}
        <SkeletonBlock className="h-52" />

        {/* Top prize */}
        <SkeletonBlock className="h-32" />

        {/* Recent activity */}
        <div className="rounded-[20px] bg-white border border-[#0C2340]/8 p-4 space-y-0.5">
          <div className="flex items-center justify-between mb-3">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-3 w-12" />
          </div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  // ── KPI definitions ──────────────────────────────────────────────────────────
  const kpis = [
    { label: "Today's Spins", value: stats.today,          icon: Activity,  accentClass: "bg-[#FF6B1A]/10 text-[#FF6B1A]",   delta: stats.todayDelta },
    { label: "This Week",     value: stats.thisWeek,       icon: TrendingUp, accentClass: "bg-blue-50 text-blue-600",          delta: stats.weekDelta  },
    { label: "Winners",       value: stats.winners,        icon: Trophy,     accentClass: "bg-emerald-50 text-emerald-600"                              },
    { label: "Conversion",    value: `${stats.conversion}%`, icon: Sparkles, accentClass: "bg-violet-50 text-violet-600"                              },
  ];

  // ── Quick actions ────────────────────────────────────────────────────────────
  const quickActions: { label: string; icon: typeof Activity; tab: TabKey }[] = [
    { label: "Campaign",    icon: Pencil,       tab: "campaign"  },
    { label: "Prizes",      icon: Gift,         tab: "campaign"  },
    { label: "Customer Hub",icon: QrCode,       tab: "qr"        },
    { label: "Customers",   icon: Users,        tab: "customers" },
    { label: "Prize Claims",icon: Trophy,       tab: "claims"    },
    { label: "Analytics",   icon: BarChart3,    tab: "analytics" },
    { label: "Marketing",   icon: Megaphone,    tab: "messages"  },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── KPI cards 2×2 ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3" aria-label="Key metrics">
        {kpis.map(({ label, value, icon, accentClass, delta }) => (
          <KpiCard key={label} label={label} value={value} icon={icon} accentClass={accentClass} delta={delta} />
        ))}
      </section>

      {/* ── Quick Actions ──────────────────────────────────────────────── */}
      <section aria-label="Quick actions">
        <SectionHead title="Quick Actions" className="mb-2.5 px-0.5" />
        <div className="grid grid-cols-3 gap-2.5">
          {quickActions.map(({ label, icon: Icon, tab }) => (
            <button
              key={label}
              onClick={() => onNavigate(tab)}
              className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-white border border-[#0C2340]/8 shadow-[0_1px_4px_-1px_rgba(12,35,64,0.06)] hover:border-[#FF6B1A]/35 hover:shadow-[0_4px_16px_-6px_rgba(255,107,26,0.15)] transition-all duration-200 min-h-[44px]"
              aria-label={label}
            >
              <div className="w-9 h-9 rounded-xl grid place-items-center bg-[#F7F8FA] text-[#4a5b78] group-hover:bg-[#FF6B1A]/10 group-hover:text-[#FF6B1A] transition-colors duration-200">
                <Icon className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <span className="text-[10px] font-semibold text-[#0C2340] text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Weekly chart ───────────────────────────────────────────────── */}
      <DashCard className="p-4">
        <SectionHead
          title="Weekly Spins"
          right={<span className="text-[11px] text-[#4a5b78]">Last 7 days</span>}
          className="mb-3"
        />
        {stats.total === 0 ? (
          <div className="h-36 grid place-items-center">
            <div className="text-center">
              <p className="text-sm text-[#4a5b78]">No spin data yet</p>
              <button
                onClick={() => onNavigate("qr")}
                className="mt-2 text-xs font-semibold text-[#FF6B1A] hover:opacity-75 transition-opacity inline-flex items-center gap-1"
              >
                Open Customer Hub
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.days} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(12,35,64,0.07)" vertical={false} />
                <XAxis dataKey="day" stroke="#4a5b78" fontSize={11} tickLine={false} axisLine={false} />
                <RTooltip
                  cursor={{ fill: "rgba(255,107,26,0.06)" }}
                  contentStyle={{ borderRadius: 12, border: "1px solid rgba(12,35,64,0.12)", fontSize: 12, boxShadow: "0 4px 12px -4px rgba(12,35,64,0.12)" }}
                />
                <Bar dataKey="spins" fill="#FF6B1A" radius={[8, 8, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </DashCard>

      {/* ── Top prize hero / empty state ───────────────────────────────── */}
      {stats.top ? (
        <section className="rounded-[20px] p-5 bg-gradient-to-br from-[#FF6B1A] to-[#ff8a3d] text-white shadow-[0_10px_30px_-12px_rgba(255,107,26,0.50)]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 grid place-items-center shrink-0">
              <Trophy className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider font-bold opacity-80">Most Claimed Prize</p>
              <p className="text-lg font-display font-black truncate mt-0.5">{stats.top[0]}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-display font-black leading-none">{stats.top[1]}</p>
              <p className="text-[10px] uppercase tracking-wide opacity-80 mt-0.5">times</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="opacity-70">Win rate</p>
              <p className="font-display font-black text-lg leading-tight">{stats.winRate}%</p>
            </div>
            <div>
              <p className="opacity-70">Total winners</p>
              <p className="font-display font-black text-lg leading-tight">{stats.winners}</p>
            </div>
          </div>
        </section>
      ) : stats.total === 0 ? (
        <DashCard>
          <EmptyState
            icon={Zap}
            title="No spins yet"
            description="Share your QR code or generate access codes so customers can spin your wheel."
            action={{ label: "Open Customer Hub", onClick: () => onNavigate("qr") }}
          />
        </DashCard>
      ) : null}

      {/* ── Recent activity ────────────────────────────────────────────── */}
      <DashCard className="p-4">
        <SectionHead
          title="Recent Activity"
          right={
            <button
              onClick={() => onNavigate("customers")}
              className="text-xs font-semibold text-[#FF6B1A] hover:opacity-75 transition-opacity inline-flex items-center gap-0.5"
            >
              View all
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          }
          className="mb-3"
        />
        {recent.length === 0 ? (
          <p className="text-sm text-[#4a5b78] py-8 text-center">
            Customers who spin will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-[#0C2340]/6">
            {recent.map((r) => {
              const isWin = !!(r.prize_won && !/try\s*again/i.test(r.prize_won));
              const when  = r.spun_at ? new Date(r.spun_at) : null;
              return (
                <li key={r.code} className="py-2.5 flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className={`w-9 h-9 rounded-full grid place-items-center text-xs font-display font-black shrink-0 ${
                      isWin ? "bg-[#FF6B1A]/10 text-[#FF6B1A]" : "bg-[#0C2340]/6 text-[#4a5b78]"
                    }`}
                    aria-hidden="true"
                  >
                    {initials(r.customer_name, r.code)}
                  </div>

                  {/* Name + prize */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0C2340] truncate">
                      {r.customer_name || "Anonymous"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Hash className="w-3 h-3 text-[#4a5b78] shrink-0" strokeWidth={2} />
                      <p className={`text-xs truncate font-mono ${isWin ? "text-[#FF6B1A]" : "text-[#4a5b78]"}`}>
                        {r.prize_won || "Try Again"}
                      </p>
                    </div>
                  </div>

                  {/* Status + time */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none ${
                        isWin
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : "bg-slate-100 text-slate-500 border border-slate-200/60"
                      }`}
                    >
                      {isWin ? "Win" : "Loss"}
                    </span>
                    {when && (
                      <span className="text-[10px] text-[#4a5b78]">{timeAgo(when)}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DashCard>

      {/* ── Access Codes shortcut ──────────────────────────────────────── */}
      <DashCard
        className="p-4 flex items-center gap-3"
        onClick={() => onNavigate("codes")}
      >
        <div className="w-10 h-10 rounded-xl bg-[#0C2340]/6 text-[#0C2340] grid place-items-center shrink-0">
          <Hash className="w-5 h-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-display font-bold text-[#0C2340]">Access Codes</p>
          <p className="text-xs text-[#4a5b78]">Generate and manage spin codes</p>
        </div>
        <ChevronRight className="w-4 h-4 text-[#FF6B1A] shrink-0" strokeWidth={2.5} />
      </DashCard>
    </div>
  );
}

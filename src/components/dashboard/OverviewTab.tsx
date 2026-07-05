import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, TrendingUp, Trophy, Sparkles, Pencil, Gift, QrCode, UserSquare2, MessageSquare } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";
import { listSpinRecords, listAccessCodes } from "@/lib/access-codes.functions";
import type { Shop, TabKey, RecordRow, CodeRow } from "./types";

export function OverviewTab({ shop, onNavigate }: { shop: Shop; onNavigate: (t: TabKey) => void }) {
  const fetchRecords = useServerFn(listSpinRecords);
  const fetchCodes = useServerFn(listAccessCodes);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [codes, setCodes] = useState<CodeRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchRecords({ data: { shopId: shop.id } })
      .then((r) => { if (!cancelled) setRows((r.rows as RecordRow[]) ?? []); })
      .catch(() => { if (!cancelled) setRows([]); });
    fetchCodes({ data: { shopId: shop.id } })
      .then((r) => { if (!cancelled) setCodes((r.rows as CodeRow[]) ?? []); })
      .catch(() => { if (!cancelled) setCodes([]); });
    return () => { cancelled = true; };
  }, [fetchRecords, fetchCodes, shop.id]);

  const stats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const today = rows.filter((r) => r.spun_at && new Date(r.spun_at).getTime() >= todayStart.getTime()).length;
    const winners = rows.filter((r) => r.prize_won && !/try\s*again/i.test(r.prize_won)).length;
    const totalCodes = codes.length;
    const conversion = totalCodes > 0 ? Math.round((rows.length / totalCodes) * 100) : 0;
    const dist: Record<string, number> = {};
    for (const r of rows) {
      const k = r.prize_won || "Unknown";
      if (/try\s*again/i.test(k)) continue;
      dist[k] = (dist[k] || 0) + 1;
    }
    const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
    // weekly buckets
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
    return { today, total: rows.length, winners, conversion, top, days };
  }, [rows, codes]);

  const recent = rows.slice(0, 6);

  const statCards = [
    { label: "Today's Spins", value: stats.today, icon: Activity, accent: "bg-orange-50 text-[#FF6B00]" },
    { label: "Total Spins", value: stats.total, icon: TrendingUp, accent: "bg-blue-50 text-blue-600" },
    { label: "Winners", value: stats.winners, icon: Trophy, accent: "bg-emerald-50 text-emerald-600" },
    { label: "Conversion", value: `${stats.conversion}%`, icon: Sparkles, accent: "bg-violet-50 text-violet-600" },
  ];

  const actions = [
    { label: "Edit Campaign", icon: Pencil, onClick: () => onNavigate("campaign") },
    { label: "Manage Prizes", icon: Gift, onClick: () => onNavigate("campaign") },
    { label: "Generate QR", icon: QrCode, onClick: () => onNavigate("qr") },
    { label: "View Customers", icon: UserSquare2, onClick: () => onNavigate("customers") },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Stats 2x2 */}
      <section className="grid grid-cols-2 gap-3">
        {statCards.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
            <div className={`w-9 h-9 rounded-xl grid place-items-center ${accent}`}>
              <Icon className="w-4.5 h-4.5" strokeWidth={2.2} />
            </div>
            <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] mt-3 font-semibold">{label}</p>
            <p className="text-2xl font-black text-[#0c2340] mt-0.5">{value}</p>
          </div>
        ))}
      </section>

      {/* Quick Actions */}
      <section>
        <h3 className="text-sm font-bold text-[#0c2340] mb-2.5 px-1">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          {actions.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="group rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 text-left hover:border-[#FF6B00]/40 hover:shadow-[0_8px_24px_-8px_rgba(255,107,0,0.25)] transition-all"
            >
              <div className="w-10 h-10 rounded-xl grid place-items-center bg-orange-50 text-[#FF6B00] group-hover:bg-[#FF6B00] group-hover:text-white transition-colors">
                <Icon className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <p className="text-sm font-bold text-[#0c2340] mt-3">{label}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Weekly chart */}
      <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#0c2340]">Weekly Spins</h3>
          <span className="text-[11px] text-[#4a5b78]">Last 7 days</span>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.days} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0c234012" vertical={false} />
              <XAxis dataKey="day" stroke="#4a5b78" fontSize={11} tickLine={false} axisLine={false} />
              <RTooltip
                cursor={{ fill: "#FF6B0010" }}
                contentStyle={{ borderRadius: 12, border: "1px solid #0c234020", fontSize: 12 }}
              />
              <Bar dataKey="spins" fill="#FF6B00" radius={[8, 8, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Top prize */}
      <section className="rounded-[20px] p-5 bg-gradient-to-br from-[#FF6B00] to-[#ff8a3d] text-white shadow-[0_10px_30px_-12px_rgba(255,107,0,0.55)]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 grid place-items-center">
            <Trophy className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide font-bold opacity-80">Top Prize</p>
            <p className="text-lg font-black truncate">{stats.top ? stats.top[0] : "No wins yet"}</p>
          </div>
          {stats.top && (
            <div className="text-right">
              <p className="text-2xl font-black leading-none">{stats.top[1]}</p>
              <p className="text-[10px] uppercase tracking-wide opacity-80">awarded</p>
            </div>
          )}
        </div>
      </section>

      {/* Recent activity */}
      <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-[#0c2340]">Recent Activity</h3>
          <button onClick={() => onNavigate("customers")} className="text-xs font-semibold text-[#FF6B00] hover:underline">View all</button>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-[#4a5b78] py-6 text-center">No spins yet. Generate QR codes to get started.</p>
        ) : (
          <ul className="divide-y divide-[#0c2340]/8">
            {recent.map((r) => {
              const isWin = r.prize_won && !/try\s*again/i.test(r.prize_won);
              return (
                <li key={r.code} className="py-2.5 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl grid place-items-center text-xs font-black ${isWin ? "bg-emerald-50 text-emerald-700" : "bg-[#F5F7FA] text-[#4a5b78]"}`}>
                    {(r.customer_name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0c2340] truncate">{r.customer_name || "Anonymous"}</p>
                    <p className="text-xs text-[#4a5b78] truncate">{r.prize_won || "—"}</p>
                  </div>
                  <span className="text-[11px] text-[#4a5b78] whitespace-nowrap">
                    {r.spun_at ? new Date(r.spun_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Messages shortcut */}
      <button
        onClick={() => onNavigate("messages")}
        className="w-full rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 flex items-center gap-3 text-left hover:border-[#FF6B00]/40 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF6B00] grid place-items-center">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#0c2340]">Send Messages</p>
          <p className="text-xs text-[#4a5b78]">WhatsApp & email broadcasts to winners</p>
        </div>
        <span className="text-[#FF6B00] text-lg">→</span>
      </button>

      <button
        onClick={() => onNavigate("codes")}
        className="w-full rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 flex items-center gap-3 text-left hover:border-[#FF6B00]/40 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF6B00] grid place-items-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#0c2340]">Access Codes</p>
          <p className="text-xs text-[#4a5b78]">Generate and manage spin codes</p>
        </div>
        <span className="text-[#FF6B00] text-lg">→</span>
      </button>
    </div>
  );
}

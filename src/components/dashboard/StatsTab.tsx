import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, Trophy, Users, Sparkles, Activity, Download, BarChart2 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { listSpinRecords, listAccessCodes } from "@/lib/access-codes.functions";
import { listMyShops } from "@/lib/shops.functions";
import { KpiCard, EmptyState, SkeletonKpiCard, SkeletonBlock, SectionHead } from "./ui";
import type { Shop, RecordRow, CodeRow } from "./types";

type TimeRange = "7d" | "30d" | "all";

const TIME_RANGE_OPTIONS: { key: TimeRange; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

function cutoffForRange(range: TimeRange): Date | null {
  if (range === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - (range === "7d" ? 7 : 30));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function StatsTab({ shop }: { shop: Shop }) {
  const fetchRecords = useServerFn(listSpinRecords);
  const fetchCodes = useServerFn(listAccessCodes);
  const fetchShops = useServerFn(listMyShops);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  useEffect(() => {
    let cancelled = false;
    let rowsDone = false;
    let codesDone = false;
    let shopsDone = false;
    const checkDone = () => {
      if (rowsDone && codesDone && shopsDone && !cancelled) setLoading(false);
    };

    fetchRecords({ data: { shopId: shop.id } })
      .then((r) => { if (!cancelled) setRows((r.rows as RecordRow[]) ?? []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { rowsDone = true; checkDone(); });

    fetchCodes({ data: { shopId: shop.id } })
      .then((r) => { if (!cancelled) setCodes((r.rows as CodeRow[]) ?? []); })
      .catch(() => { if (!cancelled) setCodes([]); })
      .finally(() => { codesDone = true; checkDone(); });

    fetchShops()
      .then((r) => {
        const list = (r.shops ?? []) as Shop[];
        if (!cancelled) setActiveCampaigns(list.filter((s) => s.is_active).length);
      })
      .catch(() => {})
      .finally(() => { shopsDone = true; checkDone(); });

    return () => { cancelled = true; };
  }, [fetchRecords, fetchCodes, fetchShops, shop.id]);

  // Filter rows to the selected time range
  const filteredRows = useMemo(() => {
    const cutoff = cutoffForRange(timeRange);
    if (!cutoff) return rows;
    return rows.filter((r) => r.spun_at && new Date(r.spun_at) >= cutoff);
  }, [rows, timeRange]);

  const data = useMemo(() => {
    const winners = filteredRows.filter((r) => r.prize_won && !/try\s*again/i.test(r.prize_won)).length;
    const customers = new Set(
      filteredRows.map((r) => (r.customer_name || "").trim().toLowerCase()).filter(Boolean),
    ).size || filteredRows.length;
    const totalCodes = codes.length;
    const conversion = totalCodes > 0 ? Math.round((filteredRows.length / totalCodes) * 100) : 0;

    // prize distribution
    const dist: Record<string, number> = {};
    for (const r of filteredRows) {
      const k = r.prize_won || "Unknown";
      if (/try\s*again/i.test(k)) continue;
      dist[k] = (dist[k] || 0) + 1;
    }
    const distArr = Object.entries(dist)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const topPrizes = distArr.slice(0, 5);

    // chart buckets based on time range
    let chartDays: { label: string; spins: number }[] = [];
    if (timeRange === "7d") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
        const next = new Date(d); next.setDate(d.getDate() + 1);
        const count = filteredRows.filter((r) => {
          if (!r.spun_at) return false;
          const t = new Date(r.spun_at).getTime();
          return t >= d.getTime() && t < next.getTime();
        }).length;
        chartDays.push({ label: d.toLocaleDateString(undefined, { weekday: "short" }), spins: count });
      }
    } else if (timeRange === "30d") {
      for (let w = 3; w >= 0; w--) {
        const end = new Date(); end.setHours(23, 59, 59, 999); end.setDate(end.getDate() - w * 7);
        const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
        const count = filteredRows.filter((r) => {
          if (!r.spun_at) return false;
          const t = new Date(r.spun_at).getTime();
          return t >= start.getTime() && t <= end.getTime();
        }).length;
        chartDays.push({
          label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          spins: count,
        });
      }
      chartDays = chartDays.reverse();
    } else {
      const monthly: Record<string, number> = {};
      for (const r of filteredRows) {
        if (!r.spun_at) continue;
        const d = new Date(r.spun_at);
        const key = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
        monthly[key] = (monthly[key] || 0) + 1;
      }
      const sorted = Object.entries(monthly).sort(([a], [b]) => {
        const da = new Date("1 " + a); const db = new Date("1 " + b);
        return da.getTime() - db.getTime();
      });
      chartDays = sorted.slice(-8).map(([label, spins]) => ({ label, spins }));
    }

    // delta vs prior period
    const day = 86400000;
    const periodMs = timeRange === "7d" ? 7 * day : timeRange === "30d" ? 30 * day : null;
    const now = Date.now();
    let delta: number | null = null;
    if (periodMs) {
      const cur = filteredRows.length;
      const prev = rows.filter((r) => {
        if (!r.spun_at) return false;
        const t = now - new Date(r.spun_at).getTime();
        return t > periodMs && t <= periodMs * 2;
      }).length;
      delta = prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);
    }

    // peak hour
    const hourBuckets = new Array(24).fill(0) as number[];
    for (const r of filteredRows) {
      if (!r.spun_at) continue;
      hourBuckets[new Date(r.spun_at).getHours()]++;
    }
    let peakHour = -1; let peakCount = 0;
    hourBuckets.forEach((c, h) => { if (c > peakCount) { peakCount = c; peakHour = h; } });
    const fmtHour = (h: number) => {
      if (h < 0) return "—";
      const am = h < 12; const v = h % 12 || 12;
      return `${v}:00 ${am ? "AM" : "PM"}`;
    };

    return {
      total: filteredRows.length, winners, customers, conversion,
      distArr, topPrizes, chartDays,
      peakHour: fmtHour(peakHour), peakCount,
      delta,
    };
  }, [filteredRows, codes, timeRange, rows]);

  const exportExcel = () => {
    const headers = ["Customer", "Phone", "Code", "Prize", "Spun At"];
    const lines = [headers.join(",")];
    for (const r of filteredRows) {
      const row = [
        r.customer_name || "",
        r.customer_contact || "",
        r.code || "",
        r.prize_won || "",
        r.spun_at ? new Date(r.spun_at).toISOString() : "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(row.join(","));
    }
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${shop.slug}-analytics-${timeRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPDF = () => {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    const kpiHtml = [
      { label: "Total Spins", value: data.total },
      { label: "Winners", value: data.winners },
      { label: "Customers", value: data.customers },
      { label: "Conversion", value: `${data.conversion}%` },
    ].map((k) => `<div class="card"><div class="label">${k.label}</div><div class="value">${k.value}</div></div>`).join("");
    const rowsHtml = data.topPrizes
      .map((p) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${p.name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${p.value}</td></tr>`)
      .join("");
    w.document.write(`<!doctype html><html><head><title>${shop.name} — Analytics</title>
      <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0c2340;padding:32px;max-width:780px;margin:auto}
      h1{margin:0 0 4px 0} .muted{color:#4a5b78;font-size:13px;margin-bottom:24px}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}
      .card{border:1px solid #e5e9f0;border-radius:14px;padding:14px}
      .label{font-size:11px;text-transform:uppercase;color:#4a5b78;letter-spacing:.05em;font-weight:600}
      .value{font-size:24px;font-weight:800;margin-top:4px}
      h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#4a5b78;margin:24px 0 8px}
      table{width:100%;border-collapse:collapse;font-size:13px}</style></head><body>
      <h1>${shop.name}</h1>
      <p class="muted">Analytics · ${timeRange === "7d" ? "Last 7 days" : timeRange === "30d" ? "Last 30 days" : "All time"} · ${new Date().toLocaleString()}</p>
      <div class="grid">${kpiHtml}</div>
      <h2>Top Prizes</h2><table>${rowsHtml || '<tr><td class="muted">No data</td></tr>'}</table>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    w.document.close();
  };

  const PIE_COLORS = ["#FF6B00", "#0c2340", "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6"];

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-1.5">
            <div className="h-5 w-24 rounded-lg bg-[#F0F2F5] animate-pulse" />
            <div className="h-3 w-40 rounded-full bg-[#F0F2F5] animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-16 rounded-xl bg-[#F0F2F5] animate-pulse" />
            <div className="h-8 w-16 rounded-xl bg-[#F0F2F5] animate-pulse" />
          </div>
        </div>
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonKpiCard key={i} />)}
        </section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonBlock className="h-64" />
          <SkeletonBlock className="h-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonBlock className="h-44" />
          <SkeletonBlock className="h-44" />
          <SkeletonBlock className="h-44" />
        </div>
      </div>
    );
  }

  const kpis = [
    { label: "Total Spins", value: data.total, icon: TrendingUp, accentClass: "bg-orange-50 text-[#FF6B00]" },
    { label: "Winners", value: data.winners, icon: Trophy, accentClass: "bg-emerald-50 text-emerald-600" },
    { label: "Customers", value: data.customers, icon: Users, accentClass: "bg-blue-50 text-blue-600" },
    { label: "Conversion", value: `${data.conversion}%`, icon: Sparkles, accentClass: "bg-violet-50 text-violet-600" },
    { label: "Active Campaigns", value: activeCampaigns, icon: Activity, accentClass: "bg-pink-50 text-pink-600" },
  ];

  const chartLabel = timeRange === "7d" ? "Last 7 days" : timeRange === "30d" ? "Last 4 weeks" : "All time";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header + Controls */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-[#0c2340]">Analytics</h2>
          <p className="text-xs text-[#4a5b78]">Performance overview for {shop.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time range picker */}
          <div className="flex items-center gap-1 rounded-xl bg-[#F5F7FA] border border-[#0c2340]/8 p-1">
            {TIME_RANGE_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTimeRange(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeRange === key
                    ? "bg-white text-[#0c2340] shadow-sm font-bold"
                    : "text-[#4a5b78] hover:text-[#0c2340]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={exportPDF}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#0c2340]/10 px-3 py-2 text-xs font-bold text-[#0c2340] shadow-sm hover:border-[#FF6B00]/40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF6B00] text-white px-3 py-2 text-xs font-bold shadow-sm hover:bg-[#e85f00] transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map(({ label, value, icon, accentClass }) => (
          <KpiCard key={label} label={label} value={value} icon={icon} accentClass={accentClass} />
        ))}
      </section>

      {/* Empty state when no data in selected range */}
      {data.total === 0 && (
        <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)]">
          <EmptyState
            icon={BarChart2}
            title={timeRange === "all" ? "No data yet" : `No spins in the last ${timeRange === "7d" ? "7" : "30"} days`}
            description={
              timeRange === "all"
                ? "Customers who spin will show up here."
                : "Try selecting a wider date range to see more data."
            }
            action={timeRange !== "all" ? { label: "View all time", onClick: () => setTimeRange("all") } : undefined}
          />
        </div>
      )}

      {data.total > 0 && (
        <>
          {/* Charts */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
              <SectionHead
                title="Spins Over Time"
                right={<span className="text-[11px] text-[#4a5b78]">{chartLabel}</span>}
                className="mb-3"
              />
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chartDays} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0c234012" vertical={false} />
                    <XAxis dataKey="label" stroke="#4a5b78" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#4a5b78" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <RTooltip
                      cursor={{ fill: "#FF6B0010" }}
                      contentStyle={{ borderRadius: 12, border: "1px solid #0c234020", fontSize: 12 }}
                    />
                    <Bar dataKey="spins" fill="#FF6B00" radius={[8, 8, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
              <SectionHead
                title="Prize Distribution"
                right={<span className="text-[11px] text-[#4a5b78]">{chartLabel}</span>}
                className="mb-3"
              />
              {data.distArr.length === 0 ? (
                <div className="h-56 grid place-items-center text-sm text-[#4a5b78]">No prizes awarded yet.</div>
              ) : (
                <div className="h-56 flex items-center gap-3">
                  <div className="w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.distArr} dataKey="value" nameKey="name" innerRadius={42} outerRadius={78} paddingAngle={2}>
                          {data.distArr.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid #0c234020", fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="w-1/2 space-y-1.5 text-xs">
                    {data.distArr.slice(0, 6).map((d, i) => (
                      <li key={d.name} className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate text-[#0c2340] font-semibold">{d.name}</span>
                        <span className="ml-auto font-mono text-[#4a5b78]">{d.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Lower sections */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Prizes */}
            <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
              <SectionHead
                title="Top Prizes"
                right={<Trophy className="w-4 h-4 text-[#FF6B00]" />}
                className="mb-3"
              />
              {data.topPrizes.length === 0 ? (
                <p className="text-sm text-[#4a5b78]">No data yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {data.topPrizes.map((p, i) => {
                    const max = data.topPrizes[0].value || 1;
                    const pct = Math.round((p.value / max) * 100);
                    return (
                      <li key={p.name}>
                        <div className="flex justify-between text-xs font-semibold text-[#0c2340] mb-1">
                          <span className="truncate">#{i + 1} {p.name}</span>
                          <span className="text-[#4a5b78] font-mono">{p.value}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F5F7FA] overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#FF6B00] to-[#ff8a3d]" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Peak Activity */}
            <div className="rounded-[20px] p-5 bg-gradient-to-br from-[#0c2340] to-[#1a3a63] text-white shadow-[0_10px_30px_-12px_rgba(12,35,64,0.55)]">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-bold opacity-80">
                <Activity className="w-4 h-4" /> Peak Activity Time
              </div>
              <p className="text-3xl font-black mt-3">{data.peakHour}</p>
              <p className="text-xs opacity-80 mt-1">
                {data.peakCount > 0 ? `${data.peakCount} spins at this hour` : "No spin data yet"}
              </p>
              <div className="mt-4 pt-4 border-t border-white/10 text-xs opacity-70 leading-relaxed">
                Use this window to schedule promotions and reach customers when they're most engaged.
              </div>
            </div>

            {/* Performance */}
            <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
              <SectionHead
                title="Period Performance"
                right={<TrendingUp className="w-4 h-4 text-emerald-600" />}
                className="mb-3"
              />
              <div className="flex items-end gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] font-semibold">
                    {timeRange === "7d" ? "Last 7 days" : timeRange === "30d" ? "Last 30 days" : "All time"}
                  </p>
                  <p className="text-3xl font-black text-[#0c2340]">{data.total}</p>
                </div>
                {data.delta !== null && (
                  <span className={`mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${data.delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {data.delta >= 0 ? "▲" : "▼"} {Math.abs(data.delta)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-[#4a5b78] mt-2">vs previous {timeRange === "7d" ? "7" : "30"} days</p>
              <div className="mt-4 pt-4 border-t border-[#0c2340]/8 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[#4a5b78]">Win rate</p>
                  <p className="font-black text-[#0c2340] text-base">
                    {data.total > 0 ? Math.round((data.winners / data.total) * 100) : 0}%
                  </p>
                </div>
                <div>
                  <p className="text-[#4a5b78]">Avg / day</p>
                  <p className="font-black text-[#0c2340] text-base">
                    {timeRange === "all" ? "—" : Math.round(data.total / (timeRange === "7d" ? 7 : 30))}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

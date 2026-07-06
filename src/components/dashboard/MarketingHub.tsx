import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle, Calendar, CalendarClock, CheckCircle2, Clock, Eye, Info, Mail, Megaphone,
  MessageSquare, Phone, Save, Search, Send, Sparkles, Trash2,
  TrendingUp, Users, X, BarChart2, ShieldAlert,
} from "lucide-react";
import {
  LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { getCrmCustomers } from "@/lib/access-codes.functions";
import { listMyCampaigns } from "@/lib/campaigns.functions";
import { sendBulkEmail, sendBulkWhatsApp } from "@/lib/messaging.functions";
import { saveBroadcast, listBroadcasts } from "@/lib/marketing.functions";
import { getMarketingAnalytics } from "@/lib/marketing-analytics.functions";
import { DashCard, KpiCard, SectionHead, EmptyState, SkeletonKpiCard, SkeletonBlock, SkeletonRow } from "./ui";
import { TemplateManager } from "./MarketingTemplates";
import { ScheduledBroadcasts } from "./MarketingScheduled";
import type { FillComposeData } from "./MarketingScheduled";
import { saveScheduledBroadcast, listScheduledBroadcasts } from "@/lib/marketing-template.functions";
import type { CustomerRecord, Shop } from "./types";

// ─── Local types ───────────────────────────────────────────────────────────────

type Channel = "sms" | "whatsapp" | "email";
type SegmentKey = "all" | "Winner" | "VIP" | "Multi-Spin" | "New" | "Lapsed";
type Template = { id: string; name: string; subject?: string; body: string };
type HistoryEntry = {
  id: string;
  at: string;
  channel: Channel;
  count: number;
  sentCount: number;
  failedCount: number;
  preview: string;
  status: "sent" | "partial" | "failed" | "opened";
};
type CampaignItem = { id: string; name: string };

// ─── Analytics types ──────────────────────────────────────────────────────────

type AnalyticsRange = "7d" | "30d" | "90d" | "all";

type AnalyticsData = {
  totals: { broadcasts: number; recipients: number; delivered: number; failed: number };
  deliveryRate: number;
  channels: { sms: number; whatsapp: number; email: number };
  timeline: { date: string; broadcasts: number; recipients: number }[];
  segmentBreakdown: { segment: string; broadcasts: number }[];
  topBroadcasts: {
    id: string; name: string; channel: string;
    recipientCount: number; sentCount: number; failedCount: number; sentAt: string;
  }[];
};

// ─── Audience intelligence types ───────────────────────────────────────────────

type ChannelReach = {
  whatsapp: number;
  email: number;
  sms: number;
  total: number;
};

type SegmentCount = Record<SegmentKey, number>;

type AudiencePreview = {
  total: number;
  whatsapp: number;
  email: number;
  sms: number;
  excluded: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENT_KEYS: Exclude<SegmentKey, "all">[] = [
  "Winner", "VIP", "Multi-Spin", "New", "Lapsed",
];

const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "all",        label: "All" },
  { key: "Winner",     label: "Winners" },
  { key: "VIP",        label: "VIP" },
  { key: "Multi-Spin", label: "Multi-Spin" },
  { key: "New",        label: "New" },
  { key: "Lapsed",     label: "Lapsed" },
];

const CHANNELS: {
  key: Channel;
  label: string;
  icon: typeof MessageSquare;
  color: string;
}[] = [
  { key: "sms",      label: "SMS",      icon: Phone,         color: "#3b82f6" },
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "#10b981" },
  { key: "email",    label: "Email",    icon: Mail,          color: "#FF6B00" },
];

const DEFAULT_TEMPLATES: Record<Channel, Template[]> = {
  sms: [
    {
      id: "sms-win",
      name: "Winner alert",
      body: "Hi {customer_name}, congrats! You won {prize_name}. Visit us to claim your reward.",
    },
  ],
  whatsapp: [
    {
      id: "wa-win",
      name: "Winner alert",
      body: "🎉 Hi {customer_name}, you won *{prize_name}*! Show this message to claim your prize.",
    },
    {
      id: "wa-thx",
      name: "Thank you",
      body: "Hi {customer_name}, thanks for spinning at {shop_name}! Hope to see you again soon.",
    },
  ],
  email: [
    {
      id: "em-win",
      name: "Winner email",
      subject: "🎁 You won a prize!",
      body: "Hi {customer_name},\n\nThanks for spinning at {shop_name}!\nYou won: {prize_name}.\n\nSee you soon!",
    },
    {
      id: "em-re",
      name: "Re-engagement",
      subject: "We miss you!",
      body: "Hi {customer_name},\n\nIt's been a while since we saw you at {shop_name}.\nCome back and spin for a chance to win again!",
    },
  ],
};

const TOKENS = ["{customer_name}", "{prize_name}", "{shop_name}"];

// ─── DB row → HistoryEntry ─────────────────────────────────────────────────────

function dbRowToEntry(row: Record<string, unknown>): HistoryEntry {
  const ch = row.channel as Channel;
  const preview =
    ch === "email"
      ? String(row.subject ?? row.body ?? "").slice(0, 80)
      : String(row.body ?? "").slice(0, 80);
  return {
    id:          String(row.id),
    at:          String(row.created_at ?? row.sent_at ?? new Date().toISOString()),
    channel:     ch,
    count:       Number(row.recipient_count ?? 0),
    sentCount:   Number(row.sent_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    preview,
    status: (row.status ?? "sent") as HistoryEntry["status"],
  };
}

// ─── Percent helper ────────────────────────────────────────────────────────────

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

// ─── AudienceInsightsPanel sub-component ──────────────────────────────────────

function AudienceInsightsPanel({
  reach,
  segmentCounts,
  activeSegment,
  onSegmentClick,
  loading,
}: {
  reach: ChannelReach;
  segmentCounts: SegmentCount;
  activeSegment: SegmentKey;
  onSegmentClick: (k: SegmentKey) => void;
  loading: boolean;
}) {
  const segmentColor: Record<Exclude<SegmentKey, "all">, string> = {
    Winner:       "#FF6B00",
    VIP:          "#7c3aed",
    "Multi-Spin": "#0ea5e9",
    New:          "#10b981",
    Lapsed:       "#64748b",
  };

  return (
    <section
      className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-4"
      aria-label="Audience Insights"
    >
      <h3 className="text-sm font-bold text-[#0c2340] flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-[#FF6B00]" />
        Audience Insights
      </h3>

      {/* ── Channel reach ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 rounded-lg bg-[#F5F7FA] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-[#4a5b78] uppercase tracking-wide">
            Channel reach ({reach.total} total)
          </p>
          {(
            [
              { key: "whatsapp" as Channel, label: "WhatsApp", color: "#10b981", count: reach.whatsapp },
              { key: "email"    as Channel, label: "Email",    color: "#FF6B00", count: reach.email },
              { key: "sms"      as Channel, label: "SMS",      color: "#3b82f6", count: reach.sms },
            ] satisfies { key: Channel; label: string; color: string; count: number }[]
          ).map(({ key, label, color, count }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0c2340]">{label}</span>
                <span className="text-[#4a5b78]">
                  {count} · {pct(count, reach.total)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#F5F7FA] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: pct(count, reach.total),
                    background: color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Segment analytics ───────────────────────────────────────────── */}
      {loading ? (
        <div className="flex gap-2 flex-wrap">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-20 rounded-full bg-[#F5F7FA] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-[#4a5b78] uppercase tracking-wide">
            Segments — click to filter
          </p>
          <div className="flex gap-2 flex-wrap">
            {SEGMENT_KEYS.map((key) => {
              const count = segmentCounts[key];
              const color = segmentColor[key];
              const active = activeSegment === key;
              return (
                <button
                  key={key}
                  onClick={() => onSegmentClick(key)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    active
                      ? "text-white border-transparent shadow-sm"
                      : "bg-white text-[#0c2340] border-[#0c2340]/10 hover:border-opacity-40"
                  }`}
                  style={
                    active
                      ? { background: color, borderColor: color }
                      : { "--hover-border": color } as React.CSSProperties
                  }
                >
                  {key}
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      active ? "bg-white/25" : "bg-[#F5F7FA]"
                    }`}
                    style={active ? {} : { color }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── AudiencePreviewPanel sub-component ───────────────────────────────────────

function AudiencePreviewPanel({
  preview,
  campaignId,
  campaigns,
  onCampaignChange,
}: {
  preview: AudiencePreview;
  campaignId: string;
  campaigns: CampaignItem[];
  onCampaignChange: (id: string) => void;
}) {
  return (
    <section
      className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3"
      aria-label="Audience Preview"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-[#0c2340] flex items-center gap-2">
          <Users className="w-4 h-4 text-[#FF6B00]" />
          Audience Preview
        </h3>
        {campaigns.length > 1 && (
          <select
            value={campaignId}
            onChange={(e) => onCampaignChange(e.target.value)}
            aria-label="Filter audience by campaign"
            className="bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#0c2340] outline-none focus:border-[#FF6B00]/40 transition"
          >
            <option value="all">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Total */}
        <div className="col-span-2 flex items-center justify-between rounded-xl bg-[#0c2340]/4 px-3 py-2.5">
          <span className="text-xs font-semibold text-[#0c2340]">Total recipients</span>
          <span className="text-sm font-black text-[#0c2340]">{preview.total}</span>
        </div>
        {/* Per channel */}
        {(
          [
            { label: "WhatsApp", count: preview.whatsapp, color: "#10b981", bg: "bg-emerald-50" },
            { label: "Email",    count: preview.email,    color: "#FF6B00", bg: "bg-orange-50" },
            { label: "SMS",      count: preview.sms,      color: "#3b82f6", bg: "bg-blue-50" },
          ] as const
        ).map(({ label, count, color, bg }) => (
          <div
            key={label}
            className={`flex items-center justify-between rounded-xl px-3 py-2 ${bg}`}
          >
            <span className="text-xs font-semibold" style={{ color }}>{label}</span>
            <span className="text-sm font-bold" style={{ color }}>{count}</span>
          </div>
        ))}
        {/* Excluded */}
        {preview.excluded > 0 && (
          <div className="col-span-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-xs text-amber-700 font-semibold">
              {preview.excluded} customer{preview.excluded !== 1 ? "s" : ""} excluded — missing contact details
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── AnalyticsView sub-component ──────────────────────────────────────────────

const ANALYTICS_RANGES: { key: AnalyticsRange; label: string }[] = [
  { key: "7d",  label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "all", label: "All Time" },
];

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "#10b981",
  email:    "#FF6B00",
  sms:      "#3b82f6",
};

function fmtAxisDate(iso: string): string {
  const [, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

function fmtShortDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AnalyticsView({ shopId }: { shopId: string }) {
  const fetchAnalytics = useServerFn(getMarketingAnalytics);
  const [range,   setRange]   = useState<AnalyticsRange>("30d");
  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setData(null);
    fetchAnalytics({ data: { shopId, range } })
      .then((res) => { if (alive) setData(res as AnalyticsData); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [shopId, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const noData = !loading && (!data || data.totals.broadcasts === 0);

  // Pie data — channel breakdown
  const pieData = useMemo(() => {
    if (!data) return [];
    return (["whatsapp", "email", "sms"] as const)
      .map((ch) => ({ name: ch.charAt(0).toUpperCase() + ch.slice(1), value: data.channels[ch], color: CHANNEL_COLORS[ch] }))
      .filter((d) => d.value > 0);
  }, [data]);

  return (
    <div className="space-y-4">

      {/* ── Range picker ──────────────────────────────────────────────────── */}
      <div
        className="flex gap-1.5 flex-wrap"
        role="group"
        aria-label="Analytics date range"
      >
        {ANALYTICS_RANGES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            aria-pressed={range === key}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              range === key
                ? "bg-[#FF6B00] text-white border-[#FF6B00] shadow-sm"
                : "bg-white text-[#0c2340] border-[#0c2340]/10 hover:border-[#FF6B00]/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {loading ? (
          [0, 1, 2, 3].map((i) => <SkeletonKpiCard key={i} />)
        ) : noData ? null : (
          <>
            <KpiCard
              label="Total Broadcasts"
              value={data!.totals.broadcasts}
              icon={Megaphone}
              accentClass="bg-[#0c2340]/8 text-[#0c2340]"
            />
            <KpiCard
              label="Total Recipients"
              value={data!.totals.recipients.toLocaleString()}
              icon={Users}
              accentClass="bg-blue-50 text-blue-600"
            />
            <KpiCard
              label="Delivery Rate"
              value={`${data!.deliveryRate}%`}
              icon={TrendingUp}
              accentClass="bg-emerald-50 text-emerald-600"
            />
            <KpiCard
              label="Failures"
              value={data!.totals.failed.toLocaleString()}
              icon={AlertCircle}
              accentClass="bg-red-50 text-red-500"
            />
          </>
        )}
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {noData && (
        <DashCard className="p-0">
          <EmptyState
            icon={BarChart2}
            title="No broadcasts yet"
            description="Send your first marketing campaign to unlock analytics."
          />
        </DashCard>
      )}

      {!loading && !noData && data && (
        <>
          {/* ── Timeline chart ──────────────────────────────────────────── */}
          <DashCard className="p-4 space-y-3">
            <SectionHead title="Broadcast Timeline" />
            {data.timeline.length < 2 ? (
              <p className="text-xs text-[#4a5b78] py-4 text-center">
                Not enough data points — send more broadcasts to see a trend.
              </p>
            ) : (
              <div aria-label="Broadcast timeline line chart">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={data.timeline} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0c2340" strokeOpacity={0.06} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#4a5b78" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={fmtAxisDate}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#4a5b78" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #0c234014" }}
                      labelFormatter={fmtAxisDate}
                      formatter={(v: number) => [v.toLocaleString(), "Recipients"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="recipients"
                      stroke="#FF6B00"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4, fill: "#FF6B00" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashCard>

          {/* ── Channel + Segment charts (stacked) ──────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* Channel Breakdown — Pie */}
            <DashCard className="p-4 space-y-3">
              <SectionHead title="Channel Breakdown" />
              {pieData.length === 0 ? (
                <p className="text-xs text-[#4a5b78] py-4 text-center">No data</p>
              ) : (
                <div aria-label="Channel breakdown pie chart">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={60}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #0c234014" }}
                        formatter={(v: number, name: string) => [v, name]}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </DashCard>

            {/* Segment Performance — Horizontal Bar */}
            <DashCard className="p-4 space-y-3">
              <SectionHead title="Segment Performance" />
              {data.segmentBreakdown.length === 0 ? (
                <p className="text-xs text-[#4a5b78] py-4 text-center">No data</p>
              ) : (
                <div aria-label="Segment performance bar chart">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={data.segmentBreakdown}
                      layout="vertical"
                      margin={{ top: 0, right: 12, bottom: 0, left: 4 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: "#4a5b78" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="segment"
                        tick={{ fontSize: 10, fill: "#4a5b78" }}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #0c234014" }}
                        formatter={(v: number) => [v, "Broadcasts"]}
                      />
                      <Bar dataKey="broadcasts" fill="#FF6B00" radius={[0, 4, 4, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </DashCard>
          </div>

          {/* ── Top Broadcasts table ─────────────────────────────────────── */}
          {data.topBroadcasts.length > 0 && (
            <DashCard className="p-4 space-y-3">
              <SectionHead title="Top Broadcasts" right={<span className="text-[11px] text-[#4a5b78]">newest first · max 10</span>} />
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs min-w-[480px]" aria-label="Top broadcasts table">
                  <thead>
                    <tr className="text-[#4a5b78] font-semibold uppercase tracking-wide text-[10px]">
                      <th className="text-left pb-2 pl-1 pr-3">Name</th>
                      <th className="text-left pb-2 pr-3">Channel</th>
                      <th className="text-right pb-2 pr-3">Recipients</th>
                      <th className="text-right pb-2 pr-3">Delivered</th>
                      <th className="text-right pb-2 pr-3">Failed</th>
                      <th className="text-right pb-2 pr-1">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0c2340]/6">
                    {data.topBroadcasts.map((b) => (
                      <tr key={b.id} className="hover:bg-[#F5F7FA] transition-colors">
                        <td className="py-2 pl-1 pr-3 font-semibold text-[#0c2340] max-w-[140px] truncate">
                          {b.name || "Broadcast"}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className="px-2 py-0.5 rounded-full font-semibold text-[10px]"
                            style={{
                              background: `${CHANNEL_COLORS[b.channel] ?? "#6b7a93"}1a`,
                              color: CHANNEL_COLORS[b.channel] ?? "#6b7a93",
                            }}
                          >
                            {b.channel}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right text-[#0c2340] font-semibold">
                          {b.recipientCount.toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 text-right text-emerald-700 font-semibold">
                          {b.sentCount.toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 text-right text-red-500 font-semibold">
                          {b.failedCount > 0 ? b.failedCount.toLocaleString() : <span className="text-[#4a5b78]">—</span>}
                        </td>
                        <td className="py-2 pr-1 text-right text-[#4a5b78]">
                          {fmtShortDate(b.sentAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DashCard>
          )}
        </>
      )}

      {/* ── Loading skeletons ─────────────────────────────────────────────── */}
      {loading && (
        <>
          <SkeletonBlock className="h-[180px]" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SkeletonBlock className="h-[200px]" />
            <SkeletonBlock className="h-[200px]" />
          </div>
          <SkeletonBlock className="h-[200px]" />
        </>
      )}

    </div>
  );
}

// ─── HistoryView sub-component ─────────────────────────────────────────────────

function HistoryView({
  history,
  onClear,
}: {
  history: HistoryEntry[];
  onClear: () => void;
}) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[#FF6B00]/8 grid place-items-center mb-4">
          <Clock className="w-7 h-7 text-[#FF6B00]" strokeWidth={1.5} />
        </div>
        <p className="text-[#0c2340] font-bold">No broadcast history</p>
        <p className="text-sm text-[#4a5b78] mt-1.5 max-w-xs leading-relaxed">
          Once you send your first broadcast, it will appear here.
        </p>
      </div>
    );
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " · " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const statusClass = (s: HistoryEntry["status"]) => {
    if (s === "sent")    return "bg-emerald-50 text-emerald-700";
    if (s === "failed")  return "bg-red-50 text-red-600";
    if (s === "partial") return "bg-amber-50 text-amber-700";
    return "bg-blue-50 text-blue-700";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#0c2340]">
          {history.length} broadcast{history.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={onClear}
          className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
        >
          Clear view
        </button>
      </div>

      {history.map((h) => {
        const ch = CHANNELS.find((c) => c.key === h.channel)!;
        const Icon = ch.icon;
        return (
          <div
            key={h.id}
            className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
                style={{ background: `${ch.color}1a`, color: ch.color }}
              >
                <Icon className="w-4 h-4" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-[#0c2340]">
                    {ch.label} broadcast
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusClass(h.status)}`}>
                    {h.status}
                  </span>
                </div>
                <p className="text-xs text-[#4a5b78] mt-0.5 truncate">{h.preview}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#4a5b78] flex-wrap">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {h.count} recipient{h.count !== 1 ? "s" : ""}
                  </span>
                  {(h.sentCount > 0 || h.failedCount > 0) && (
                    <>
                      <span className="text-emerald-600 font-semibold">
                        {h.sentCount} sent
                      </span>
                      {h.failedCount > 0 && (
                        <span className="text-red-500 font-semibold">
                          {h.failedCount} failed
                        </span>
                      )}
                    </>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {fmtDate(h.at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MarketingHub ──────────────────────────────────────────────────────────────

export function MarketingHub({ shop }: { shop: Shop }) {
  const fetchCustomers  = useServerFn(getCrmCustomers);
  const fetchCampaigns  = useServerFn(listMyCampaigns);
  const fetchBroadcasts = useServerFn(listBroadcasts);
  const doEmail         = useServerFn(sendBulkEmail);
  const doWa            = useServerFn(sendBulkWhatsApp);
  const doSaveBroadcast  = useServerFn(saveBroadcast);
  const doSaveScheduled  = useServerFn(saveScheduledBroadcast);
  const doListScheduled  = useServerFn(listScheduledBroadcasts);

  const TPL_KEY = `mu-marketing-tpl-${shop.id}`;

  // ── State ────────────────────────────────────────────────────────────────────
  const [customers,  setCustomers]  = useState<CustomerRecord[]>([]);
  const [campaigns,  setCampaigns]  = useState<CampaignItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [channel,    setChannel]    = useState<Channel>("whatsapp");
  const [segment,    setSegment]    = useState<SegmentKey>("all");
  const [campaignId, setCampaignId] = useState<string>("all");
  const [search,     setSearch]     = useState("");
  const [subject,    setSubject]    = useState("");
  const [body,       setBody]       = useState("");
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [busy,       setBusy]       = useState(false);
  const [sendStatus, setSendStatus] = useState<{ kind: "ok" | "err" | "info"; msg: string } | null>(null);
  const [templates,  setTemplates]  = useState<Record<Channel, Template[]>>(DEFAULT_TEMPLATES);
  const [history,    setHistory]    = useState<HistoryEntry[]>([]);
  const [tplName,    setTplName]    = useState("");
  const [view,            setView]            = useState<"compose" | "history" | "insights" | "analytics" | "templates" | "scheduled">("compose");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate,    setScheduleDate]    = useState("");
  const [scheduleTime,    setScheduleTime]    = useState("09:00");
  const [todayScheduled,  setTodayScheduled]  = useState(0);

  // ── Load customers, campaigns, and broadcast history ─────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [custRes, campRes, bcRes, schRes] = await Promise.all([
          fetchCustomers({ data: { shopId: shop.id } }),
          fetchCampaigns({ data: { shopId: shop.id } }),
          fetchBroadcasts({ data: { shopId: shop.id } }).catch(() => ({ broadcasts: [] })),
          doListScheduled({ data: { shopId: shop.id } }).catch(() => ({ broadcasts: [] })),
        ]);
        if (!alive) return;

        setCustomers((custRes.customers as CustomerRecord[]) ?? []);

        const campData = campRes as { campaigns?: { id: string; name: string }[] } | undefined;
        setCampaigns((campData?.campaigns ?? []).map((c) => ({ id: c.id, name: c.name })));

        const bcData = bcRes as { broadcasts?: Record<string, unknown>[] } | undefined;
        setHistory((bcData?.broadcasts ?? [])
          .filter((r) => r.status !== "scheduled")
          .map(dbRowToEntry));

        const schData = schRes as { broadcasts?: { scheduledAt: string }[] } | undefined;
        const todayStr = new Date().toDateString();
        const count = (schData?.broadcasts ?? []).filter(
          (b) => new Date(b.scheduledAt).toDateString() === todayStr &&
                 new Date(b.scheduledAt).getTime() >= Date.now(),
        ).length;
        setTodayScheduled(count);
      } catch {
        if (!alive) return;
        setCustomers([]);
        setCampaigns([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [shop.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore templates from localStorage ──────────────────────────────────────
  useEffect(() => {
    try {
      const t = localStorage.getItem(TPL_KEY);
      if (t) setTemplates({ ...DEFAULT_TEMPLATES, ...JSON.parse(t) });
    } catch { /* ignore */ }
  }, [TPL_KEY]);

  const persistTemplates = useCallback(
    (next: Record<Channel, Template[]>) => {
      setTemplates(next);
      try { localStorage.setItem(TPL_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    },
    [TPL_KEY],
  );

  // ── Persist broadcast to DB ───────────────────────────────────────────────────
  const persistBroadcast = useCallback(
    async (params: {
      channel:        Channel;
      body:           string;
      subject:        string | null;
      segmentFilter:  string;
      campaignId:     string | null;
      recipientCount: number;
      sentCount:      number;
      failedCount:    number;
      status:         HistoryEntry["status"];
    }) => {
      const preview =
        params.channel === "email"
          ? (params.subject ?? params.body).slice(0, 80)
          : params.body.slice(0, 80);

      const optimistic: HistoryEntry = {
        id:          `opt-${Date.now()}`,
        at:          new Date().toISOString(),
        channel:     params.channel,
        count:       params.recipientCount,
        sentCount:   params.sentCount,
        failedCount: params.failedCount,
        preview,
        status:      params.status,
      };
      setHistory((prev) => [optimistic, ...prev].slice(0, 50));

      try {
        await doSaveBroadcast({
          data: {
            shopId:         shop.id,
            channel:        params.channel,
            body:           params.body,
            subject:        params.subject,
            segmentFilter:  params.segmentFilter,
            campaignId:     params.campaignId,
            recipientCount: params.recipientCount,
            sentCount:      params.sentCount,
            failedCount:    params.failedCount,
            status:         params.status,
          },
        });
        const bcRes = await fetchBroadcasts({ data: { shopId: shop.id } });
        const bcData = bcRes as { broadcasts?: Record<string, unknown>[] } | undefined;
        setHistory((bcData?.broadcasts ?? []).map(dbRowToEntry));
      } catch {
        // Keep the optimistic entry
      }
    },
    [shop.id, doSaveBroadcast, fetchBroadcasts],
  );

  // ── Sync default template body when channel changes ──────────────────────────
  useEffect(() => {
    const first = templates[channel]?.[0];
    if (first) { setBody(first.body); setSubject(first.subject ?? ""); }
    else        { setBody("");         setSubject(""); }
  }, [channel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audience Intelligence: deduplicated reach counts ─────────────────────────
  // All derived from the full `customers` array (before any filter), so these
  // numbers are stable regardless of active segment / search / channel.
  const channelReach = useMemo<ChannelReach>(() => {
    let whatsapp = 0, email = 0, sms = 0;
    for (const c of customers) {
      if (c.contact) { whatsapp++; sms++; }
      if (c.email)   email++;
    }
    return { whatsapp, email, sms, total: customers.length };
  }, [customers]);

  const segmentCounts = useMemo<SegmentCount>(() => {
    const counts: SegmentCount = {
      all: customers.length,
      Winner: 0, VIP: 0, "Multi-Spin": 0, New: 0, Lapsed: 0,
    };
    for (const c of customers) {
      for (const s of c.segments) {
        if (s in counts) (counts as Record<string, number>)[s]++;
      }
    }
    return counts;
  }, [customers]);

  // ── Filtered audience (per active channel + segment + campaign + search) ──────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (channel === "email" && !c.email) return false;
      if ((channel === "whatsapp" || channel === "sms") && !c.contact) return false;
      if (segment !== "all" && !c.segments.includes(segment)) return false;
      if (campaignId !== "all" && !c.campaignIds.includes(campaignId)) return false;
      if (q) {
        const hay = `${c.name ?? ""} ${c.contact ?? ""} ${c.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [customers, channel, segment, campaignId, search]);

  // Reachable = customers who have a contact for the active channel
  const reachable = useMemo(
    () => customers.filter((c) => channel === "email" ? !!c.email : !!c.contact),
    [customers, channel],
  );

  // ── Audience preview (for the Audience Preview panel) ────────────────────────
  // Uses the campaign-filtered (but not channel/segment/search filtered) view
  // so the user sees the full picture before picking a channel.
  const audiencePreview = useMemo<AudiencePreview>(() => {
    const base = campaignId === "all"
      ? customers
      : customers.filter((c) => c.campaignIds.includes(campaignId));

    let wa = 0, em = 0, sms = 0, excl = 0;
    for (const c of base) {
      const hasWa  = !!c.contact;
      const hasEm  = !!c.email;
      if (hasWa)  wa++;
      if (hasEm)  em++;
      if (hasWa || hasEm) sms = wa; // SMS shares phone with WA
      if (!hasWa && !hasEm) excl++;
    }
    return { total: base.length, whatsapp: wa, email: em, sms: wa, excluded: excl };
  }, [customers, campaignId]);

  const chosen = useMemo(
    () => filtered.filter((c) => selected.has(c.key)),
    [filtered, selected],
  );

  // Auto-select all when filters change
  useEffect(() => {
    setSelected(new Set(filtered.map((c) => c.key)));
  }, [filtered]);

  // ── Selection helpers ─────────────────────────────────────────────────────────
  const toggleCustomer = useCallback((key: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((s) =>
      s.size === filtered.length && filtered.length > 0
        ? new Set()
        : new Set(filtered.map((c) => c.key)),
    );
  }, [filtered]);

  // ── Personalisation ───────────────────────────────────────────────────────────
  const personalize = useCallback(
    (text: string, c: CustomerRecord) =>
      text
        .replaceAll("{customer_name}", c.name ?? "")
        .replaceAll("{prize_name}",    c.prizes[0] ?? "")
        .replaceAll("{shop_name}",     shop.name)
        .replaceAll("{{name}}",        c.name ?? "")
        .replaceAll("{{prize}}",       c.prizes[0] ?? "")
        .replaceAll("{{shop}}",        shop.name),
    [shop.name],
  );

  const previewCustomer: CustomerRecord = chosen[0] ?? filtered[0] ?? {
    key:         "sample",
    name:        "Alex",
    contact:     "+977 98XXXXXXXX",
    email:       "alex@example.com",
    totalSpins:  3,
    totalWins:   1,
    prizes:      ["10% Off Coupon"],
    firstSeen:   new Date().toISOString(),
    lastSeen:    new Date().toISOString(),
    campaignIds: [],
    segments:    ["Winner"],
  };
  const previewBody    = personalize(body, previewCustomer);
  const previewSubject = channel === "email" ? personalize(subject, previewCustomer) : "";

  // ── Template management ───────────────────────────────────────────────────────
  const saveTemplate = useCallback(() => {
    const name = tplName.trim();
    if (!name) {
      setSendStatus({ kind: "err", msg: "Enter a template name first." });
      return;
    }
    const newTpl: Template = {
      id: `${channel}-${Date.now()}`,
      name,
      body,
      ...(channel === "email" ? { subject } : {}),
    };
    persistTemplates({ ...templates, [channel]: [...templates[channel], newTpl] });
    setTplName("");
    setSendStatus({ kind: "ok", msg: `Template "${name}" saved.` });
  }, [tplName, channel, body, subject, templates, persistTemplates]);

  const deleteTemplate = useCallback(
    (id: string) => {
      persistTemplates({
        ...templates,
        [channel]: templates[channel].filter((t) => t.id !== id),
      });
    },
    [templates, channel, persistTemplates],
  );

  const loadTemplate = useCallback(
    (t: Template) => {
      setBody(t.body);
      if (channel === "email" && t.subject !== undefined) setSubject(t.subject);
    },
    [channel],
  );

  const insertToken = useCallback((token: string) => {
    setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}${token}`);
  }, []);

  // ── Send flows ────────────────────────────────────────────────────────────────
  // chosen is already deduplicated by customer key (getCrmCustomers deduplicates)
  const sendSms = useCallback(() => {
    if (chosen.length === 0) return;
    if (chosen.length > 5 && !confirm(`Open ${chosen.length} SMS drafts one after another?`)) return;
    setSendStatus({ kind: "info", msg: `Opening ${chosen.length} SMS draft${chosen.length !== 1 ? "s" : ""}…` });
    chosen.forEach((c, i) => {
      const phone = (c.contact ?? "").replace(/[^\d+]/g, "");
      if (!phone) return;
      setTimeout(
        () => window.open(`sms:${phone}?body=${encodeURIComponent(personalize(body, c))}`, "_blank", "noopener"),
        i * 250,
      );
    });
    void persistBroadcast({
      channel:        "sms",
      body,
      subject:        null,
      segmentFilter:  segment,
      campaignId:     campaignId === "all" ? null : campaignId,
      recipientCount: chosen.length,
      sentCount:      chosen.length,
      failedCount:    0,
      status:         "opened",
    });
    setTimeout(() => setSendStatus({ kind: "ok", msg: `${chosen.length} SMS draft${chosen.length !== 1 ? "s" : ""} opened.` }), 700);
  }, [chosen, body, segment, campaignId, personalize, persistBroadcast]);

  const sendWhatsApp = useCallback(() => {
    if (chosen.length === 0) return;
    if (chosen.length > 5 && !confirm(`Open ${chosen.length} WhatsApp chats one after another?`)) return;
    setSendStatus({ kind: "info", msg: `Opening ${chosen.length} chat${chosen.length !== 1 ? "s" : ""}…` });
    chosen.forEach((c, i) => {
      const phone = (c.contact ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "");
      if (!phone) return;
      setTimeout(
        () => window.open(`https://wa.me/${phone}?text=${encodeURIComponent(personalize(body, c))}`, "_blank", "noopener"),
        i * 250,
      );
    });
    doWa({
      data: {
        shopId:     shop.id,
        body,
        recipients: chosen.map((c) => ({ name: c.name, contact: c.contact!, prize: c.prizes[0] ?? null })),
      },
    }).catch(() => {});
    void persistBroadcast({
      channel:        "whatsapp",
      body,
      subject:        null,
      segmentFilter:  segment,
      campaignId:     campaignId === "all" ? null : campaignId,
      recipientCount: chosen.length,
      sentCount:      chosen.length,
      failedCount:    0,
      status:         "sent",
    });
    setTimeout(() => setSendStatus({ kind: "ok", msg: `WhatsApp opened for ${chosen.length} customer${chosen.length !== 1 ? "s" : ""}.` }), 700);
  }, [chosen, body, segment, campaignId, shop.id, personalize, doWa, persistBroadcast]);

  const sendEmail = useCallback(async () => {
    if (chosen.length === 0) return;
    if (!subject.trim()) {
      setSendStatus({ kind: "err", msg: "Subject line is required for email." });
      return;
    }
    setBusy(true);
    setSendStatus(null);
    try {
      const res = await doEmail({
        data: {
          shopId:     shop.id,
          subject,
          body,
          recipients: chosen.map((c) => ({ name: c.name, email: c.email!, prize: c.prizes[0] ?? null })),
        },
      });
      if (!res.ok) {
        const msg = (res as { ok: false; message?: string }).message ?? "Email not configured.";
        setSendStatus({ kind: "err", msg });
        void persistBroadcast({
          channel:        "email",
          body,
          subject,
          segmentFilter:  segment,
          campaignId:     campaignId === "all" ? null : campaignId,
          recipientCount: chosen.length,
          sentCount:      0,
          failedCount:    chosen.length,
          status:         "failed",
        });
      } else {
        const failed = res.total - res.sent;
        setSendStatus({ kind: "ok", msg: `Sent ${res.sent} of ${res.total} emails.` });
        void persistBroadcast({
          channel:        "email",
          body,
          subject,
          segmentFilter:  segment,
          campaignId:     campaignId === "all" ? null : campaignId,
          recipientCount: res.total,
          sentCount:      res.sent,
          failedCount:    failed,
          status:         failed === 0 ? "sent" : res.sent === 0 ? "failed" : "partial",
        });
      }
    } catch (e) {
      setSendStatus({ kind: "err", msg: e instanceof Error ? e.message : "Send failed." });
    } finally {
      setBusy(false);
    }
  }, [chosen, subject, body, segment, campaignId, shop.id, doEmail, persistBroadcast]);

  const handleSchedule = useCallback(async () => {
    if (!scheduleDate || !scheduleTime) {
      setSendStatus({ kind: "err", msg: "Please select a date and time for scheduling." });
      return;
    }
    if (!body.trim()) {
      setSendStatus({ kind: "err", msg: "Message body is required." });
      return;
    }
    if (channel === "email" && !subject.trim()) {
      setSendStatus({ kind: "err", msg: "Subject line is required for email." });
      return;
    }
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    if (new Date(scheduledAt).getTime() <= Date.now()) {
      setSendStatus({ kind: "err", msg: "Scheduled time must be in the future." });
      return;
    }
    setBusy(true);
    setSendStatus(null);
    try {
      await doSaveScheduled({
        data: {
          shopId:         shop.id,
          channel,
          body,
          subject:        channel === "email" ? (subject.trim() || null) : null,
          segmentFilter:  segment,
          campaignId:     campaignId === "all" ? null : campaignId,
          recipientCount: chosen.length,
          scheduledAt,
        },
      });
      const isToday = scheduledAt.slice(0, 10) === new Date().toISOString().slice(0, 10);
      if (isToday) setTodayScheduled((n) => n + 1);
      setSendStatus({
        kind: "ok",
        msg: `Broadcast scheduled for ${new Date(scheduledAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`,
      });
      setScheduleEnabled(false);
    } catch (e) {
      setSendStatus({ kind: "err", msg: e instanceof Error ? e.message : "Scheduling failed." });
    } finally {
      setBusy(false);
    }
  }, [scheduleDate, scheduleTime, body, subject, channel, segment, campaignId, chosen.length, shop.id, doSaveScheduled]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSend = useCallback(() => {
    setSendStatus(null);
    if (scheduleEnabled) { void handleSchedule(); return; }
    if (channel === "sms")           sendSms();
    else if (channel === "whatsapp") sendWhatsApp();
    else                             sendEmail();
  }, [scheduleEnabled, handleSchedule, channel, sendSms, sendWhatsApp, sendEmail]);

  const sendLabel = scheduleEnabled
    ? (busy ? "Scheduling…" : "Schedule Broadcast")
    : channel === "email"
      ? busy ? "Sending…" : `Email ${chosen.length} customer${chosen.length !== 1 ? "s" : ""}`
      : channel === "sms"
        ? `Open SMS for ${chosen.length}`
        : `WhatsApp ${chosen.length} customer${chosen.length !== 1 ? "s" : ""}`;

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-28 animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-[#0c2340]">Marketing</h2>
          <p className="text-xs text-[#4a5b78]">Broadcast to your customers</p>
        </div>
        <div className="flex rounded-xl bg-[#F5F7FA] p-1 text-xs font-bold overflow-x-auto gap-0.5">
          <button
            onClick={() => setView("compose")}
            aria-pressed={view === "compose"}
            className={`shrink-0 px-3 py-1.5 rounded-lg transition-colors ${view === "compose" ? "bg-white text-[#0c2340] shadow-sm" : "text-[#4a5b78]"}`}
          >
            Broadcast
          </button>
          <button
            onClick={() => setView("templates")}
            aria-pressed={view === "templates"}
            className={`shrink-0 px-3 py-1.5 rounded-lg transition-colors ${view === "templates" ? "bg-white text-[#0c2340] shadow-sm" : "text-[#4a5b78]"}`}
          >
            Templates
          </button>
          <button
            onClick={() => setView("scheduled")}
            aria-pressed={view === "scheduled"}
            className={`shrink-0 px-3 py-1.5 rounded-lg transition-colors ${view === "scheduled" ? "bg-white text-[#0c2340] shadow-sm" : "text-[#4a5b78]"}`}
          >
            Scheduled{todayScheduled > 0 ? ` (${todayScheduled})` : ""}
          </button>
          <button
            onClick={() => setView("insights")}
            aria-pressed={view === "insights"}
            className={`shrink-0 px-3 py-1.5 rounded-lg transition-colors ${view === "insights" ? "bg-white text-[#0c2340] shadow-sm" : "text-[#4a5b78]"}`}
          >
            Insights
          </button>
          <button
            onClick={() => setView("analytics")}
            aria-pressed={view === "analytics"}
            className={`shrink-0 px-3 py-1.5 rounded-lg transition-colors ${view === "analytics" ? "bg-white text-[#0c2340] shadow-sm" : "text-[#4a5b78]"}`}
          >
            Analytics
          </button>
          <button
            onClick={() => setView("history")}
            aria-pressed={view === "history"}
            className={`shrink-0 px-3 py-1.5 rounded-lg transition-colors ${view === "history" ? "bg-white text-[#0c2340] shadow-sm" : "text-[#4a5b78]"}`}
          >
            History{history.length > 0 ? ` (${history.length})` : ""}
          </button>
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {loading ? (
          <>
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
          </>
        ) : (
          <>
            <KpiCard
              label="Customers"
              value={customers.length}
              icon={Users}
              accentClass="bg-[#0c2340]/8 text-[#0c2340]"
            />
            <KpiCard
              label="Reachable"
              value={reachable.length}
              icon={channel === "email" ? Mail : MessageSquare}
              accentClass="bg-emerald-50 text-emerald-600"
            />
            <KpiCard
              label="Audience"
              value={filtered.length}
              icon={Megaphone}
              accentClass="bg-[#FF6B00]/12 text-[#FF6B00]"
            />
          </>
        )}
      </div>

      {/* ── Scheduled notification banner ───────────────────────────────────── */}
      {todayScheduled > 0 && view !== "scheduled" && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl bg-[#FF6B00]/10 border border-[#FF6B00]/20 px-3.5 py-2.5 text-sm font-semibold text-[#FF6B00]"
        >
          <CalendarClock className="w-4 h-4 shrink-0" />
          You have {todayScheduled} scheduled broadcast{todayScheduled !== 1 ? "s" : ""} today.
          <button
            onClick={() => setView("scheduled")}
            className="ml-auto text-xs font-bold underline underline-offset-2"
          >
            View
          </button>
        </div>
      )}

      {/* ── Insights view ───────────────────────────────────────────────────── */}
      {view === "insights" && (
        <div className="space-y-4">
          <AudienceInsightsPanel
            reach={channelReach}
            segmentCounts={segmentCounts}
            activeSegment={segment}
            onSegmentClick={(k) => {
              setSegment(k);
              setView("compose");
            }}
            loading={loading}
          />
          <AudiencePreviewPanel
            preview={audiencePreview}
            campaignId={campaignId}
            campaigns={campaigns}
            onCampaignChange={(id) => {
              setCampaignId(id);
            }}
          />
        </div>
      )}

      {/* ── Analytics view ──────────────────────────────────────────────────── */}
      {view === "analytics" && (
        <AnalyticsView shopId={shop.id} />
      )}

      {/* ── Templates view ──────────────────────────────────────────────────── */}
      {view === "templates" && (
        <TemplateManager
          shopId={shop.id}
          onUseTemplate={({ body: b, subject: s }) => {
            setBody(b);
            setSubject(s ?? "");
            setView("compose");
          }}
        />
      )}

      {/* ── Scheduled view ──────────────────────────────────────────────────── */}
      {view === "scheduled" && (
        <ScheduledBroadcasts
          shopId={shop.id}
          onFillCompose={({ channel: ch, body: b, subject: s, segmentFilter: seg }: FillComposeData) => {
            const validCh: Channel = ch === "email" || ch === "sms" || ch === "whatsapp" ? (ch as Channel) : "whatsapp";
            setChannel(validCh);
            setBody(b);
            setSubject(s ?? "");
            const validSeg: SegmentKey = (["all","Winner","VIP","Multi-Spin","New","Lapsed"] as string[]).includes(seg)
              ? (seg as SegmentKey)
              : "all";
            setSegment(validSeg);
            setView("compose");
          }}
        />
      )}

      {/* ── History view ────────────────────────────────────────────────────── */}
      {view === "history" && (
        <HistoryView
          history={history}
          onClear={() => setHistory([])}
        />
      )}

      {/* ── Compose view ────────────────────────────────────────────────────── */}
      {view === "compose" && (
        <>
          {/* Channel selector */}
          <div className="grid grid-cols-3 gap-2">
            {CHANNELS.map(({ key, label, icon: Icon, color }) => {
              const active = channel === key;
              return (
                <button
                  key={key}
                  onClick={() => setChannel(key)}
                  aria-pressed={active}
                  className={`rounded-2xl border p-3 flex flex-col items-center gap-1.5 transition-all ${
                    active
                      ? "bg-white border-[#FF6B00] shadow-[0_8px_24px_-12px_rgba(255,107,0,0.45)]"
                      : "bg-white border-[#0c2340]/10 hover:border-[#0c2340]/20"
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-xl grid place-items-center"
                    style={{
                      background: active ? color : `${color}1a`,
                      color:      active ? "#fff" : color,
                    }}
                  >
                    <Icon className="w-4 h-4" strokeWidth={2.2} />
                  </div>
                  <span className={`text-xs font-bold ${active ? "text-[#0c2340]" : "text-[#4a5b78]"}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Sticky: Segment chips + campaign filter + search ──────────── */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-3 space-y-2.5 shadow-[0_4px_12px_-4px_rgba(12,35,64,0.06)]">

            {/* Segment chips */}
            <div
              className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5"
              role="group"
              aria-label="Filter by segment"
            >
              {SEGMENTS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSegment(key)}
                  aria-pressed={segment === key}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    segment === key
                      ? "bg-[#FF6B00] text-white border-[#FF6B00] shadow-sm"
                      : "bg-white text-[#0c2340] border-[#0c2340]/10 hover:border-[#FF6B00]/40"
                  }`}
                >
                  {label}
                  {key !== "all" && !loading && (
                    <span className="ml-1 text-[9px] opacity-70">
                      {segmentCounts[key]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Campaign filter + search */}
            <div className="flex gap-2">
              {campaigns.length > 1 && (
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  aria-label="Filter by campaign"
                  className="bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-3 py-2 text-xs font-semibold text-[#0c2340] outline-none focus:border-[#FF6B00]/40 shrink-0 max-w-[140px] transition"
                >
                  <option value="all">All Campaigns</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b7a93] pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customers…"
                  aria-label="Search customers"
                  className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl pl-8 pr-8 py-2 text-sm outline-none focus:border-[#FF6B00]/40 transition"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6b7a93] hover:text-[#0c2340] transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Audience Preview inline (compose) ────────────────────────── */}
          <AudiencePreviewPanel
            preview={audiencePreview}
            campaignId={campaignId}
            campaigns={campaigns}
            onCampaignChange={setCampaignId}
          />

          {/* ── Templates ────────────────────────────────────────────────── */}
          <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0c2340] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF6B00]" /> Templates
              </h3>
              <span className="text-[11px] text-[#4a5b78]">
                {templates[channel].length} saved
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
              {templates[channel].map((t) => (
                <div
                  key={t.id}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#F5F7FA] border border-[#0c2340]/8 pl-3 pr-1 py-1"
                >
                  <button
                    onClick={() => loadTemplate(t)}
                    className="text-xs font-semibold text-[#0c2340]"
                  >
                    {t.name}
                  </button>
                  {!t.id.match(/^(sms|wa|em)-(win|thx|re)$/) && (
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      aria-label={`Delete template "${t.name}"`}
                      className="p-1 rounded-full hover:bg-red-50 text-[#4a5b78] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {templates[channel].length === 0 && (
                <p className="text-xs text-[#4a5b78] py-1">No templates yet.</p>
              )}
            </div>

            <div className="flex gap-2">
              <input
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveTemplate(); }}
                placeholder="Save current message as…"
                maxLength={40}
                className="flex-1 bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#FF6B00] transition"
              />
              <button
                onClick={saveTemplate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0c2340] text-white px-3 py-2 text-xs font-bold hover:bg-[#1a3a63] transition-colors"
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </section>

          {/* ── Composer ─────────────────────────────────────────────────── */}
          <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3">
            <h3 className="text-sm font-bold text-[#0c2340]">Message</h3>

            {channel === "email" && (
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line…"
                maxLength={200}
                aria-label="Email subject"
                className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B00] transition"
              />
            )}

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={4000}
              placeholder={
                channel === "email"
                  ? "Email body…"
                  : channel === "whatsapp"
                    ? "WhatsApp message…"
                    : "SMS text…"
              }
              aria-label="Message body"
              className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF6B00] resize-none transition"
            />

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[#4a5b78] font-medium">Insert:</span>
              {TOKENS.map((tok) => (
                <button
                  key={tok}
                  onClick={() => insertToken(tok)}
                  className="text-[11px] font-mono font-semibold text-[#FF6B00] bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded-md transition-colors"
                >
                  {tok}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-[#4a5b78]">{body.length}/4000</span>
            </div>
          </section>

          {/* ── Live preview ──────────────────────────────────────────────── */}
          <section className="rounded-[20px] p-4 bg-gradient-to-br from-[#F5F7FA] to-white border border-[#0c2340]/8">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-[#0c2340]" strokeWidth={2} />
              <h3 className="text-sm font-bold text-[#0c2340]">Live preview</h3>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-[#4a5b78]">
                As {previewCustomer.name ?? "sample"}
              </span>
            </div>
            <div className="rounded-2xl bg-white border border-[#0c2340]/8 p-3 shadow-sm">
              {channel === "email" && previewSubject && (
                <p className="text-sm font-bold text-[#0c2340] mb-1">{previewSubject}</p>
              )}
              {previewBody ? (
                <p className="text-sm text-[#0c2340] whitespace-pre-wrap leading-relaxed">
                  {previewBody}
                </p>
              ) : (
                <p className="text-sm text-[#4a5b78] italic">Your message will appear here…</p>
              )}
            </div>
          </section>

          {/* ── Scheduling toggle ─────────────────────────────────────────── */}
          <section
            className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3"
            aria-label="Schedule broadcast"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#FF6B00]" />
                <span className="text-sm font-bold text-[#0c2340]">Schedule for later</span>
              </div>
              <button
                onClick={() => setScheduleEnabled((v) => !v)}
                aria-pressed={scheduleEnabled}
                aria-label="Toggle scheduling"
                className={`relative w-11 h-6 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-[#FF6B00] focus-visible:ring-offset-1 ${scheduleEnabled ? "bg-[#FF6B00]" : "bg-[#0c2340]/15"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${scheduleEnabled ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
            {scheduleEnabled && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="schedule-date" className="text-xs font-semibold text-[#4a5b78] uppercase tracking-wide">
                      Date
                    </label>
                    <input
                      id="schedule-date"
                      type="date"
                      value={scheduleDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FF6B00] transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="schedule-time" className="text-xs font-semibold text-[#4a5b78] uppercase tracking-wide">
                      Time
                    </label>
                    <input
                      id="schedule-time"
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FF6B00] transition"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-[#4a5b78]">
                  <span className="font-semibold">Timezone:</span>{" "}
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </p>
              </div>
            )}
          </section>

          {/* ── Audience list ─────────────────────────────────────────────── */}
          <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0c2340] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FF6B00]" />
                Audience
                <span className="text-[11px] font-semibold text-[#4a5b78]">
                  ({chosen.length}/{filtered.length})
                </span>
              </h3>
              <button
                onClick={toggleAll}
                className="text-xs font-bold text-[#FF6B00] hover:underline"
              >
                {selected.size === filtered.length && filtered.length > 0
                  ? "Deselect all"
                  : "Select all"}
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-[#4a5b78]">
                  No customers match — or none have{" "}
                  {channel === "email" ? "an email address" : "a phone number"} on record.
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto -mx-1 px-1">
                {filtered.map((c) => {
                  const checked  = selected.has(c.key);
                  const contact  = channel === "email" ? c.email : c.contact;
                  const isWinner = c.totalWins > 0;
                  const init     = (c.name ?? c.email ?? c.contact ?? "?").slice(0, 1).toUpperCase();
                  return (
                    <li key={c.key}>
                      <label
                        className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                          checked
                            ? "bg-orange-50 border border-[#FF6B00]/30"
                            : "bg-[#F5F7FA] border border-transparent hover:bg-[#eef1f6]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCustomer(c.key)}
                          className="w-4 h-4 accent-[#FF6B00] shrink-0"
                        />
                        <div
                          className={`w-9 h-9 shrink-0 rounded-xl grid place-items-center text-xs font-black ${
                            isWinner
                              ? "bg-[#FF6B00]/15 text-[#FF6B00]"
                              : "bg-[#0c2340]/8 text-[#0c2340]"
                          }`}
                        >
                          {init}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#0c2340] truncate">
                            {c.name ?? "Anonymous"}
                          </p>
                          <p className="text-[11px] text-[#4a5b78] truncate">
                            {contact ?? "—"}
                          </p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-0.5">
                          {isWinner && (
                            <span className="text-[9px] font-bold text-[#FF6B00] bg-orange-50 px-1.5 py-0.5 rounded-full leading-tight">
                              Winner
                            </span>
                          )}
                          <span className="text-[10px] text-[#4a5b78]">
                            {c.totalSpins}× spin
                          </span>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── Status banner ─────────────────────────────────────────────── */}
          {sendStatus && (
            <div
              className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm font-semibold ${
                sendStatus.kind === "ok"
                  ? "bg-emerald-50 text-emerald-700"
                  : sendStatus.kind === "err"
                    ? "bg-red-50 text-red-700"
                    : "bg-blue-50 text-blue-700"
              }`}
            >
              {sendStatus.kind === "ok"   && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
              {sendStatus.kind === "err"  && <AlertCircle  className="w-4 h-4 shrink-0 mt-0.5" />}
              {sendStatus.kind === "info" && <Info         className="w-4 h-4 shrink-0 mt-0.5" />}
              {sendStatus.msg}
            </div>
          )}
        </>
      )}

      {/* ── Sticky send button (compose only) ───────────────────────────────── */}
      {view === "compose" && (
        <div className="fixed bottom-20 left-0 right-0 z-30 px-4">
          <div className="max-w-md mx-auto sm:max-w-2xl">
            <button
              onClick={onSend}
              disabled={chosen.length === 0 || busy || !body.trim()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FF6B00] text-white font-bold py-3.5 shadow-[0_10px_30px_-10px_rgba(255,107,0,0.6)] hover:bg-[#e85f00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
              {sendLabel}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

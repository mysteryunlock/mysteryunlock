import { useState, memo } from "react";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  BarChart3,
  MessageSquare,
  Settings,
  TrendingUp,
  Trophy,
  Gift,
  Star,
  ChevronRight,
  Send,
  Bell,
  Palette,
  Shield,
  Building2,
  ArrowUpRight,
  Check,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SectionContainer } from "@/components/foundation/layout/SectionContainer";
import { FoundationCard } from "@/components/foundation/cards/Card";

// ─── Brand tokens ──────────────────────────────────────────────
const B = {
  dark: "#2A3E4B",
  mid: "#7FA6B8",
  light: "#D6E6EF",
  bg: "#F7FBFD",
  accent: "#FF6B00",
  navy: "#0c2340",
};

// ─── Types ─────────────────────────────────────────────────────
type TabKey = "dashboard" | "campaigns" | "customers" | "analytics" | "messages" | "settings";

// ─── Nav items ─────────────────────────────────────────────────
const NAV_ITEMS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { key: "campaigns", label: "Campaigns", icon: <Megaphone className="size-4" /> },
  { key: "customers", label: "Customers", icon: <Users className="size-4" /> },
  { key: "analytics", label: "Analytics", icon: <BarChart3 className="size-4" /> },
  { key: "messages", label: "Messages", icon: <MessageSquare className="size-4" /> },
  { key: "settings", label: "Settings", icon: <Settings className="size-4" /> },
];

// ─── Static sample data ────────────────────────────────────────
const REVENUE_DATA = [
  { month: "Jan", revenue: 12400 },
  { month: "Feb", revenue: 18200 },
  { month: "Mar", revenue: 15800 },
  { month: "Apr", revenue: 22600 },
  { month: "May", revenue: 28900 },
  { month: "Jun", revenue: 26300 },
  { month: "Jul", revenue: 34100 },
];

const CUSTOMER_GROWTH = [
  { month: "Jan", customers: 210 },
  { month: "Feb", customers: 340 },
  { month: "Mar", customers: 420 },
  { month: "Apr", customers: 590 },
  { month: "May", customers: 780 },
  { month: "Jun", customers: 920 },
  { month: "Jul", customers: 1240 },
];

const REWARD_CLAIMS = [
  { week: "W1", claims: 48 },
  { week: "W2", claims: 72 },
  { week: "W3", claims: 91 },
  { week: "W4", claims: 65 },
  { week: "W5", claims: 110 },
  { week: "W6", claims: 88 },
];

const CUSTOMERS_TABLE = [
  { name: "Anisha Rai", membership: "Gold", visits: 24, rewards: 8 },
  { name: "Bikash Shrestha", membership: "Silver", visits: 17, rewards: 5 },
  { name: "Priya Karki", membership: "Gold", visits: 31, rewards: 12 },
  { name: "Sanjay Thapa", membership: "Bronze", visits: 9, rewards: 2 },
  { name: "Meera Pandey", membership: "Gold", visits: 43, rewards: 18 },
];

const MEMBERSHIP_COLORS: Record<string, string> = {
  Gold: "bg-amber-100 text-amber-700",
  Silver: "bg-slate-100 text-slate-600",
  Bronze: "bg-orange-100 text-orange-700",
};

// ─── Panel: Dashboard ──────────────────────────────────────────
function DashboardPanel() {
  const stats = [
    { label: "Total Customers", value: "1,240", trend: "+18% this month", up: true, icon: <Users className="size-4" />, accent: "bg-blue-50 text-blue-600" },
    { label: "Campaigns", value: "6", trend: "3 active", up: true, icon: <Megaphone className="size-4" />, accent: "bg-violet-50 text-violet-600" },
    { label: "Rewards Claimed", value: "474", trend: "+32% this month", up: true, icon: <Gift className="size-4" />, accent: "bg-emerald-50 text-emerald-600" },
    { label: "Revenue Growth", value: "+34%", trend: "vs last month", up: true, icon: <TrendingUp className="size-4" />, accent: "bg-orange-50 text-[#FF6B00]" },
  ];

  return (
    <div className="space-y-4 h-full">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm p-3.5 flex flex-col gap-2"
          >
            <div className={`w-8 h-8 rounded-lg grid place-items-center ${s.accent} shrink-0`}>
              {s.icon}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] font-semibold">{s.label}</p>
              <p className="text-xl font-black text-[#2A3E4B]">{s.value}</p>
            </div>
            <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
              <ArrowUpRight className="size-3" />
              {s.trend}
            </span>
          </div>
        ))}
      </div>

      {/* Mini revenue chart */}
      <div className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm p-3.5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-[#2A3E4B]">Revenue Trend</p>
          <span className="text-[10px] text-[#4a5b78]">Last 7 months</span>
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={REVENUE_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={B.accent} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={B.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A3E4B12" vertical={false} />
              <XAxis dataKey="month" fontSize={9} tickLine={false} axisLine={false} stroke="#4a5b78" />
              <YAxis fontSize={9} tickLine={false} axisLine={false} stroke="#4a5b78" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #2A3E4B20", fontSize: 11 }}
                formatter={(v: number) => [`Rs.${v.toLocaleString()}`, "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke={B.accent} strokeWidth={2} fill="url(#revGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent activity strip */}
      <div className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm p-3.5">
        <p className="text-xs font-bold text-[#2A3E4B] mb-2.5">Recent Winners</p>
        <ul className="space-y-2">
          {CUSTOMERS_TABLE.slice(0, 3).map((c) => (
            <li key={c.name} className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#D6E6EF] grid place-items-center text-[10px] font-black text-[#2A3E4B] shrink-0">
                {c.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-[#2A3E4B] truncate">{c.name}</p>
                <p className="text-[10px] text-[#4a5b78]">{c.rewards} rewards claimed</p>
              </div>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${MEMBERSHIP_COLORS[c.membership]}`}>
                {c.membership}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Panel: Campaigns ─────────────────────────────────────────
function CampaignsPanel() {
  const campaigns = [
    { name: "Summer Spin Bonanza", status: "Active", progress: 72, color: "bg-emerald-500", spins: 843, prizes: ["Rs.2000 Cash", "Earphones", "Rs.100 Cash"] },
    { name: "Monsoon Rewards", status: "Active", progress: 45, color: "bg-blue-500", spins: 401, prizes: ["Cooler Fan", "Watch", "Try Again"] },
    { name: "Dashain Special", status: "Scheduled", progress: 0, color: "bg-amber-500", spins: 0, prizes: ["Rs.5000 Cash", "Headphones", "T-Shirt"] },
  ];

  return (
    <div className="space-y-3 h-full">
      {campaigns.map((c) => (
        <div key={c.name} className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#2A3E4B] truncate">{c.name}</p>
              <p className="text-[11px] text-[#4a5b78] mt-0.5">{c.spins.toLocaleString()} spins</p>
            </div>
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
              c.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}>
              {c.status}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-[#4a5b78] mb-1">
              <span>Campaign progress</span>
              <span>{c.progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#D6E6EF]">
              <div
                className={`h-full rounded-full transition-all ${c.color}`}
                style={{ width: `${c.progress}%` }}
              />
            </div>
          </div>

          {/* Reward distribution pills */}
          <div>
            <p className="text-[10px] text-[#4a5b78] mb-1.5 font-semibold uppercase tracking-wide">Reward Distribution</p>
            <div className="flex flex-wrap gap-1.5">
              {c.prizes.map((p) => (
                <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-[#F4F6FA] text-[#2A3E4B] font-medium">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Panel: Customers ─────────────────────────────────────────
function CustomersPanel() {
  return (
    <div className="h-full flex flex-col gap-3">
      {/* Summary bar */}
      <div className="flex gap-2">
        {[
          { label: "Total", value: "1,240", color: "bg-[#D6E6EF] text-[#2A3E4B]" },
          { label: "Gold", value: "312", color: "bg-amber-100 text-amber-700" },
          { label: "Silver", value: "608", color: "bg-slate-100 text-slate-600" },
          { label: "Bronze", value: "320", color: "bg-orange-100 text-orange-700" },
        ].map((s) => (
          <div key={s.label} className={`flex-1 rounded-lg px-2 py-2 text-center ${s.color}`}>
            <p className="text-base font-black leading-none">{s.value}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm overflow-hidden flex-1">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-4 py-2 bg-[#F4F6FA] border-b border-[#2A3E4B]/8">
          {["Name", "Membership", "Visits", "Rewards"].map((h) => (
            <p key={h} className="text-[10px] font-bold uppercase tracking-wide text-[#4a5b78]">{h}</p>
          ))}
        </div>
        <ul className="divide-y divide-[#2A3E4B]/6">
          {CUSTOMERS_TABLE.map((c) => (
            <li key={c.name} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-4 py-2.5 items-center hover:bg-[#F7FBFD] transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#D6E6EF] grid place-items-center text-[10px] font-black text-[#2A3E4B] shrink-0">
                  {c.name[0]}
                </div>
                <p className="text-xs font-semibold text-[#2A3E4B] truncate">{c.name}</p>
              </div>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${MEMBERSHIP_COLORS[c.membership]}`}>
                {c.membership}
              </span>
              <p className="text-xs font-semibold text-[#2A3E4B] text-right">{c.visits}</p>
              <p className="text-xs font-semibold text-[#FF6B00] text-right">{c.rewards}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Panel: Analytics ─────────────────────────────────────────
function AnalyticsPanel() {
  return (
    <div className="space-y-3 h-full">
      {/* Revenue trend */}
      <div className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm p-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-xs font-bold text-[#2A3E4B]">Revenue Trend</p>
          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
            <TrendingUp className="size-3" /> +34% MoM
          </span>
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={REVENUE_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <defs>
                <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={B.accent} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={B.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A3E4B12" vertical={false} />
              <XAxis dataKey="month" fontSize={9} tickLine={false} axisLine={false} stroke="#4a5b78" />
              <YAxis fontSize={9} tickLine={false} axisLine={false} stroke="#4a5b78" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #2A3E4B20", fontSize: 11 }}
                formatter={(v: number) => [`Rs.${v.toLocaleString()}`, "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke={B.accent} strokeWidth={2} fill="url(#revGrad2)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Customer growth */}
      <div className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm p-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-xs font-bold text-[#2A3E4B]">Customer Growth</p>
          <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-0.5">
            <ArrowUpRight className="size-3" /> 1,240 total
          </span>
        </div>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={CUSTOMER_GROWTH} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <defs>
                <linearGradient id="custGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A3E4B12" vertical={false} />
              <XAxis dataKey="month" fontSize={9} tickLine={false} axisLine={false} stroke="#4a5b78" />
              <YAxis fontSize={9} tickLine={false} axisLine={false} stroke="#4a5b78" />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #2A3E4B20", fontSize: 11 }} />
              <Area type="monotone" dataKey="customers" stroke="#3b82f6" strokeWidth={2} fill="url(#custGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Reward claims */}
      <div className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm p-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-xs font-bold text-[#2A3E4B]">Reward Claims</p>
          <span className="text-[10px] text-[#4a5b78]">Last 6 weeks</span>
        </div>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={REWARD_CLAIMS} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A3E4B12" vertical={false} />
              <XAxis dataKey="week" fontSize={9} tickLine={false} axisLine={false} stroke="#4a5b78" />
              <YAxis fontSize={9} tickLine={false} axisLine={false} stroke="#4a5b78" />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #2A3E4B20", fontSize: 11 }} />
              <Bar dataKey="claims" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Panel: Messages ──────────────────────────────────────────
function MessagesPanel() {
  return (
    <div className="space-y-3 h-full">
      {/* Compose */}
      <div className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm p-4">
        <p className="text-xs font-bold text-[#2A3E4B] mb-3">Broadcast Message</p>

        {/* Audience selector */}
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[#4a5b78] mb-1.5">Audience</p>
          <div className="flex flex-wrap gap-1.5">
            {["All Customers", "Gold Members", "Silver Members", "Recent Winners"].map((a, i) => (
              <button
                key={a}
                type="button"
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  i === 0
                    ? "bg-[#2A3E4B] text-white border-[#2A3E4B]"
                    : "bg-white text-[#4a5b78] border-[#2A3E4B]/15 hover:border-[#2A3E4B]/30"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Message box */}
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[#4a5b78] mb-1.5">Message</p>
          <div className="rounded-lg border border-[#2A3E4B]/15 p-2.5 bg-[#F7FBFD] text-xs text-[#2A3E4B] min-h-[60px] select-none" style={{ fontFamily: "var(--font-sans)" }}>
            🎉 Hey! You've got a special reward waiting. Spin again at our shop to claim your exclusive prize this week only. Don't miss out!
          </div>
        </div>

        {/* Send */}
        <button
          type="button"
          className="w-full py-2.5 rounded-lg text-white text-xs font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style={{ background: `linear-gradient(135deg, ${B.dark}, ${B.mid})` }}
        >
          <Send className="size-3.5" />
          Send to All Customers (1,240)
        </button>
      </div>

      {/* Sent history */}
      <div className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm p-4">
        <p className="text-xs font-bold text-[#2A3E4B] mb-2.5">Recent Broadcasts</p>
        <ul className="space-y-2.5">
          {[
            { msg: "Weekend spin special — come claim your prize!", audience: "All Customers", sent: "2 days ago", reached: 1240 },
            { msg: "Gold member exclusive: double rewards this week!", audience: "Gold Members", sent: "5 days ago", reached: 312 },
            { msg: "New campaign is live — scan your QR to spin!", audience: "All Customers", sent: "1 week ago", reached: 980 },
          ].map((b) => (
            <li key={b.msg} className="text-[11px] border-b border-[#2A3E4B]/6 pb-2.5 last:border-0 last:pb-0">
              <p className="font-semibold text-[#2A3E4B] truncate">{b.msg}</p>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[#4a5b78]">{b.audience} · {b.sent}</span>
                <span className="font-bold text-[#FF6B00]">{b.reached.toLocaleString()} reached</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Panel: Settings ──────────────────────────────────────────
function SettingsPanel() {
  const sections = [
    {
      icon: <Building2 className="size-4" />,
      label: "Business Profile",
      accent: "bg-blue-50 text-blue-600",
      fields: [
        { name: "Shop Name", value: "Anisha's Boutique" },
        { name: "Slug", value: "anishas-boutique" },
        { name: "WhatsApp", value: "+977 9801234567" },
      ],
    },
    {
      icon: <Bell className="size-4" />,
      label: "Notifications",
      accent: "bg-violet-50 text-violet-600",
      toggles: [
        { name: "New spin alerts", on: true },
        { name: "Weekly digest", on: true },
        { name: "Low reward stock", on: false },
      ],
    },
    {
      icon: <Palette className="size-4" />,
      label: "Branding",
      accent: "bg-orange-50 text-[#FF6B00]",
      fields: [
        { name: "Primary Color", value: "#2A3E4B" },
        { name: "Accent Color", value: "#FF6B00" },
      ],
    },
    {
      icon: <Shield className="size-4" />,
      label: "Security",
      accent: "bg-emerald-50 text-emerald-600",
      toggles: [
        { name: "Two-factor auth", on: true },
        { name: "Login alerts", on: true },
      ],
    },
  ];

  return (
    <div className="space-y-3 h-full">
      {sections.map((s) => (
        <div key={s.label} className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm p-3.5">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-7 h-7 rounded-lg grid place-items-center ${s.accent}`}>
              {s.icon}
            </div>
            <p className="text-xs font-bold text-[#2A3E4B]">{s.label}</p>
          </div>

          {"fields" in s && s.fields && (
            <div className="space-y-2">
              {s.fields.map((f) => (
                <div key={f.name} className="flex items-center justify-between">
                  <span className="text-[10px] text-[#4a5b78] font-medium">{f.name}</span>
                  <span className="text-[10px] font-semibold text-[#2A3E4B] bg-[#F4F6FA] px-2 py-0.5 rounded">
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {"toggles" in s && s.toggles && (
            <div className="space-y-2">
              {s.toggles.map((t) => (
                <div key={t.name} className="flex items-center justify-between">
                  <span className="text-[10px] text-[#4a5b78] font-medium">{t.name}</span>
                  <div className={`w-8 h-4 rounded-full flex items-center transition-colors ${t.on ? "bg-[#2A3E4B]" : "bg-[#D6E6EF]"}`}>
                    <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform mx-0.5 ${t.on ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Panel map ────────────────────────────────────────────────
const PANELS: Record<TabKey, React.ReactNode> = {
  dashboard: <DashboardPanel />,
  campaigns: <CampaignsPanel />,
  customers: <CustomersPanel />,
  analytics: <AnalyticsPanel />,
  messages: <MessagesPanel />,
  settings: <SettingsPanel />,
};

// ─── Main export ──────────────────────────────────────────────
export const DashboardPreview = memo(function DashboardPreview() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  return (
    <SectionContainer
      as="section"
      id="dashboard-preview"
      maxWidth="xl"
      spacing="none"
      className="py-20 lg:py-28"
      aria-labelledby="dashboard-preview-heading"
    >
      {/* Section header */}
      <div className="max-w-2xl mx-auto text-center mb-12">
        <span
          className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full mb-4"
          style={{ background: B.light, color: B.dark }}
        >
          Dashboard
        </span>
        <h2
          id="dashboard-preview-heading"
          className="font-display text-3xl md:text-4xl font-bold leading-tight"
          style={{ color: B.dark }}
        >
          Manage Everything From One Beautiful Dashboard
        </h2>
        <p className="mt-4 text-base md:text-lg" style={{ color: `${B.dark}cc` }}>
          Track campaigns, customers, rewards, and business growth from a single, intuitive dashboard.
        </p>
      </div>

      {/* Chrome shell */}
      <FoundationCard
        elevation="lg"
        padding="none"
        className="overflow-hidden border border-[#2A3E4B]/10"
        style={{ boxShadow: "0 32px 80px -20px rgba(42,62,75,0.18), 0 0 0 1px rgba(42,62,75,0.06)" }}
      >
        {/* Browser bar */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b border-[#2A3E4B]/8"
          style={{ background: "#F0F4F8" }}
        >
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 mx-3 max-w-xs">
            <div className="bg-white rounded-md px-3 py-1 text-[10px] text-[#4a5b78] font-medium flex items-center gap-1.5 border border-[#2A3E4B]/8">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              app.mysteryunlock.com/dashboard
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 ml-auto">
            <Star className="size-3 text-[#4a5b78]" />
            <Trophy className="size-3 text-[#4a5b78]" />
          </div>
        </div>

        {/* Mobile tabs (sm and below) */}
        <div
          role="tablist"
          aria-label="Dashboard sections"
          className="flex lg:hidden overflow-x-auto border-b border-[#2A3E4B]/8 scrollbar-none"
          style={{ background: B.bg }}
        >
          {NAV_ITEMS.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              aria-controls={`tabpanel-${key}`}
              id={`tab-mobile-${key}`}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-3 min-h-[44px] text-[11px] font-semibold whitespace-nowrap transition-colors border-b-2 shrink-0 ${
                activeTab === key
                  ? "text-[#2A3E4B] border-[#FF6B00]"
                  : "text-[#4a5b78] border-transparent hover:text-[#2A3E4B]"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Desktop layout */}
        <div className="flex min-h-[520px]" style={{ background: B.bg }}>
          {/* Sidebar */}
          <aside
            className="hidden lg:flex flex-col w-48 shrink-0 border-r border-[#2A3E4B]/8 py-4"
            style={{ background: "#ffffff" }}
          >
            {/* Brand mark in sidebar */}
            <div className="px-4 mb-5 flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black"
                style={{ background: `linear-gradient(135deg, ${B.dark}, ${B.mid})` }}
              >
                M
              </div>
              <span className="text-xs font-bold text-[#2A3E4B]">Mystery Unlock</span>
            </div>

            <nav
              role="tablist"
              aria-label="Dashboard sections"
              aria-orientation="vertical"
              className="flex flex-col gap-0.5 px-2 flex-1"
            >
              {NAV_ITEMS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === key}
                  aria-controls={`tabpanel-${key}`}
                  id={`tab-desktop-${key}`}
                  onClick={() => setActiveTab(key)}
                  className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all w-full ${
                    activeTab === key
                      ? "text-[#2A3E4B] bg-[#D6E6EF]/60"
                      : "text-[#4a5b78] hover:text-[#2A3E4B] hover:bg-[#F4F6FA]"
                  }`}
                >
                  <span className={`transition-colors ${activeTab === key ? "text-[#FF6B00]" : "text-[#4a5b78] group-hover:text-[#2A3E4B]"}`}>
                    {icon}
                  </span>
                  {label}
                  {activeTab === key && (
                    <ChevronRight className="size-3 ml-auto text-[#FF6B00]" />
                  )}
                </button>
              ))}
            </nav>

            {/* Pro badge at bottom */}
            <div className="px-3 mt-4">
              <div
                className="rounded-xl p-3 text-white text-[10px]"
                style={{ background: `linear-gradient(135deg, ${B.dark}, ${B.mid})` }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Check className="size-3" />
                  <span className="font-bold">Growth Plan</span>
                </div>
                <p className="opacity-80 leading-tight">10,000 spins / mo</p>
              </div>
            </div>
          </aside>

          {/* Content panel — div not main to avoid duplicate landmark */}
          <div
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-desktop-${activeTab}`}
            className="flex-1 min-w-0 p-4 overflow-y-auto"
            style={{ maxHeight: 560 }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#2A3E4B]">
                  {NAV_ITEMS.find((n) => n.key === activeTab)?.label}
                </h3>
                <p className="text-[10px] text-[#4a5b78] mt-0.5">
                  {activeTab === "dashboard" && "Welcome back, Anisha"}
                  {activeTab === "campaigns" && "3 campaigns total · 2 active"}
                  {activeTab === "customers" && "1,240 total customers"}
                  {activeTab === "analytics" && "Last 7 months of data"}
                  {activeTab === "messages" && "Reach customers directly"}
                  {activeTab === "settings" && "Manage your account"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#D6E6EF] grid place-items-center text-[10px] font-black text-[#2A3E4B]">
                  A
                </div>
              </div>
            </div>

            {/* Animated panel swap */}
            <div key={activeTab} className="animate-fade-in">
              {PANELS[activeTab]}
            </div>
          </div>
        </div>
      </FoundationCard>

      {/* CTA nudge below */}
      <p className="mt-6 text-center text-sm" style={{ color: `${B.dark}99` }}>
        This is a live preview.{" "}
        <a href="/auth" className="font-semibold underline underline-offset-2" style={{ color: B.accent }}>
          Start free
        </a>{" "}
        to access your real dashboard.
      </p>
    </SectionContainer>
  );
});

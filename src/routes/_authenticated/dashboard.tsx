import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard, Megaphone, Users, BarChart3, Settings as SettingsIcon,
  Pencil, Gift, QrCode, UserSquare2, LogOut, ExternalLink, Shield, MessageSquare,
  TrendingUp, Trophy, Activity, Sparkles, ChevronRight, ChevronLeft,
  CircleDot, Calendar, Ticket, Hash, PlayCircle, Power,
  Search, Download, Trash2, X, Phone, Mail, Award, CheckCircle2, XCircle, ArrowUpDown, Loader2,
  Building2, ShieldCheck, Bell, CreditCard, Plug, LifeBuoy, Moon, Sun, KeyRound, Globe, Upload,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { SpinWheel } from "@/components/SpinWheel";
import { rowToPrize } from "@/lib/spin-store";
import { InstallAppButton } from "@/components/InstallAppButton";
import { supabase } from "@/integrations/supabase/client";
import { listMyShops, updateMyShop, createShop, bootstrapSuperAdmin, getMySubscription } from "@/lib/shops.functions";
import {
  listMyPrizes,
  upsertPrize,
  deletePrize,
  updateProbabilities,
} from "@/lib/prizes.functions";
import {
  generateAccessCodes,
  listAccessCodes,
  deleteUnusedCodes,
  listSpinRecords,
  deleteSpinRecord,
  resetSpinRecords,
} from "@/lib/access-codes.functions";
import { listMyCampaigns } from "@/lib/campaigns.functions";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { QRCodeSVG } from "qrcode.react";
import { MessagingTab } from "@/components/MessagingTab";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Mystery Unlock" }] }),
  component: Dashboard,
});

type Shop = {
  id: string;
  owner_user_id: string | null;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
};

type Prize = {
  id: string;
  name: string;
  short: string;
  image_url: string;
  is_win: boolean;
  probability: number;
  sort_order: number;
};

type CodeRow = {
  code: string;
  is_used: boolean;
  spun_at: string | null;
  prize_won: string | null;
  customer_name: string | null;
  created_at: string;
};

type TabKey =
  | "overview" | "campaign" | "customers" | "analytics" | "settings"
  | "codes" | "qr" | "messages";

const slugRe = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const autoSlug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function TabMount({ active, children }: { active: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(active);
  useEffect(() => { if (active) setMounted(true); }, [active]);
  if (!mounted) return null;
  return <div style={{ display: active ? undefined : "none" }}>{children}</div>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const navigate = useNavigate();
  const fetchMyShops = useServerFn(listMyShops);
  const doCreateShop = useServerFn(createShop);
  const doUpdateShop = useServerFn(updateMyShop);
  const doBootstrap = useServerFn(bootstrapSuperAdmin);

  const [shop, setShop] = useState<Shop | null>(null);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [ownerName, setOwnerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");

  const loadShop = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyShops();
      setSuperAdmin(res.superAdmin);
      const list = res.shops as Shop[];
      setShop(list[0] ?? null);
    } finally {
      setLoading(false);
    }
  }, [fetchMyShops]);

  useEffect(() => { loadShop(); }, [loadShop]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const meta = (u?.user_metadata ?? {}) as Record<string, unknown>;
      const name = (meta.full_name as string) || (meta.name as string) || u?.email?.split("@")[0] || "";
      setOwnerName(name);
    });
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!shop) {
    return <CreateShopForm onCreated={loadShop} onSignOut={signOut} doCreate={doCreateShop} />;
  }

  const navItems: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
    { key: "overview", label: "Dashboard", icon: LayoutDashboard },
    { key: "campaign", label: "Campaign", icon: Megaphone },
    { key: "customers", label: "Customers", icon: Users },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-white pb-28">
      <div className="px-4 sm:px-6 pt-5 max-w-5xl mx-auto">
        {/* Top: greeting + actions */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-sm text-[#4a5b78]">
              {greeting()}{ownerName ? `, ${ownerName}` : ""} <span aria-hidden>👋</span>
            </p>
            <h1 className="truncate text-xl sm:text-2xl font-black text-[#0c2340] mt-0.5">{shop.name}</h1>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${shop.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${shop.is_active ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                {shop.is_active ? "Campaign Active" : "Paused"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <img src={shop.logo_url || DEFAULT_LOGO} alt="" className="w-11 h-11 rounded-2xl object-cover border border-[#0c2340]/10 shadow-sm" />
            <div className="flex gap-1.5">
              <Link to="/campaigns" className="p-2 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5] text-[#0c2340]" title="Manage campaigns">
                <Megaphone className="w-4 h-4" />
              </Link>
              {superAdmin && (
                <Link to="/super-admin" className="p-2 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5] text-[#0c2340]" title="Super admin">
                  <Shield className="w-4 h-4" />
                </Link>
              )}
              <button onClick={signOut} className="p-2 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5] text-[#0c2340]" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

        </header>

        <SubscriptionBanner />

        <TabMount active={tab === "overview"}>
          <OverviewTab shop={shop} onNavigate={setTab} />
        </TabMount>
        <TabMount active={tab === "campaign"}><CampaignHub shop={shop} onSaved={loadShop} doUpdate={doUpdateShop} superAdmin={superAdmin} doBootstrap={doBootstrap} /></TabMount>
        <TabMount active={tab === "customers"}><RecordsTab shop={shop} /></TabMount>
        <TabMount active={tab === "analytics"}><StatsTab shop={shop} /></TabMount>
        <TabMount active={tab === "settings"}>
          <SettingsTab shop={shop} onSaved={loadShop} doUpdate={doUpdateShop} superAdmin={superAdmin} doBootstrap={doBootstrap} onSignOut={signOut} />
        </TabMount>

        {/* Secondary tabs (reached via quick actions) */}
        <TabMount active={tab === "codes"}>
          <SecondaryHeader title="Access Codes" onBack={() => setTab("overview")} />
          <CodesTab shop={shop} />
        </TabMount>
        <TabMount active={tab === "qr"}>
          <SecondaryHeader title="QR Codes" onBack={() => setTab("overview")} />
          <QrTab shop={shop} />
        </TabMount>
        <TabMount active={tab === "messages"}>
          <SecondaryHeader title="Messages" onBack={() => setTab("overview")} />
          <MessagingTab shop={shop} />
        </TabMount>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-[#0c2340]/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-5xl mx-auto grid grid-cols-5">
          {navItems.map(({ key, label, icon: Icon }) => {
            const active = tab === key || (key === "overview" && (tab === "codes" || tab === "qr" || tab === "messages"));
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors ${active ? "text-[#FF6B00]" : "text-[#4a5b78] hover:text-[#0c2340]"}`}
              >
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.4]" : ""}`} />
                <span>{label}</span>
                {active && <span className="absolute bottom-0 w-8 h-0.5 rounded-full bg-[#FF6B00] mt-0.5" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SecondaryHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <button onClick={onBack} className="text-sm px-2.5 py-1.5 rounded-lg bg-[#F5F7FA] text-[#0c2340] hover:bg-[#ECEFF5]">← Back</button>
      <h2 className="text-lg font-black text-[#0c2340]">{title}</h2>
    </div>
  );
}

// ---------- OVERVIEW ----------
function OverviewTab({ shop, onNavigate }: { shop: Shop; onNavigate: (t: TabKey) => void }) {
  const fetchRecords = useServerFn(listSpinRecords);
  const fetchCodes = useServerFn(listAccessCodes);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [codes, setCodes] = useState<CodeRow[]>([]);

  useEffect(() => {
    fetchRecords({ data: { shopId: shop.id } }).then((r) => setRows((r.rows as RecordRow[]) ?? []));
    fetchCodes({ data: { shopId: shop.id } }).then((r) => setCodes((r.rows as CodeRow[]) ?? []));
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

function CreateShopForm({ onCreated, onSignOut, doCreate }: { onCreated: () => void; onSignOut: () => void; doCreate: ReturnType<typeof useServerFn<typeof createShop>> }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const desired = slug || autoSlug(name);
      if (!name.trim()) throw new Error("Shop name is required");
      if (!slugRe.test(desired)) throw new Error("Invalid URL slug");
      await doCreate({ data: { name: name.trim(), slug: desired } });
      onCreated();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed to create shop");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={submit} className="glass rounded-2xl p-6 w-full max-w-sm space-y-3">
        <p className="text-xs uppercase tracking-widest text-gold">Create your shop</p>
        <input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)); }} placeholder="Shop name" className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-4 py-3 outline-none focus:border-primary" />
        <div className="flex items-center bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-4 py-3">
          <span className="text-muted-foreground text-sm mr-1">/s/</span>
          <input value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} placeholder="my-shop" className="flex-1 bg-transparent outline-none" />
        </div>
        {err && <p className="text-destructive text-sm">{err}</p>}
        <button disabled={busy} className="w-full gradient-primary text-white font-bold py-3 rounded-xl disabled:opacity-60">
          {busy ? "Creating..." : "Create shop"}
        </button>
        <button type="button" onClick={onSignOut} className="w-full text-xs text-muted-foreground">Sign out</button>
      </form>
    </div>
  );
}

// ---------- SETTINGS ----------
function SettingsSection({ icon: Icon, title, subtitle, accent = "#FF6B00", children }: { icon: typeof SettingsIcon; title: string; subtitle?: string; accent?: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(12,35,64,0.06)] border border-[#0c2340]/5 overflow-hidden">
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accent}14`, color: accent }}>
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-[#0c2340] leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-[#6b7a93] mt-0.5">{subtitle}</p>}
        </div>
      </header>
      <div className="px-5 pb-5 space-y-3">{children}</div>
    </section>
  );
}

function SettingsRow({ icon: Icon, label, hint, right, onClick, danger }: { icon: typeof SettingsIcon; label: string; hint?: string; right?: ReactNode; onClick?: () => void; danger?: boolean }) {
  const Cmp = onClick ? "button" : "div";
  return (
    <Cmp
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${onClick ? "hover:bg-[#F5F7FA] active:bg-[#ECEFF5]" : ""} ${danger ? "text-[#b3261e]" : "text-[#0c2340]"}`}
    >
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${danger ? "bg-[#fde8e6]" : "bg-[#F5F7FA]"}`}>
        <Icon className={`w-4 h-4 ${danger ? "text-[#b3261e]" : "text-[#4a5b78]"}`} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        {hint && <p className="text-[11px] text-[#6b7a93] mt-0.5 truncate">{hint}</p>}
      </div>
      {right ?? (onClick && <ChevronRight className="w-4 h-4 text-[#6b7a93]" />)}
    </Cmp>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`relative w-11 h-6 rounded-full transition ${checked ? "bg-[#FF6B00]" : "bg-[#d6dbe5]"}`}
      aria-pressed={checked}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

function SettingsTab({ shop, onSaved, doUpdate, superAdmin, doBootstrap, onSignOut }: { shop: Shop; onSaved: () => void; doUpdate: ReturnType<typeof useServerFn<typeof updateMyShop>>; superAdmin: boolean; doBootstrap: ReturnType<typeof useServerFn<typeof bootstrapSuperAdmin>>; onSignOut: () => void | Promise<void> }) {
  const [name, setName] = useState(shop.name);
  const [slug, setSlug] = useState(shop.slug);
  const [logoUrl, setLogoUrl] = useState<string | null>(shop.logo_url);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [bootstrapPw, setBootstrapPw] = useState("");
  const [bootstrapMsg, setBootstrapMsg] = useState("");
  const [showAdminUnlock, setShowAdminUnlock] = useState(false);

  // Preferences (persisted locally)
  const [darkMode, setDarkMode] = useState<boolean>(() => typeof window !== "undefined" && localStorage.getItem("pref:darkMode") === "1");
  const [emailNotif, setEmailNotif] = useState<boolean>(() => typeof window !== "undefined" && localStorage.getItem("pref:emailNotif") !== "0");
  const [smsNotif, setSmsNotif] = useState<boolean>(() => typeof window !== "undefined" && localStorage.getItem("pref:smsNotif") === "1");
  const [language, setLanguage] = useState<string>(() => (typeof window !== "undefined" && localStorage.getItem("pref:lang")) || "en");

  // Change-password mini form
  const [showPwForm, setShowPwForm] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("pref:darkMode", darkMode ? "1" : "0"); }, [darkMode]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("pref:emailNotif", emailNotif ? "1" : "0"); }, [emailNotif]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("pref:smsNotif", smsNotif ? "1" : "0"); }, [smsNotif]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("pref:lang", language); }, [language]);

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setErr("Logo must be under 10 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.readAsDataURL(f);
  };

  const save = async () => {
    setErr(""); setMsg(""); setBusy(true);
    try {
      const patch: { id: string; name?: string; slug?: string; logo_url?: string | null } = { id: shop.id };
      if (name !== shop.name) patch.name = name.trim();
      if (slug !== shop.slug) {
        if (!slugRe.test(slug)) throw new Error("Slug can only contain lowercase letters, numbers and dashes");
        patch.slug = slug;
      }
      if (logoUrl !== shop.logo_url) patch.logo_url = logoUrl;
      await doUpdate({ data: patch });
      setMsg("Saved.");
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Save failed");
    } finally { setBusy(false); }
  };

  const tryBootstrap = async () => {
    setBootstrapMsg("");
    try {
      await doBootstrap({ data: { password: bootstrapPw } });
      setBootstrapMsg("You are now a super admin. Refresh to see the link.");
    } catch (e) {
      setBootstrapMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  const changePassword = async () => {
    setPwMsg("");
    if (!oldPw) { setPwMsg("Please enter your current password."); return; }
    if (newPw.length < 8) { setPwMsg("New password must be at least 8 characters."); return; }
    if (!/[a-zA-Z]/.test(newPw)) { setPwMsg("New password must contain at least one letter."); return; }
    if (!/[0-9]/.test(newPw)) { setPwMsg("New password must contain at least one number."); return; }
    if (oldPw === newPw) { setPwMsg("New password must be different from your current password."); return; }
    // Verify old password first
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: oldPw });
    if (authErr) { setPwMsg("Current password is incorrect."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) { setPwMsg(error.message); return; }
    setPwMsg("Password updated successfully.");
    setOldPw("");
    setNewPw("");
    setTimeout(() => { setShowPwForm(false); setPwMsg(""); }, 1800);
  };

  const requestDelete = () => {
    if (!confirm("Delete your account? This will sign you out and email our team to permanently remove your data within 30 days.")) return;
    const subject = encodeURIComponent(`Account deletion request — ${shop.name}`);
    const body = encodeURIComponent(`Please delete the account for ${email} (shop: ${shop.name}, id: ${shop.id}).`);
    window.location.href = `mailto:support@mysteryunlock.com?subject=${subject}&body=${body}`;
  };

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/s/${shop.slug}` : `/s/${shop.slug}`;
  const inputCls = "w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/15 transition";

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Business Profile */}
      <SettingsSection icon={Building2} title="Business Profile" subtitle="How your shop appears to customers">
        <div className="flex items-center gap-4">
          <img src={logoUrl || DEFAULT_LOGO} alt="" className="w-16 h-16 rounded-2xl object-cover border border-[#0c2340]/10 shadow-sm" />
          <div className="flex flex-col gap-1.5">
            <label className="cursor-pointer text-xs font-semibold px-3 py-2 rounded-lg bg-[#FF6B00] text-white inline-flex items-center gap-1.5 hover:opacity-90">
              <Upload className="w-3.5 h-3.5" /> Upload logo
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
            {logoUrl && <button onClick={() => setLogoUrl(null)} className="text-[11px] text-[#6b7a93] text-left">Remove logo</button>}
            <p className="text-[11px] text-[#6b7a93]">PNG/JPG, up to 10 MB.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-[#6b7a93] font-semibold">Shop name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputCls} />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-[#6b7a93] font-semibold">Public URL</label>
          <div className="flex items-center bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 focus-within:border-[#FF6B00]">
            <span className="text-[#6b7a93] text-sm mr-1">/s/</span>
            <input value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} maxLength={40} className="flex-1 bg-transparent text-[#0c2340] outline-none" />
          </div>
          <p className="text-[11px] text-[#6b7a93] break-all">{publicUrl}</p>
        </div>

        {err && <p className="text-[#b3261e] text-sm">{err}</p>}
        {msg && <p className="text-sm text-emerald-600 font-semibold">{msg}</p>}
        <button onClick={save} disabled={busy} className="w-full bg-[#FF6B00] hover:bg-[#e85f00] text-white font-bold py-3 rounded-xl disabled:opacity-60 transition shadow-sm">
          {busy ? "Saving..." : "Save changes"}
        </button>
      </SettingsSection>

      {/* Account & Security */}
      <SettingsSection icon={ShieldCheck} title="Account & Security" subtitle="Email, password, and access" accent="#2563eb">
        <SettingsRow icon={Mail} label="Email" hint={email || "—"} />
        <SettingsRow icon={KeyRound} label="Change password" hint="Update your sign-in password" onClick={() => { setShowPwForm((v) => !v); setOldPw(""); setNewPw(""); setPwMsg(""); }} />
        {showPwForm && (
          <div className="space-y-2 pl-1">
            <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="Current password" className={inputCls} />
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password (min 8 chars + number)" className={inputCls} />
            {pwMsg && <p className={`text-xs ${pwMsg.includes("successfully") ? "text-emerald-600" : "text-[#b3261e]"}`}>{pwMsg}</p>}
            <div className="flex gap-2">
              <button onClick={changePassword} className="flex-1 bg-[#FF6B00] text-white font-semibold py-2 rounded-lg text-sm">Update password</button>
              <button onClick={() => { setShowPwForm(false); setOldPw(""); setNewPw(""); setPwMsg(""); }} className="px-3 py-2 rounded-lg bg-[#F5F7FA] text-sm">Cancel</button>
            </div>
          </div>
        )}
        {superAdmin && (
          <SettingsRow icon={Shield} label="Super admin panel" hint="Manage platform & subscriptions" onClick={() => { window.location.href = "/super-admin"; }} />
        )}
      </SettingsSection>

      {/* Campaign Defaults */}
      <SettingsSection icon={Megaphone} title="Campaign Defaults" subtitle="Prizes, wheel, codes & rules" accent="#9333ea">
        <SettingsRow icon={Gift} label="Manage prizes & odds" onClick={() => { window.location.hash = ""; const el = document.querySelector('[data-tab="campaign"]') as HTMLElement | null; el?.click(); }} />
        <SettingsRow icon={CircleDot} label="Spin wheel preview" hint="Open the Campaign Hub" />
        <SettingsRow icon={QrCode} label="QR & access codes" hint="Generate, download, print" />
        <SettingsRow icon={ExternalLink} label="View public page" hint={`/s/${shop.slug}`} onClick={() => window.open(publicUrl, "_blank")} />
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection icon={Bell} title="Notifications" subtitle="Choose how we reach you" accent="#0891b2">
        <SettingsRow icon={Mail} label="Email notifications" hint="Activity & weekly summary" right={<Toggle checked={emailNotif} onChange={setEmailNotif} />} />
        <SettingsRow icon={Phone} label="SMS alerts" hint="Important account events" right={<Toggle checked={smsNotif} onChange={setSmsNotif} />} />
      </SettingsSection>

      {/* Subscription & Billing */}
      <SettingsSection icon={CreditCard} title="Subscription & Billing" subtitle="Plan, renewal and invoices" accent="#16a34a">
        <SettingsRow icon={Sparkles} label="Current plan" hint={shop.is_active ? "Active" : "Inactive"} right={<span className={`text-[11px] font-bold px-2 py-1 rounded-full ${shop.is_active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{shop.is_active ? "ACTIVE" : "PAUSED"}</span>} />
        <SettingsRow icon={CreditCard} label="Billing & plans" hint="View plans, renewal & invoices" onClick={() => { window.location.href = "/billing"; }} />
        <SettingsRow icon={MessageSquare} label="Renew or upgrade" hint="Chat with us on WhatsApp" onClick={() => window.open("https://wa.me/9779769402069?text=I%20want%20to%20renew%20my%20Mystery Unlock%20subscription", "_blank")} />
      </SettingsSection>

      {/* Integrations */}
      <SettingsSection icon={Plug} title="Integrations" subtitle="Connect external tools" accent="#db2777">
        <SettingsRow icon={MessageSquare} label="WhatsApp messaging" hint="Send winner messages" right={<span className="text-[11px] font-bold text-emerald-600">CONNECTED</span>} />
        <SettingsRow icon={Mail} label="Email sender" hint="Bulk customer emails" right={<span className="text-[11px] font-bold text-emerald-600">CONNECTED</span>} />
        <InstallAppButton variant="outline" size="sm" />
      </SettingsSection>

      {/* Preferences */}
      <SettingsSection icon={SettingsIcon} title="Preferences" subtitle="Personalize your experience" accent="#475569">
        <SettingsRow icon={darkMode ? Moon : Sun} label="Dark mode" hint="Switch to a darker theme" right={<Toggle checked={darkMode} onChange={setDarkMode} />} />
        <SettingsRow icon={Globe} label="Language" right={
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-[#F5F7FA] border border-[#0c2340]/10 rounded-lg px-2 py-1.5 text-sm text-[#0c2340] outline-none">
            <option value="en">English</option>
            <option value="ne">नेपाली</option>
            <option value="hi">हिन्दी</option>
          </select>
        } />
      </SettingsSection>

      {/* Support */}
      <SettingsSection icon={LifeBuoy} title="Support" subtitle="We're here to help" accent="#0ea5e9">
        <SettingsRow icon={MessageSquare} label="WhatsApp support" hint="+977 9769402069" onClick={() => window.open("https://wa.me/9779769402069", "_blank")} />
        <SettingsRow icon={Mail} label="Email support" hint="support@mysteryunlock.com" onClick={() => { window.location.href = "mailto:support@mysteryunlock.com"; }} />
      </SettingsSection>

      {/* Danger Zone */}
      <SettingsSection icon={LogOut} title="Account Actions" accent="#b3261e">
        <SettingsRow icon={LogOut} label="Sign out" hint="End this session" onClick={() => onSignOut()} />
        <SettingsRow icon={Trash2} label="Delete account" hint="Permanently remove your data" onClick={requestDelete} danger />
      </SettingsSection>

      <p className="text-center text-[11px] text-[#6b7a93] pt-2 pb-1">Mystery Unlock · v1.0</p>
    </div>
  );
}

// ---------- PRIZES ----------
function PrizesTab({ shop, campaignId }: { shop: Shop; campaignId?: string | null }) {
  const fetchPrizes = useServerFn(listMyPrizes);
  const doUpsert = useServerFn(upsertPrize);
  const doDelete = useServerFn(deletePrize);
  const doProbs = useServerFn(updateProbabilities);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [editing, setEditing] = useState<Prize | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchPrizes({ data: { shopId: shop.id, ...(campaignId ? { campaignId } : {}) } });
    setPrizes(res.prizes as Prize[]);
  }, [fetchPrizes, shop.id, campaignId]);
  useEffect(() => { load(); }, [load]);

  const newPrize = (): Prize => ({
    id: `prize-${Date.now().toString(36)}`,
    name: "",
    short: "",
    image_url: "",
    is_win: true,
    probability: 10,
    sort_order: prizes.length,
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.short || !editing.image_url) return alert("Fill name, short label, and image.");
    setBusy(true);
    try {
      await doUpsert({ data: { shopId: shop.id, prize: editing, ...(campaignId ? { campaignId } : {}) } });
      setEditing(null);
      load();
    } finally { setBusy(false); }
  };


  const remove = async (id: string) => {
    if (!confirm("Delete this prize?")) return;
    await doDelete({ data: { shopId: shop.id, id } });
    load();
  };

  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !editing) return;
    if (f.size > 10 * 1024 * 1024) return alert("Image must be under 10 MB.");
    const r = new FileReader();
    r.onload = () => setEditing({ ...editing, image_url: r.result as string });
    r.readAsDataURL(f);
  };

  const updateProb = async (id: string, v: number) => {
    setPrizes((ps) => ps.map((p) => (p.id === id ? { ...p, probability: v } : p)));
  };
  const saveProbs = async () => {
    await doProbs({ data: { shopId: shop.id, probs: prizes.map((p) => ({ id: p.id, probability: p.probability })) } });
    alert("Odds saved.");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{prizes.length} prizes</p>
        <button onClick={() => setEditing(newPrize())} className="px-3 py-2 rounded-lg bg-primary text-white font-bold text-sm">+ Add prize</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {prizes.map((p) => (
          <div key={p.id} className="glass rounded-xl p-3 flex gap-3 items-center">
            <img src={p.image_url} alt="" className="w-14 h-14 rounded-lg object-cover bg-[#F5F7FA] text-[#0c2340]" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.is_win ? "Win" : "Try again"} · weight {p.probability}</p>
              <input type="range" min={0} max={100} value={p.probability} onChange={(e) => updateProb(p.id, parseInt(e.target.value))} className="w-full mt-1" />
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => setEditing(p)} className="text-xs px-2 py-1 rounded bg-white/5">Edit</button>
              <button onClick={() => remove(p.id)} className="text-xs px-2 py-1 rounded bg-destructive/20 text-destructive">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {prizes.length > 0 && <button onClick={saveProbs} className="w-full py-2 rounded-lg bg-white/5 text-sm">Save odds</button>}

      {editing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-3">
          <div className="glass rounded-2xl p-4 w-full max-w-sm space-y-2">
            <p className="text-xs uppercase tracking-widest text-gold">{prizes.find((p) => p.id === editing.id) ? "Edit prize" : "New prize"}</p>
            <div className="flex items-center gap-3">
              <img src={editing.image_url || DEFAULT_LOGO} alt="" className="w-16 h-16 rounded-lg object-cover bg-[#F5F7FA] text-[#0c2340]" />
              <label className="text-sm px-3 py-2 rounded-lg bg-white/5 cursor-pointer">
                Upload image
                <input type="file" accept="image/*" onChange={onImage} className="hidden" />
              </label>
            </div>
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Prize name" maxLength={80} className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none" />
            <input value={editing.short} onChange={(e) => setEditing({ ...editing, short: e.target.value })} placeholder="Short label (for wheel)" maxLength={40} className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none" />
            <div className="flex items-center gap-2">
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={editing.is_win} onChange={(e) => setEditing({ ...editing, is_win: e.target.checked })} />
                Counts as win
              </label>
            </div>
            <div className="flex gap-2 text-sm">
              <label className="flex-1">
                Weight (odds)
                <input type="number" min={0} max={1000} value={editing.probability} onChange={(e) => setEditing({ ...editing, probability: parseInt(e.target.value || "0") })} className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none" />
              </label>
              <label className="flex-1">
                Sort order
                <input type="number" min={0} max={1000} value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value || "0") })} className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none" />
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-lg bg-white/5">Cancel</button>
              <button onClick={save} disabled={busy} className="flex-1 py-2 rounded-lg gradient-primary text-white font-bold disabled:opacity-60">{busy ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- CODES ----------
function CodesTab({ shop }: { shop: Shop }) {
  const fetchCodes = useServerFn(listAccessCodes);
  const doGen = useServerFn(generateAccessCodes);
  const doDelUnused = useServerFn(deleteUnusedCodes);
  const [rows, setRows] = useState<CodeRow[]>([]);
  const [count, setCount] = useState(10);
  const [filter, setFilter] = useState<"all" | "unused" | "used">("all");

  const load = useCallback(async () => {
    const res = await fetchCodes({ data: { shopId: shop.id } });
    setRows((res.rows as CodeRow[]) ?? []);
  }, [fetchCodes, shop.id]);
  useEffect(() => { load(); }, [load]);

  const gen = async () => {
    await doGen({ data: { shopId: shop.id, count } });
    load();
  };
  const delUnused = async () => {
    if (!confirm("Delete all unused codes?")) return;
    await doDelUnused({ data: { shopId: shop.id } });
    load();
  };

  const filtered = rows.filter((r) => filter === "all" ? true : filter === "unused" ? !r.is_used : r.is_used);

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-3 flex gap-2 items-center flex-wrap">
        <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(parseInt(e.target.value || "0"))} className="w-20 bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-2 py-2 outline-none" />
        <button onClick={gen} className="px-3 py-2 rounded-lg bg-primary text-white font-bold text-sm">Generate</button>
        <button onClick={delUnused} className="px-3 py-2 rounded-lg bg-destructive/20 text-destructive text-sm">Delete unused</button>
        <div className="ml-auto flex gap-1 text-xs">
          {(["all", "unused", "used"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-2 py-1 rounded ${filter === f ? "bg-primary text-white font-bold" : "bg-white/5"}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} codes</div>

      <div className="space-y-1 max-h-[60vh] overflow-y-auto">
        {filtered.map((r) => (
          <div key={r.code} className="glass rounded-lg px-3 py-2 flex items-center gap-3 text-sm">
            <span className="font-mono tracking-widest">{r.code}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${r.is_used ? "bg-destructive/30 text-destructive" : "bg-emerald-500/20 text-emerald-400"}`}>
              {r.is_used ? "used" : "unused"}
            </span>
            <span className="ml-auto text-xs text-muted-foreground truncate">
              {r.customer_name || ""}{r.prize_won ? ` · ${r.prize_won}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- CUSTOMERS ----------
type RecordRow = { code: string; spun_at: string | null; prize_won: string | null; customer_name: string | null; customer_contact: string | null; customer_email: string | null };
type FilterKey = "all" | "winners" | "nonwinners" | "today" | "week";
type SortKey = "latest" | "oldest" | "spins";

function isWinner(r: RecordRow) {
  const p = (r.prize_won || "").trim().toLowerCase();
  return !!p && p !== "try again" && p !== "tryagain" && p !== "no win";
}
function custKey(r: RecordRow) {
  return (r.customer_contact || r.customer_email || r.customer_name || r.code).toLowerCase();
}
function initials(name: string | null, fallback: string) {
  const s = (name || "").trim();
  if (!s) return fallback.slice(0, 1).toUpperCase();
  const parts = s.split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || s[0].toUpperCase();
}

async function exportRowsAsCsv(rows: RecordRow[], slug: string) {
  if (rows.length === 0) return alert("No records to export.");
  const headers = ["#", "Name", "Contact", "Email", "Code", "Prize", "Date", "Time"];
  const body: string[][] = [];
  rows.forEach((r, i) => {
    const d = r.spun_at ? new Date(r.spun_at) : null;
    body.push([
      String(i + 1),
      r.customer_name || "",
      r.customer_contact || "",
      r.customer_email || "",
      r.code || "",
      r.prize_won || "",
      d ? d.toLocaleDateString() : "",
      d ? d.toLocaleTimeString() : "",
    ]);
  });

  // Build an Excel-friendly HTML table. Saved as .xls so Excel, Numbers,
  // Google Sheets and most mobile viewers render it as a real spreadsheet
  // with proper rows and columns — much cleaner than raw CSV text.
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const thStyle = "background:#0c2340;color:#fff;font-weight:600;padding:8px 12px;border:1px solid #cbd5e1;text-align:left;font-family:Arial,sans-serif;font-size:12px;";
  const tdStyle = "padding:6px 12px;border:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:12px;color:#0c2340;";
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Customers</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table style="border-collapse:collapse;"><thead><tr>${headers.map((h) => `<th style="${thStyle}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td style="${tdStyle}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;

  const filename = `${slug}-customers-${new Date().toISOString().slice(0, 10)}.xls`;
  const mime = "application/vnd.ms-excel";
  const blob = new Blob(["\ufeff" + html], { type: `${mime};charset=utf-8;` });

  type SaveFilePicker = (opts: { suggestedName?: string; types?: { description?: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }> }>;
  const win = window as Window & { showSaveFilePicker?: SaveFilePicker };
  if (typeof win.showSaveFilePicker === "function") {
    try {
      const handle = await win.showSaveFilePicker({ suggestedName: filename, types: [{ description: "Excel spreadsheet", accept: { [mime]: [".xls"] } }] });
      const writable = await handle.createWritable();
      await writable.write(blob); await writable.close(); return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  try {
    const file = new File([blob], filename, { type: mime });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title?: string }) => Promise<void> };
    if (nav.canShare?.({ files: [file] }) && nav.share) { await nav.share({ files: [file], title: filename }); return; }
  } catch { /* fall through */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

function RecordsTab({ shop }: { shop: Shop }) {
  const fetchRecords = useServerFn(listSpinRecords);
  const doDel = useServerFn(deleteSpinRecord);
  const doReset = useServerFn(resetSpinRecords);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("latest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [profileKey, setProfileKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchRecords({ data: { shopId: shop.id } });
      setRows((res.rows as RecordRow[]) ?? []);
    } finally { setLoading(false); }
  }, [fetchRecords, shop.id]);
  useEffect(() => { load(); }, [load]);

  const spinCountByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(custKey(r), (m.get(custKey(r)) || 0) + 1);
    return m;
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);
    let out = rows.filter((r) => {
      if (s && !((r.customer_name || "").toLowerCase().includes(s)
        || (r.customer_contact || "").toLowerCase().includes(s)
        || (r.customer_email || "").toLowerCase().includes(s)
        || r.code.toLowerCase().includes(s)
        || (r.prize_won || "").toLowerCase().includes(s))) return false;
      if (filter === "winners" && !isWinner(r)) return false;
      if (filter === "nonwinners" && isWinner(r)) return false;
      if (filter === "today") { if (!r.spun_at || new Date(r.spun_at) < todayStart) return false; }
      if (filter === "week") { if (!r.spun_at || new Date(r.spun_at) < weekStart) return false; }
      return true;
    });
    if (sort === "latest") out = [...out].sort((a, b) => (b.spun_at || "").localeCompare(a.spun_at || ""));
    else if (sort === "oldest") out = [...out].sort((a, b) => (a.spun_at || "").localeCompare(b.spun_at || ""));
    else if (sort === "spins") out = [...out].sort((a, b) => (spinCountByKey.get(custKey(b)) || 0) - (spinCountByKey.get(custKey(a)) || 0));
    return out;
  }, [rows, q, filter, sort, spinCountByKey]);

  const toggleSel = (code: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });
  };
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.code));
  const toggleSelAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.code)));
  };

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.code)), [rows, selected]);

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected record(s)?`)) return;
    for (const code of selected) await doDel({ data: { shopId: shop.id, code } });
    setSelected(new Set()); load();
  };
  const bulkMessage = () => {
    const contacts = selectedRows.map((r) => r.customer_contact).filter(Boolean) as string[];
    if (contacts.length === 0) return alert("No phone contacts in selection.");
    const body = encodeURIComponent("Hi from " + shop.name + "!");
    window.open(`https://wa.me/?text=${body}`, "_blank");
  };

  const profileRows = useMemo(() => profileKey ? rows.filter((r) => custKey(r) === profileKey) : [], [profileKey, rows]);

  const FILTERS: { k: FilterKey; label: string }[] = [
    { k: "all", label: "All" }, { k: "winners", label: "Winners" },
    { k: "nonwinners", label: "Non-Winners" }, { k: "today", label: "Today" }, { k: "week", label: "This Week" },
  ];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b7a93]" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, phone, or code"
          className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-2xl pl-10 pr-3 py-3 text-sm outline-none focus:border-[#FF6B00]/40 focus:bg-white shadow-sm"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {FILTERS.map(({ k, label }) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${filter === k ? "bg-[#FF6B00] text-white border-[#FF6B00] shadow-sm" : "bg-white text-[#0c2340] border-[#0c2340]/10 hover:border-[#FF6B00]/40"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Sort + select all */}
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-[#0c2340]/70">
          <input type="checkbox" checked={allSelected} onChange={toggleSelAll} className="h-4 w-4 rounded accent-[#FF6B00]" />
          <span>{selected.size > 0 ? `${selected.size} selected` : `${filtered.length} customer${filtered.length === 1 ? "" : "s"}`}</span>
        </label>
        <div className="relative">
          <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b7a93] pointer-events-none" />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
            className="appearance-none bg-white text-[#0c2340] border border-[#0c2340]/10 rounded-full pl-7 pr-7 py-1.5 text-xs font-semibold shadow-sm focus:outline-none focus:border-[#FF6B00]/40">
            <option value="latest">Latest</option>
            <option value="oldest">Oldest</option>
            <option value="spins">Most Spins</option>
          </select>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-[#0c2340] text-white rounded-2xl p-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button onClick={() => setSelected(new Set())} className="p-2 rounded-full hover:bg-white/10" aria-label="Clear selection">
            <X className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold flex-1">{selected.size} selected</span>
          <button onClick={() => exportRowsAsCsv(selectedRows, shop.slug)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={bulkMessage} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold">
            <MessageSquare className="h-3.5 w-3.5" /> Message
          </button>
          <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-semibold">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#0c2340]/60">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF6B00]" />
          <p className="text-sm mt-3">Loading customers…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-[#FF6B00]/10 grid place-items-center mb-3">
            <Users className="h-7 w-7 text-[#FF6B00]" />
          </div>
          <p className="text-[#0c2340] font-semibold">No customers yet</p>
          <p className="text-xs text-[#0c2340]/60 mt-1 max-w-xs">{q || filter !== "all" ? "Try adjusting your search or filters." : "Customers who spin will appear here automatically."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const winner = isWinner(r);
            const checked = selected.has(r.code);
            const when = r.spun_at ? new Date(r.spun_at) : null;
            return (
              <div key={r.code}
                className={`group bg-white border rounded-2xl p-3 shadow-sm transition ${checked ? "border-[#FF6B00] ring-2 ring-[#FF6B00]/20" : "border-[#0c2340]/10 hover:border-[#FF6B00]/30 hover:shadow-md"}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={checked} onChange={() => toggleSel(r.code)} onClick={(e) => e.stopPropagation()} className="mt-1 h-4 w-4 rounded accent-[#FF6B00] shrink-0" />
                  <button onClick={() => setProfileKey(custKey(r))} className="flex-1 min-w-0 text-left">
                    <div className="flex items-start gap-3">
                      <div className={`h-11 w-11 shrink-0 rounded-full grid place-items-center text-sm font-bold ${winner ? "bg-[#FF6B00]/15 text-[#FF6B00]" : "bg-[#0c2340]/10 text-[#0c2340]"}`}>
                        {initials(r.customer_name, r.code)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#0c2340] truncate">{r.customer_name || "Anonymous"}</p>
                          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${winner ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                            {winner ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {winner ? "Winner" : "Non-Winner"}
                          </span>
                        </div>
                        {r.customer_contact && <p className="text-xs text-[#0c2340]/60 truncate mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3" />{r.customer_contact}</p>}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#0c2340]/60 mt-1.5">
                          {when && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{when.toLocaleDateString()} · {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                          <span className="inline-flex items-center gap-1 font-mono"><Hash className="h-3 w-3" />{r.code}</span>
                        </div>
                        <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0c2340]">
                          <Award className={`h-3.5 w-3.5 ${winner ? "text-[#FF6B00]" : "text-[#0c2340]/40"}`} />
                          {r.prize_won || "Try Again"}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer actions */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center gap-2 pt-2">
          <button onClick={() => exportRowsAsCsv(rows, shop.slug)} className="flex-1 flex items-center justify-center gap-2 bg-[#FF6B00] hover:bg-[#e85f00] text-white rounded-xl py-2.5 text-sm font-semibold shadow-sm">
            <Download className="h-4 w-4" /> Export All CSV
          </button>
          <button onClick={async () => { if (confirm("Reset all spin records? This cannot be undone.")) { await doReset({ data: { shopId: shop.id } }); setSelected(new Set()); load(); } }} className="px-3 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold">
            Reset All
          </button>
        </div>
      )}

      {/* Profile drawer */}
      {profileKey && (
        <CustomerProfile
          rows={profileRows}
          onClose={() => setProfileKey(null)}
          onDelete={async (code) => { if (!confirm("Delete this spin record?")) return; await doDel({ data: { shopId: shop.id, code } }); load(); }}
        />
      )}
    </div>
  );
}

function CustomerProfile({ rows, onClose, onDelete }: { rows: RecordRow[]; onClose: () => void; onDelete: (code: string) => void | Promise<void> }) {
  const primary = rows[0];
  if (!primary) return null;
  const winners = rows.filter(isWinner);
  const name = rows.find((r) => r.customer_name)?.customer_name || "Anonymous";
  const contact = rows.find((r) => r.customer_contact)?.customer_contact;
  const email = rows.find((r) => r.customer_email)?.customer_email;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="relative bg-gradient-to-br from-[#0c2340] to-[#1a3a5f] text-white p-5">
          <button onClick={onClose} className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-[#FF6B00] grid place-items-center text-lg font-bold">
              {initials(name, primary.code)}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold truncate">{name}</h3>
              <p className="text-xs text-white/70">{rows.length} spin{rows.length === 1 ? "" : "s"} · {winners.length} win{winners.length === 1 ? "" : "s"}</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {/* Contact */}
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50 mb-2">Contact</h4>
            <div className="space-y-2">
              {contact ? (
                <a href={`tel:${contact}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F7FA] hover:bg-[#FF6B00]/10 transition">
                  <Phone className="h-4 w-4 text-[#FF6B00]" />
                  <span className="text-sm text-[#0c2340] font-medium">{contact}</span>
                </a>
              ) : null}
              {email ? (
                <a href={`mailto:${email}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F7FA] hover:bg-[#FF6B00]/10 transition">
                  <Mail className="h-4 w-4 text-[#FF6B00]" />
                  <span className="text-sm text-[#0c2340] font-medium truncate">{email}</span>
                </a>
              ) : null}
              {!contact && !email && <p className="text-xs text-[#0c2340]/50">No contact info on file.</p>}
            </div>
          </section>

          {/* Spin history */}
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50 mb-2">Spin History</h4>
            <div className="space-y-2">
              {rows.map((r) => {
                const winner = isWinner(r);
                const when = r.spun_at ? new Date(r.spun_at) : null;
                return (
                  <div key={r.code} className="flex items-center gap-3 p-3 rounded-xl border border-[#0c2340]/10">
                    <div className={`h-9 w-9 rounded-full grid place-items-center shrink-0 ${winner ? "bg-[#FF6B00]/15 text-[#FF6B00]" : "bg-slate-100 text-slate-500"}`}>
                      <Award className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0c2340] truncate">{r.prize_won || "Try Again"}</p>
                      <p className="text-[11px] text-[#0c2340]/60 font-mono">{r.code} · {when ? when.toLocaleString() : "—"}</p>
                    </div>
                    <button onClick={() => onDelete(r.code)} className="h-8 w-8 grid place-items-center rounded-full text-red-500 hover:bg-red-50" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Prizes won */}
          {winners.length > 0 && (
            <section>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50 mb-2">Prizes Won</h4>
              <div className="flex flex-wrap gap-2">
                {winners.map((r) => (
                  <span key={r.code} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] text-xs font-semibold border border-[#FF6B00]/20">
                    <Trophy className="h-3 w-3" />{r.prize_won}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}


// ---------- STATS ----------
function StatsTab({ shop }: { shop: Shop }) {
  const fetchRecords = useServerFn(listSpinRecords);
  const fetchCodes = useServerFn(listAccessCodes);
  const fetchShops = useServerFn(listMyShops);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState(0);

  useEffect(() => {
    fetchRecords({ data: { shopId: shop.id } }).then((r) => setRows((r.rows as RecordRow[]) ?? []));
    fetchCodes({ data: { shopId: shop.id } }).then((r) => setCodes((r.rows as CodeRow[]) ?? []));
    fetchShops().then((r) => {
      const list = (r.shops ?? []) as Shop[];
      setActiveCampaigns(list.filter((s) => s.is_active).length);
    }).catch(() => {});
  }, [fetchRecords, fetchCodes, fetchShops, shop.id]);

  const data = useMemo(() => {
    const winners = rows.filter((r) => r.prize_won && !/try\s*again/i.test(r.prize_won)).length;
    const customers = new Set(
      rows.map((r) => (r.customer_name || "").trim().toLowerCase()).filter(Boolean)
    ).size || rows.length;
    const totalCodes = codes.length;
    const conversion = totalCodes > 0 ? Math.round((rows.length / totalCodes) * 100) : 0;

    // prize distribution
    const dist: Record<string, number> = {};
    for (const r of rows) {
      const k = r.prize_won || "Unknown";
      if (/try\s*again/i.test(k)) continue;
      dist[k] = (dist[k] || 0) + 1;
    }
    const distArr = Object.entries(dist)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const topPrizes = distArr.slice(0, 5);

    // weekly
    const days: { day: string; spins: number; date: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const count = rows.filter((r) => {
        if (!r.spun_at) return false;
        const t = new Date(r.spun_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).length;
      days.push({
        day: d.toLocaleDateString(undefined, { weekday: "short" }),
        date: d.toLocaleDateString(),
        spins: count,
      });
    }

    // peak hour
    const hourBuckets = new Array(24).fill(0) as number[];
    for (const r of rows) {
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

    // recent performance (last 7 vs prev 7)
    const now = Date.now();
    const day = 86400000;
    const last7 = rows.filter((r) => r.spun_at && now - new Date(r.spun_at).getTime() <= 7 * day).length;
    const prev7 = rows.filter((r) => {
      if (!r.spun_at) return false;
      const t = now - new Date(r.spun_at).getTime();
      return t > 7 * day && t <= 14 * day;
    }).length;
    const delta = prev7 === 0 ? (last7 > 0 ? 100 : 0) : Math.round(((last7 - prev7) / prev7) * 100);

    return {
      total: rows.length, winners, customers, conversion,
      distArr, topPrizes, days,
      peakHour: fmtHour(peakHour), peakCount,
      last7, prev7, delta,
    };
  }, [rows, codes]);

  const kpis = [
    { label: "Total Spins", value: data.total, icon: TrendingUp, accent: "bg-orange-50 text-[#FF6B00]" },
    { label: "Winners", value: data.winners, icon: Trophy, accent: "bg-emerald-50 text-emerald-600" },
    { label: "Customers", value: data.customers, icon: Users, accent: "bg-blue-50 text-blue-600" },
    { label: "Conversion", value: `${data.conversion}%`, icon: Sparkles, accent: "bg-violet-50 text-violet-600" },
    { label: "Active Campaigns", value: activeCampaigns, icon: Activity, accent: "bg-pink-50 text-pink-600" },
  ];

  const PIE_COLORS = ["#FF6B00", "#0c2340", "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6"];

  const exportExcel = () => {
    const headers = ["Customer", "Phone", "Code", "Prize", "Spun At"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      const phone = (r as RecordRow & { customer_phone?: string | null }).customer_phone ?? "";
      const row = [
        r.customer_name || "",
        phone,
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
    a.download = `${shop.slug}-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPDF = () => {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    const rowsHtml = data.topPrizes
      .map((p) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${p.name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${p.value}</td></tr>`)
      .join("");
    const weekHtml = data.days
      .map((d) => `<tr><td style="padding:6px;border-bottom:1px solid #eee">${d.date}</td><td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${d.spins}</td></tr>`)
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
      <p class="muted">Analytics report · ${new Date().toLocaleString()}</p>
      <div class="grid">
        ${kpis.map((k) => `<div class="card"><div class="label">${k.label}</div><div class="value">${k.value}</div></div>`).join("")}
      </div>
      <h2>Top Prizes</h2><table>${rowsHtml || '<tr><td class="muted">No data</td></tr>'}</table>
      <h2>Weekly Spins</h2><table>${weekHtml}</table>
      <h2>Peak Activity</h2><p>${data.peakHour}${data.peakCount ? ` · ${data.peakCount} spins` : ""}</p>
      <h2>Recent Performance</h2><p>Last 7 days: <strong>${data.last7}</strong> · Previous 7: ${data.prev7} · Change: ${data.delta >= 0 ? "+" : ""}${data.delta}%</p>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header + Export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-[#0c2340]">Analytics</h2>
          <p className="text-xs text-[#4a5b78]">Performance overview for {shop.name}</p>
        </div>
        <div className="flex gap-2">
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
        {kpis.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
            <div className={`w-9 h-9 rounded-xl grid place-items-center ${accent}`}>
              <Icon className="w-4.5 h-4.5" strokeWidth={2.2} />
            </div>
            <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] mt-3 font-semibold">{label}</p>
            <p className="text-2xl font-black text-[#0c2340] mt-0.5">{value}</p>
          </div>
        ))}
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#0c2340]">Weekly Spins</h3>
            <span className="text-[11px] text-[#4a5b78]">Last 7 days</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.days} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0c234012" vertical={false} />
                <XAxis dataKey="day" stroke="#4a5b78" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#4a5b78" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <RTooltip
                  cursor={{ fill: "#FF6B0010" }}
                  contentStyle={{ borderRadius: 12, border: "1px solid #0c234020", fontSize: 12 }}
                />
                <Bar dataKey="spins" fill="#FF6B00" radius={[8, 8, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#0c2340]">Prize Distribution</h3>
            <span className="text-[11px] text-[#4a5b78]">All time</span>
          </div>
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
          <h3 className="text-sm font-bold text-[#0c2340] mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#FF6B00]" /> Top Prizes
          </h3>
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
          <div className="mt-4 pt-4 border-t border-white/10 text-xs opacity-80">
            Use this window to schedule promotions and reach customers when they're most engaged.
          </div>
        </div>

        {/* Recent Performance */}
        <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
          <h3 className="text-sm font-bold text-[#0c2340] mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> Recent Performance
          </h3>
          <div className="flex items-end gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] font-semibold">Last 7 days</p>
              <p className="text-3xl font-black text-[#0c2340]">{data.last7}</p>
            </div>
            <span className={`mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${data.delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {data.delta >= 0 ? "▲" : "▼"} {Math.abs(data.delta)}%
            </span>
          </div>
          <div className="mt-3 text-xs text-[#4a5b78]">
            Previous 7 days: <span className="font-mono font-bold text-[#0c2340]">{data.prev7}</span>
          </div>
          <div className="mt-4 pt-4 border-t border-[#0c2340]/8 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[#4a5b78]">Win rate</p>
              <p className="font-black text-[#0c2340] text-base">
                {data.total > 0 ? Math.round((data.winners / data.total) * 100) : 0}%
              </p>
            </div>
            <div>
              <p className="text-[#4a5b78]">Avg / day</p>
              <p className="font-black text-[#0c2340] text-base">{Math.round(data.last7 / 7)}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------- QR CODES ----------
function QrTab({ shop }: { shop: Shop }) {
  const fetchCodes = useServerFn(listAccessCodes);
  const [rows, setRows] = useState<CodeRow[]>([]);
  const [filter, setFilter] = useState<"all" | "unused">("unused");

  useEffect(() => {
    fetchCodes({ data: { shopId: shop.id } }).then((r) => setRows((r.rows as CodeRow[]) ?? []));
  }, [fetchCodes, shop.id]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shopUrl = `${origin}/s/${shop.slug}`;
  const codeUrl = (code: string) => `${origin}/s/${shop.slug}?code=${encodeURIComponent(code)}`;

  const list = rows.filter((r) => (filter === "unused" ? !r.is_used : true));

  return (
    <div className="space-y-4">
      <style>{`@media print {
        @page { margin: 12mm; }
        body * { visibility: hidden; }
        #qr-print, #qr-print * { visibility: visible; }
        #qr-print { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; padding: 0; }
        .no-print { display: none !important; }
        .qr-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #ddd !important; background: white !important; color: black !important; padding: 20px !important; }
        .qr-grid { gap: 24px !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .qr-code svg { width: 170px !important; height: 170px !important; }
        .shop-qr svg { width: 240px !important; height: 240px !important; }
      }`}</style>

      <div className="glass rounded-2xl p-4 no-print space-y-2">
        <p className="text-xs uppercase tracking-widest text-gold">How it works</p>
        <p className="text-sm text-muted-foreground">
          Customers scan a QR with their phone camera and spin on their own device — no app required.
          The <span className="text-foreground font-semibold">Shop QR</span> opens the entry page where they enter any access code.
          A <span className="text-foreground font-semibold">Per-code QR</span> opens the entry page with the code already filled in — they just type their name and spin.
        </p>
        <div className="flex gap-2 flex-wrap pt-2">
          <button onClick={() => window.print()} className="px-3 py-2 rounded-lg bg-primary text-white font-bold text-sm">Print this page</button>
          <button onClick={() => setFilter(filter === "all" ? "unused" : "all")} className="px-3 py-2 rounded-lg bg-white/5 text-sm">
            Showing: {filter === "all" ? "All codes" : "Unused only"}
          </button>
        </div>
      </div>

      <div id="qr-print" className="space-y-6">
        <div className="qr-card glass rounded-2xl p-6 flex flex-col items-center text-center">
          <p className="text-xs uppercase tracking-widest text-gold">Shop QR — scan to spin</p>
          <h2 className="text-2xl font-black mt-1">{shop.name}</h2>
          <div className="qr-code mt-4 p-4 bg-white rounded-xl">
            <QRCodeSVG value={shopUrl} size={240} level="M" includeMargin={false} />
          </div>
          <p className="mt-3 text-xs break-all opacity-80">{shopUrl}</p>
          <p className="mt-2 text-[11px] opacity-70">Point your phone camera at the code to open the spin page.</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 no-print">Per-code QRs ({list.length})</p>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground no-print">No codes to show. Generate codes in the Codes tab first.</p>
          ) : (
            <div className="qr-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {list.map((r) => (
                <div key={r.code} className="qr-card glass rounded-xl p-5 flex flex-col items-center text-center">
                  <div className="qr-code p-3 bg-white rounded-lg">
                    <QRCodeSVG value={codeUrl(r.code)} size={170} level="M" includeMargin={false} />
                  </div>
                  <p className="mt-3 font-mono text-sm tracking-widest break-all">{r.code}</p>
                  <p className="text-xs opacity-70">{shop.name}</p>
                  {r.is_used && <p className="text-xs text-destructive no-print">used</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SubscriptionBanner() {
  const fetchSub = useServerFn(getMySubscription);
  const [sub, setSub] = useState<{ plan: string; subscription_status: string; trial_ends_at: string | null; current_period_end: string | null } | null>(null);
  useEffect(() => {
    fetchSub().then((r) => { if (r.shop) setSub(r.shop as any); }).catch(() => {});
  }, [fetchSub]);
  if (!sub) return null;
  const end = sub.current_period_end ?? sub.trial_ends_at;
  const expired = end ? new Date(end).getTime() < Date.now() : false;
  const daysLeft = end ? Math.ceil((new Date(end).getTime() - Date.now()) / 86400000) : null;
  const tone =
    sub.subscription_status === "suspended" || expired ? "bg-destructive/20 border-destructive/40 text-destructive" :
    sub.subscription_status === "trial" || sub.subscription_status === "past_due" ? "bg-amber-500/10 border-amber-500/30 text-amber-200" :
    "bg-emerald-500/10 border-emerald-500/30 text-emerald-200";
  return (
    <div className={`mb-4 rounded-xl border px-3 py-2 text-xs flex justify-between items-center gap-2 flex-wrap ${tone}`}>
      <div>
        <span className="font-bold uppercase mr-2">{sub.plan}</span>
        <span className="uppercase">{sub.subscription_status}</span>
        {end && (
          <span className="ml-2 opacity-80">
            {expired ? `Expired ${new Date(end).toLocaleDateString()}` : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left · ${new Date(end).toLocaleDateString()}`}
          </span>
        )}
      </div>
      {(sub.subscription_status !== "active" || expired) && (
        <span className="opacity-80">Contact admin to activate / renew.</span>
      )}
    </div>
  );
}

// ---------- CAMPAIGN HUB ----------
type HubSection = "overview" | "prizes" | "wheel" | "qr-codes" | "settings";

function CampaignHub({
  shop, onSaved, doUpdate, superAdmin, doBootstrap,
}: {
  shop: Shop;
  onSaved: () => void;
  doUpdate: ReturnType<typeof useServerFn<typeof updateMyShop>>;
  superAdmin: boolean;
  doBootstrap: ReturnType<typeof useServerFn<typeof bootstrapSuperAdmin>>;
}) {
  const fetchPrizes = useServerFn(listMyPrizes);
  const fetchCodes = useServerFn(listAccessCodes);
  const fetchSub = useServerFn(getMySubscription);
  const fetchCampaigns = useServerFn(listMyCampaigns);

  const [section, setSection] = useState<HubSection>("overview");
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [sub, setSub] = useState<{ trial_ends_at: string | null; current_period_end: string | null; subscription_status: string; created_at?: string } | null>(null);
  const [busyStatus, setBusyStatus] = useState(false);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; slug: string; is_default: boolean }[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  // Load campaigns & default selection
  useEffect(() => {
    fetchCampaigns({ data: { shopId: shop.id } }).then((r) => {
      const list = (r.campaigns as { id: string; name: string; slug: string; is_default: boolean }[]) ?? [];
      setCampaigns(list);
      setActiveCampaignId((prev) => prev ?? list.find((c) => c.is_default)?.id ?? list[0]?.id ?? null);
    }).catch(() => {});
  }, [fetchCampaigns, shop.id]);

  const reload = useCallback(() => {
    if (!activeCampaignId) return;
    fetchPrizes({ data: { shopId: shop.id, campaignId: activeCampaignId } }).then((r) => setPrizes(r.prizes as Prize[]));
    fetchCodes({ data: { shopId: shop.id } }).then((r) => setCodes((r.rows as CodeRow[]) ?? []));
  }, [fetchPrizes, fetchCodes, shop.id, activeCampaignId]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    fetchSub().then((r) => { if (r.shop) setSub(r.shop as any); }).catch(() => {});
  }, [fetchSub]);

  const totalCodes = codes.length;
  const remainingCodes = codes.filter((c) => !c.is_used).length;
  const endDate = sub?.current_period_end ?? sub?.trial_ends_at ?? null;
  const startDate = (sub as any)?.created_at ?? null;
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

  const toggleActive = async () => {
    setBusyStatus(true);
    try {
      await doUpdate({ data: { id: shop.id, is_active: !shop.is_active } });
      onSaved();
    } finally { setBusyStatus(false); }
  };

  const CampaignPicker = campaigns.length > 0 ? (
    <div className="flex items-center gap-2 flex-wrap rounded-xl bg-[#F5F7FA] border border-[#0c2340]/10 px-3 py-2">
      <Megaphone className="w-4 h-4 text-[#0c2340]" />
      <label className="text-xs font-bold uppercase tracking-wide text-[#4a5b78]">Campaign</label>
      <select
        value={activeCampaignId ?? ""}
        onChange={(e) => setActiveCampaignId(e.target.value)}
        className="flex-1 min-w-[140px] bg-white border border-[#0c2340]/15 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#0c2340] outline-none"
      >
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>{c.name}{c.is_default ? " (default)" : ""}</option>
        ))}
      </select>
      <Link to="/campaigns" className="text-xs font-bold text-[#FF6B00] hover:underline whitespace-nowrap">Manage →</Link>
    </div>
  ) : null;

  if (section !== "overview") {
    const titles: Record<Exclude<HubSection, "overview">, string> = {
      prizes: "Prizes",
      wheel: "Spin Wheel",
      "qr-codes": "QR & Access Codes",
      settings: "Campaign Settings",
    };
    return (
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => setSection("overview")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0c2340] px-3 py-2 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5]"
        >
          <ChevronLeft className="w-4 h-4" /> Campaign Hub
        </button>
        <h2 className="text-xl font-black text-[#0c2340]">{titles[section]}</h2>
        {(section === "prizes" || section === "wheel") && CampaignPicker}
        {section === "prizes" && <PrizesTab shop={shop} campaignId={activeCampaignId} />}
        {section === "wheel" && <WheelSection shop={shop} prizes={prizes} onEditColors={() => setSection("settings")} onAssign={() => setSection("prizes")} />}
        {section === "qr-codes" && (
          <div className="space-y-6">
            <QrTab shop={shop} />
            <div className="pt-2 border-t border-[#0c2340]/10">
              <h3 className="text-base font-black text-[#0c2340] mb-3">Access Codes</h3>
              <CodesTab shop={shop} />
            </div>
          </div>
        )}
        {section === "settings" && (
          <SettingsTab shop={shop} onSaved={onSaved} doUpdate={doUpdate} superAdmin={superAdmin} doBootstrap={doBootstrap} onSignOut={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }} />
        )}
      </div>
    );
  }


  const stats = [
    { label: "Total Prizes", value: prizes.length, icon: Gift },
    { label: "Total Codes", value: totalCodes, icon: Ticket },
    { label: "Remaining", value: remainingCodes, icon: Hash },
  ];

  const cards: { key: Exclude<HubSection, "overview">; title: string; emoji: string; icon: typeof Gift; desc: string; actions: string[] }[] = [
    { key: "prizes", title: "Prizes", emoji: "🎁", icon: Gift,
      desc: "Manage your reward catalog and inventory.",
      actions: ["View prizes", "Add prize", "Edit prize", "Prize inventory"] },
    { key: "wheel", title: "Spin Wheel", emoji: "🎡", icon: PlayCircle,
      desc: "Preview the wheel and test how it spins.",
      actions: ["Preview wheel", "Edit wheel colors", "Assign prizes", "Test spin"] },
    { key: "qr-codes", title: "QR & Access Codes", emoji: "🔳", icon: QrCode,
      desc: "Generate, print and export everything customers need.",
      actions: ["Generate QR", "Download QR", "Print QR", "Generate codes", "Export CSV"] },
    { key: "settings", title: "Campaign Settings", emoji: "⚙️", icon: SettingsIcon,
      desc: "Odds, limits, expiry and terms.",
      actions: ["Winning probability", "Daily spin limit", "Campaign expiry", "Terms & Conditions"] },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      {/* Header card */}
      <section className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] font-bold">Campaign</p>
            <h2 className="text-xl sm:text-2xl font-black text-[#0c2340] truncate mt-0.5">{shop.name}</h2>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${shop.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                <CircleDot className={`w-3 h-3 ${shop.is_active ? "text-emerald-500" : "text-amber-500"}`} />
                {shop.is_active ? "Active" : "Paused"}
              </span>
            </div>
          </div>
          <button
            onClick={toggleActive}
            disabled={busyStatus}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-60 ${shop.is_active ? "bg-white text-[#0c2340] border-[#0c2340]/15 hover:bg-[#F5F7FA]" : "bg-[#FF6B00] text-white border-[#FF6B00] hover:bg-[#e85f00]"}`}
          >
            <Power className="w-4 h-4" /> {shop.is_active ? "Pause" : "Activate"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#0c2340]/8 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold text-[#4a5b78]"><Calendar className="w-3.5 h-3.5" /> Start</div>
            <p className="text-sm font-bold text-[#0c2340] mt-1">{fmt(startDate)}</p>
          </div>
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#0c2340]/8 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold text-[#4a5b78]"><Calendar className="w-3.5 h-3.5" /> Ends</div>
            <p className="text-sm font-bold text-[#0c2340] mt-1">{fmt(endDate)}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl bg-[#F8FAFC] border border-[#0c2340]/8 p-3">
              <Icon className="w-4 h-4 text-[#FF6B00]" />
              <p className="text-[10px] uppercase tracking-wide text-[#4a5b78] font-bold mt-1.5">{label}</p>
              <p className="text-xl font-black text-[#0c2340]">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Management cards */}
      <section className="space-y-3">
        {cards.map(({ key, title, emoji, icon: Icon, desc, actions }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className="w-full text-left rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-5 hover:border-[#FF6B00]/40 hover:shadow-[0_8px_24px_-8px_rgba(255,107,0,0.25)] transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl grid place-items-center bg-orange-50 text-2xl shrink-0">
                <span aria-hidden>{emoji}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-[#FF6B00]" />
                  <h3 className="text-base font-black text-[#0c2340]">{title}</h3>
                </div>
                <p className="text-xs text-[#4a5b78] mt-1">{desc}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {actions.map((a) => (
                    <span key={a} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#0c2340] border border-[#0c2340]/8">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#4a5b78] shrink-0 mt-1" />
            </div>
          </button>
        ))}
      </section>

      {/* Launch / Update */}
      <div className="sticky bottom-20 z-10">
        <button
          onClick={toggleActive}
          disabled={busyStatus}
          className="w-full py-4 rounded-2xl bg-[#FF6B00] hover:bg-[#e85f00] text-white font-black text-base shadow-[0_12px_32px_-12px_rgba(255,107,0,0.6)] disabled:opacity-60 transition-colors"
        >
          {busyStatus ? "Saving…" : shop.is_active ? "Update Campaign" : "Launch Campaign"}
        </button>
      </div>
    </div>
  );
}

// ---------- WHEEL PREVIEW ----------
function WheelSection({ shop, prizes, onEditColors, onAssign }: { shop: Shop; prizes: Prize[]; onEditColors: () => void; onAssign: () => void }) {
  const [spinning, setSpinning] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const wheelPrizes = useMemo(() => prizes.map((p) => rowToPrize(p as any)), [prizes]);

  const testSpin = () => {
    if (wheelPrizes.length === 0 || spinning) return;
    const idx = Math.floor(Math.random() * wheelPrizes.length);
    setTarget(idx);
    setSpinning(true);
    setLast(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-5">
        {wheelPrizes.length === 0 ? (
          <p className="text-sm text-[#4a5b78] text-center py-10">Add prizes first to preview the wheel.</p>
        ) : (
          <div className="flex flex-col items-center">
            <SpinWheel
              prizes={wheelPrizes}
              spinning={spinning}
              targetIndex={target}
              onComplete={(p) => { setSpinning(false); setTarget(null); setLast(p.name); }}
              centerLogo={shop.logo_url ?? undefined}
              centerLabel={shop.name}
            />
            {last && (
              <p className="mt-3 text-sm font-bold text-[#0c2340]">Landed on: <span className="text-[#FF6B00]">{last}</span></p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={testSpin} disabled={spinning || wheelPrizes.length === 0} className="rounded-2xl bg-[#FF6B00] hover:bg-[#e85f00] text-white font-bold py-3 disabled:opacity-60">
          {spinning ? "Spinning…" : "Test spin"}
        </button>
        <button onClick={onAssign} className="rounded-2xl bg-white border border-[#0c2340]/10 hover:bg-[#F5F7FA] text-[#0c2340] font-bold py-3">
          Assign prizes
        </button>
        <button onClick={onEditColors} className="rounded-2xl bg-white border border-[#0c2340]/10 hover:bg-[#F5F7FA] text-[#0c2340] font-bold py-3">
          Edit wheel colors
        </button>
      </div>
    </div>
  );
}

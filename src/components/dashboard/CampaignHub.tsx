import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Megaphone, ChevronLeft, ChevronRight, Gift, Ticket, Hash, PlayCircle,
  QrCode, Settings as SettingsIcon, CircleDot, Power, Calendar,
} from "lucide-react";
import { listAccessCodes } from "@/lib/access-codes.functions";
import { getMySubscription, updateMyShop } from "@/lib/shops.functions";
import { listMyCampaigns } from "@/lib/campaigns.functions";
import { useMyPrizes } from "@/lib/my-prizes-hook";
import { PrizesPerf } from "@/lib/perf-timing";
import { supabase } from "@/integrations/supabase/client";
import { PrizesTab } from "./PrizesTab";
import { WheelSection } from "./WheelSection";
import { ScratchCardSection } from "./ScratchCardSection";
import { QrTab } from "./QrTab";
import { CodesTab } from "./CodesTab";
import { SettingsTab } from "./SettingsTab";
import type { Shop, CodeRow } from "./types";

type HubSection = "overview" | "prizes" | "wheel" | "qr-codes" | "settings";

export function CampaignHub({
  shop, onSaved, doUpdate, superAdmin,
}: {
  shop: Shop;
  onSaved: () => void;
  doUpdate: ReturnType<typeof useServerFn<typeof updateMyShop>>;
  superAdmin: boolean;
}) {
  const fetchCodes = useServerFn(listAccessCodes);
  const fetchSub = useServerFn(getMySubscription);
  const fetchCampaigns = useServerFn(listMyCampaigns);

  const [section, setSection] = useState<HubSection>("overview");
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [sub, setSub] = useState<{ trial_ends_at: string | null; current_period_end: string | null; subscription_status: string; created_at?: string } | null>(null);
  const [busyStatus, setBusyStatus] = useState(false);
  // campaignsLoading starts true so useMyPrizes is disabled until we know
  // the active campaign — prevents the null-campaignId ghost fetch that was
  // responsible for a double round-trip every time the user opened Prizes.
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; slug: string; theme?: { game_type?: string } | null; is_default: boolean }[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  // Shared prize data via TanStack Query.
  // Disabled while campaigns are still loading so we never fire a request
  // with campaignId=null.  Once enabled, the result is cached for 2 minutes:
  // when PrizesTab mounts it reads from this cache and issues zero additional
  // network requests.
  const { data: prizes = [] } = useMyPrizes(shop.id, activeCampaignId, { enabled: !campaignsLoading });

  // ── PERF AUDIT: track when activeCampaignId commits to React state ──────────
  useEffect(() => {
    // Only log after T0 (user has clicked Prizes) or if campaigns are resolving
    if (activeCampaignId !== null) {
      PrizesPerf.markActiveCampaignIdCommitted(activeCampaignId);
    }
  }, [activeCampaignId]);

  // Load campaigns & default selection.
  // finally() sets campaignsLoading=false regardless of success/failure so
  // PrizesTab is never permanently blocked if the campaigns request fails.
  useEffect(() => {
    PrizesPerf.markHubMount();           // ── PERF AUDIT T1 ──
    PrizesPerf.markCampaignsFetchStart(); // ── PERF AUDIT T1 ──
    fetchCampaigns({ data: { shopId: shop.id } }).then((r) => {
      const list = (r.campaigns as { id: string; name: string; slug: string; theme?: { game_type?: string } | null; is_default: boolean }[]) ?? [];
      setCampaigns(list);
      setActiveCampaignId((prev) => {
        const chosen = prev ?? list.find((c) => c.is_default)?.id ?? list[0]?.id ?? null;
        PrizesPerf.markCampaignsResolved(list.length, chosen); // ── PERF AUDIT T2 ──
        return chosen;
      });
    }).catch(() => {}).finally(() => {
      PrizesPerf.markCampaignsLoadingCleared(); // ── PERF AUDIT T4 ──
      setCampaignsLoading(false);
    });
  }, [fetchCampaigns, shop.id]);

  // Access codes are shop-scoped, not campaign-scoped, so this fetch is
  // independent of activeCampaignId and runs exactly once on mount.
  useEffect(() => {
    fetchCodes({ data: { shopId: shop.id } })
      .then((r) => setCodes((r.rows as CodeRow[]) ?? []))
      .catch(() => {});
  }, [fetchCodes, shop.id]);

  useEffect(() => {
    fetchSub().then((r) => { if (r.shop) setSub(r.shop as any); }).catch(() => {});
  }, [fetchSub]);

  const totalCodes = codes.length;
  const remainingCodes = codes.filter((c) => !c.is_used).length;
  const endDate = sub?.current_period_end ?? sub?.trial_ends_at ?? null;
  const startDate = (sub as any)?.created_at ?? null;
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

  const activeCampaign  = campaigns.find((c) => c.id === activeCampaignId);
  const activeGameType  = activeCampaign?.theme?.game_type ?? "spin";
  const isScratch       = activeGameType === "scratch";

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
      wheel: isScratch ? "Scratch Card" : "Spin Wheel",
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
        {section === "prizes" && (
          campaignsLoading
            ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Loading campaign…
              </div>
            )
            : <PrizesTab shop={shop} campaignId={activeCampaignId} />
        )}
        {section === "wheel" && (isScratch
          ? <ScratchCardSection shop={shop} prizes={prizes} onEditColors={() => setSection("settings")} onAssign={() => setSection("prizes")} />
          : <WheelSection shop={shop} prizes={prizes} onEditColors={() => setSection("settings")} onAssign={() => setSection("prizes")} />
        )}
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
          <SettingsTab shop={shop} onSaved={onSaved} doUpdate={doUpdate} superAdmin={superAdmin} onSignOut={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }} />
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
    { key: "wheel", title: isScratch ? "Scratch Card" : "Spin Wheel", emoji: isScratch ? "🎟" : "🎡", icon: PlayCircle,
      desc: isScratch ? "Preview the scratch card and test how it reveals." : "Preview the wheel and test how it spins.",
      actions: isScratch
        ? ["Preview card", "Edit card color", "Assign prizes", "Test scratch"]
        : ["Preview wheel", "Edit wheel colors", "Assign prizes", "Test spin"] },
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
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${isScratch ? "bg-purple-50 text-purple-700 border border-purple-200" : "bg-sky-50 text-sky-700 border border-sky-200"}`}>
                {isScratch ? "🎟 Scratch" : "🎡 Spin"}
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
            onClick={() => {
              if (key === "prizes") PrizesPerf.markUserClickedPrizes(); // ── PERF AUDIT T0 ──
              setSection(key);
            }}
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

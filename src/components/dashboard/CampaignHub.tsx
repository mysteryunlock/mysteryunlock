/**
 * CampaignHub — Merchant Control Center
 *
 * The primary workspace for merchants to manage every aspect of their campaign.
 * Designed like Shopify / Stripe: one clean navigation hub, no clutter.
 *
 * Architecture:
 * - section === "overview"  → hub overview + navigation cards
 * - section !== "overview"  → sub-section view (prizes, wheel, qr-codes, settings)
 * - Customers / Analytics / Marketing → navigate to dashboard tabs via onNavigateTab
 *
 * STRICT: No backend, server function, schema, route, auth, or business logic changes.
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Megaphone, Gift, Power, Calendar, Hash, ChevronRight,
  RotateCcw, CreditCard, QrCode, SlidersHorizontal,
  Users, BarChart3, Star, Zap,
} from "lucide-react";
import { listAccessCodes } from "@/lib/access-codes.functions";
import { getMySubscription, updateMyShop } from "@/lib/shops.functions";
import { listMyCampaigns } from "@/lib/campaigns.functions";
import { useMyPrizes } from "@/lib/my-prizes-hook";
import { PrizesPerf } from "@/lib/perf-timing";
import { supabase } from "@/integrations/supabase/client";
import { Btn } from "@/components/ds";
import { PrizesTab } from "./PrizesTab";
import { WheelSection } from "./WheelSection";
import { ScratchCardSection } from "./ScratchCardSection";
import { QrTab } from "./QrTab";
import { CodesTab } from "./CodesTab";
import { SettingsTab } from "./SettingsTab";
import {
  MerchantHubCard, MerchantStat, HubSectionHeader,
  StatusBadge, HubOverviewSkeleton,
} from "./ui";
import type { Shop, CodeRow, TabKey } from "./types";

// ── Types ────────────────────────────────────────────────────────────────────

type HubSection = "overview" | "prizes" | "wheel" | "qr-codes" | "settings";

// ── Component ────────────────────────────────────────────────────────────────

export function CampaignHub({
  shop, onSaved, doUpdate, superAdmin, onNavigateTab,
}: {
  shop: Shop;
  onSaved: () => void;
  doUpdate: ReturnType<typeof useServerFn<typeof updateMyShop>>;
  superAdmin: boolean;
  onNavigateTab?: (tab: TabKey) => void;
}) {
  const fetchCodes     = useServerFn(listAccessCodes);
  const fetchSub       = useServerFn(getMySubscription);
  const fetchCampaigns = useServerFn(listMyCampaigns);

  const [section,           setSection]           = useState<HubSection>("overview");
  const [codes,             setCodes]             = useState<CodeRow[]>([]);
  const [sub,               setSub]               = useState<{
    trial_ends_at: string | null;
    current_period_end: string | null;
    subscription_status: string;
    created_at?: string;
  } | null>(null);
  const [busyStatus,        setBusyStatus]        = useState(false);
  // campaignsLoading starts true so useMyPrizes is disabled until we know
  // the active campaign — prevents the null-campaignId ghost fetch.
  const [campaignsLoading,  setCampaignsLoading]  = useState(true);
  const [campaigns,         setCampaigns]         = useState<{
    id: string;
    name: string;
    slug: string;
    theme?: { game_type?: string } | null;
    is_default: boolean;
  }[]>([]);
  const [activeCampaignId,  setActiveCampaignId]  = useState<string | null>(null);

  // Shared prize data via TanStack Query.
  // Disabled while campaigns are still loading so we never fire a request
  // with campaignId=null. Once enabled, the result is cached for 2 minutes.
  const { data: prizes = [] } = useMyPrizes(shop.id, activeCampaignId, {
    enabled: !campaignsLoading,
  });

  // ── PERF AUDIT: track when activeCampaignId commits to React state ──────────
  useEffect(() => {
    if (activeCampaignId !== null) {
      PrizesPerf.markActiveCampaignIdCommitted(activeCampaignId);
    }
  }, [activeCampaignId]);

  // Load campaigns & default selection.
  useEffect(() => {
    PrizesPerf.markHubMount();
    PrizesPerf.markCampaignsFetchStart();
    fetchCampaigns({ data: { shopId: shop.id } })
      .then((r) => {
        const list = (r.campaigns as {
          id: string; name: string; slug: string;
          theme?: { game_type?: string } | null; is_default: boolean;
        }[]) ?? [];
        setCampaigns(list);
        setActiveCampaignId((prev) => {
          const chosen = prev ?? list.find((c) => c.is_default)?.id ?? list[0]?.id ?? null;
          PrizesPerf.markCampaignsResolved(list.length, chosen);
          return chosen;
        });
      })
      .catch(() => {})
      .finally(() => {
        PrizesPerf.markCampaignsLoadingCleared();
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
    fetchSub()
      .then((r) => { if (r.shop) setSub(r.shop as any); })
      .catch(() => {});
  }, [fetchSub]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const totalCodes     = codes.length;
  const remainingCodes = codes.filter((c) => !c.is_used).length;
  const endDate        = sub?.current_period_end ?? sub?.trial_ends_at ?? null;
  const fmt            = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId);
  const activeGameType = activeCampaign?.theme?.game_type ?? "spin";
  const isScratch      = activeGameType === "scratch";

  const toggleActive = async () => {
    setBusyStatus(true);
    try {
      await doUpdate({ data: { id: shop.id, is_active: !shop.is_active } });
      onSaved();
    } finally {
      setBusyStatus(false);
    }
  };

  // ── Section sub-page titles ──────────────────────────────────────────────────
  const sectionTitles: Record<Exclude<HubSection, "overview">, string> = {
    prizes:     "Prizes",
    wheel:      isScratch ? "Scratch Card" : "Spin Wheel",
    "qr-codes": "QR & Access Codes",
    settings:   "Campaign Rules",
  };

  // ── Campaign Picker ──────────────────────────────────────────────────────────
  // Shown inside sub-sections that are campaign-scoped (prizes, wheel).
  const CampaignPicker = campaigns.length > 0 ? (
    <div className="flex items-center gap-2 flex-wrap rounded-xl bg-[#F5F7FA] border border-[#0C2340]/10 px-3 py-2">
      <Megaphone className="w-4 h-4 text-[#0C2340] shrink-0" strokeWidth={1.75} />
      <label className="text-xs font-bold uppercase tracking-wide text-[#4a5b78] shrink-0">Campaign</label>
      <select
        value={activeCampaignId ?? ""}
        onChange={(e) => setActiveCampaignId(e.target.value)}
        className="flex-1 min-w-[140px] bg-white border border-[#0C2340]/15 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#0C2340] outline-none"
      >
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}{c.is_default ? " (default)" : ""}
          </option>
        ))}
      </select>
      <Link
        to="/campaigns"
        className="text-xs font-bold text-[#FF6B1A] hover:opacity-75 transition-opacity inline-flex items-center gap-0.5 whitespace-nowrap"
      >
        Manage
        <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
      </Link>
    </div>
  ) : null;

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (campaignsLoading && section === "overview") {
    return <HubOverviewSkeleton />;
  }

  // ── Sub-section view ─────────────────────────────────────────────────────────
  if (section !== "overview") {
    return (
      <div className="space-y-4 animate-fade-in">
        <HubSectionHeader title={sectionTitles[section]} onBack={() => setSection("overview")} />

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

        {section === "wheel" && (
          isScratch
            ? (
              <ScratchCardSection
                shop={shop}
                prizes={prizes}
                onEditColors={() => setSection("settings")}
                onAssign={() => setSection("prizes")}
              />
            )
            : (
              <WheelSection
                shop={shop}
                prizes={prizes}
                onEditColors={() => setSection("settings")}
                onAssign={() => setSection("prizes")}
              />
            )
        )}

        {section === "qr-codes" && (
          <div className="space-y-6">
            <QrTab shop={shop} />
            <div className="pt-2 border-t border-[#0C2340]/10">
              <h3 className="text-base font-display font-black text-[#0C2340] mb-3">Access Codes</h3>
              <CodesTab shop={shop} />
            </div>
          </div>
        )}

        {section === "settings" && (
          <SettingsTab
            shop={shop}
            onSaved={onSaved}
            doUpdate={doUpdate}
            superAdmin={superAdmin}
            onSignOut={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
          />
        )}
      </div>
    );
  }

  // ── Overview ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in pb-4">

      {/* ── Overview Card ───────────────────────────────────────────────────── */}
      <section className="rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_24px_-8px_rgba(12,35,64,0.13)] p-5 space-y-4">

        {/* Campaign name + Pause/Activate */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93]">
              Campaign
            </p>

            {/* Campaign name / picker */}
            {campaigns.length > 1 ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <select
                  value={activeCampaignId ?? ""}
                  onChange={(e) => setActiveCampaignId(e.target.value)}
                  className="text-xl font-display font-black text-[#0C2340] bg-transparent border-none outline-none appearance-none cursor-pointer truncate max-w-[200px] sm:max-w-none pr-1"
                  aria-label="Select campaign"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.is_default ? " ★" : ""}
                    </option>
                  ))}
                </select>
                <span className="text-[#c4ccd9] text-base select-none" aria-hidden>▾</span>
              </div>
            ) : (
              <h2 className="text-xl font-display font-black text-[#0C2340] truncate mt-0.5">
                {activeCampaign?.name ?? shop.name}
              </h2>
            )}

            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <StatusBadge active={shop.is_active} />
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  isScratch
                    ? "bg-purple-50 text-purple-700 border-purple-200/60"
                    : "bg-sky-50 text-sky-700 border-sky-200/60"
                }`}
              >
                {isScratch
                  ? <CreditCard className="w-3 h-3" strokeWidth={2} />
                  : <RotateCcw className="w-3 h-3" strokeWidth={2} />
                }
                {isScratch ? "Scratch" : "Spin"}
              </span>
            </div>

            {/* End date */}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[#6b7a93] font-medium">
              <Calendar className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              <span>Ends {fmt(endDate)}</span>
            </div>
          </div>

          {/* Pause / Activate */}
          <Btn
            variant={shop.is_active ? "outline" : "primary"}
            size="sm"
            className="shrink-0 min-h-[44px]"
            onClick={toggleActive}
            disabled={busyStatus}
            leftIcon={<Power className="w-3.5 h-3.5" strokeWidth={1.75} />}
          >
            {busyStatus ? "Saving…" : shop.is_active ? "Pause" : "Activate"}
          </Btn>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <MerchantStat label="Remaining Codes" value={remainingCodes} icon={Hash} />
          <MerchantStat label="Total Prizes"    value={prizes.length}  icon={Gift} />
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between pt-1 border-t border-[#0C2340]/6">
          <span className="text-xs text-[#9aa5b5]">
            {totalCodes} total codes · {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
          </span>
          <Link
            to="/campaigns"
            className="text-xs font-bold text-[#FF6B1A] hover:opacity-75 transition-opacity inline-flex items-center gap-0.5"
          >
            Manage campaigns
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      {/* ── Navigation Cards ─────────────────────────────────────────────────── */}
      <div className="space-y-2.5">

        {/* ── Core campaign sections ─────────────────────────────────────────── */}
        <MerchantHubCard
          icon={Gift}
          title="Prizes"
          description="Manage prizes, inventory and winning probabilities."
          onClick={() => {
            PrizesPerf.markUserClickedPrizes(); // ── PERF AUDIT T0 ──
            setSection("prizes");
          }}
        />

        <MerchantHubCard
          icon={isScratch ? CreditCard : RotateCcw}
          title={isScratch ? "Scratch Card" : "Spin Wheel"}
          description={
            isScratch
              ? "Customize appearance and preview customer experience."
              : "Customize wheel appearance and preview customer experience."
          }
          onClick={() => setSection("wheel")}
        />

        <MerchantHubCard
          icon={QrCode}
          title="QR & Access Codes"
          description="Generate, print and export customer access codes."
          onClick={() => setSection("qr-codes")}
        />

        <MerchantHubCard
          icon={SlidersHorizontal}
          title="Campaign Rules"
          description="Configure campaign limits, probability, expiry and terms."
          onClick={() => setSection("settings")}
        />

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-1">
          <div className="flex-1 h-px bg-[#0C2340]/8" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-[#c4ccd9]">
            Business Hub
          </span>
          <div className="flex-1 h-px bg-[#0C2340]/8" />
        </div>

        {/* ── Cross-feature navigation ──────────────────────────────────────── */}
        <MerchantHubCard
          icon={Users}
          title="Customers"
          description="Manage connected customers, loyalty and engagement."
          onClick={() => onNavigateTab?.("customers")}
        />

        <MerchantHubCard
          icon={BarChart3}
          title="Analytics"
          description="Track performance, conversions and campaign insights."
          onClick={() => onNavigateTab?.("analytics")}
        />

        <MerchantHubCard
          icon={Megaphone}
          title="Marketing"
          description="WhatsApp campaigns, announcements and customer outreach."
          onClick={() => onNavigateTab?.("messages")}
        />

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-1">
          <div className="flex-1 h-px bg-[#0C2340]/8" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-[#c4ccd9]">
            Coming Soon
          </span>
          <div className="flex-1 h-px bg-[#0C2340]/8" />
        </div>

        {/* ── Future-ready disabled cards ───────────────────────────────────── */}
        <MerchantHubCard
          icon={Star}
          title="Rewards"
          description="Coupons, Loyalty, MU Rewards and Birthday Rewards."
          comingSoon
        />

        <MerchantHubCard
          icon={Zap}
          title="Automation"
          description="Auto messages, reminders and customer engagement."
          comingSoon
        />
      </div>
    </div>
  );
}

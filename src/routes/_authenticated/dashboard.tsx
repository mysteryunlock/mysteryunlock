import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listMyShops, updateMyShop, createShop } from "@/lib/shops.functions";
import { MarketingHub } from "@/components/dashboard/MarketingHub";
import { TabMount } from "@/components/dashboard/TabMount";
import { LeftSidebar } from "@/components/dashboard/LeftSidebar";
import { BottomNavigation } from "@/components/dashboard/BottomNavigation";
import { SubscriptionBanner } from "@/components/dashboard/SubscriptionBanner";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { CreateShopForm } from "@/components/dashboard/CreateShopForm";
import { CodesTab } from "@/components/dashboard/CodesTab";
import { CustomerHubTab } from "@/components/dashboard/CustomerHubTab";
import { CampaignHub } from "@/components/dashboard/CampaignHub";
import { CustomerCrm } from "@/components/dashboard/CustomerCrm";
import { ShopConnectionsTab } from "@/components/dashboard/ShopConnectionsTab";
import { StatsTab } from "@/components/dashboard/StatsTab";
import { SettingsTab } from "@/components/dashboard/SettingsTab";
import { ClaimsTab } from "@/components/dashboard/ClaimsTab";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import type { Shop, TabKey } from "@/components/dashboard/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Mystery Unlock" }] }),
  component: Dashboard,
});

const VALID_TABS: TabKey[] = [
  "overview", "campaign", "customers", "analytics", "settings",
  "codes", "qr", "messages", "claims",
];

function Dashboard() {
  const navigate = useNavigate();
  const fetchMyShops  = useServerFn(listMyShops);
  const doCreateShop  = useServerFn(createShop);
  const doUpdateShop  = useServerFn(updateMyShop);

  const [shop,          setShop]          = useState<Shop | null>(null);
  const [superAdmin,    setSuperAdmin]    = useState(false);
  const [ownerName,     setOwnerName]     = useState<string>("");
  const [loading,       setLoading]       = useState(true);
  const [loadErr,       setLoadErr]       = useState(false);
  const [customersView, setCustomersView] = useState<"crm" | "connections">("crm");

  const [tab, setTab] = useState<TabKey>(() => {
    if (typeof window === "undefined") return "overview";
    const saved = sessionStorage.getItem("mu_tab") as TabKey | null;
    return saved && VALID_TABS.includes(saved) ? saved : "overview";
  });

  const loadShop = useCallback(async () => {
    setLoading(true);
    setLoadErr(false);
    try {
      const res = await fetchMyShops();
      setSuperAdmin(res.superAdmin);
      if (res.superAdmin) { navigate({ to: "/super-admin" }); return; }
      setShop((res.shops as Shop[])[0] ?? null);
    } catch (err) {
      console.error("[dashboard] loadShop failed:", err instanceof Error ? err.message : String(err));
      setLoadErr(true);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchMyShops]);

  useEffect(() => { loadShop(); }, [loadShop]);
  useEffect(() => {
    if (typeof window !== "undefined") sessionStorage.setItem("mu_tab", tab);
  }, [tab]);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u    = data.user;
      const meta = (u?.user_metadata ?? {}) as Record<string, unknown>;
      const name = (meta.full_name as string) || (meta.name as string) || u?.email?.split("@")[0] || "";
      setOwnerName(name);
    });
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); };

  // ── Loading / error / no-shop guards ─────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (loadErr && !shop) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[#0c2340] font-semibold">We couldn't load your dashboard.</p>
        <p className="text-sm text-[#6b7a93]">Check your connection and try again.</p>
        <div className="flex gap-2">
          <button onClick={loadShop} className="bg-[#FF6B1A] text-white font-semibold px-5 py-2.5 rounded-xl">Retry</button>
          <button onClick={signOut}  className="bg-[#F5F7FA] text-[#0c2340] font-semibold px-5 py-2.5 rounded-xl">Sign out</button>
        </div>
      </div>
    );
  }
  if (!shop) {
    return <CreateShopForm onCreated={loadShop} onSignOut={signOut} doCreate={doCreateShop} />;
  }

  // ── Customers sub-view toggle ─────────────────────────────────────────────
  const customersToggle = (
    <div className="flex gap-2 mb-4">
      {(["crm", "connections"] as const).map((v) => (
        <button
          key={v}
          onClick={() => setCustomersView(v)}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors min-h-[44px] ${
            customersView === v ? "bg-[#FF6B1A] text-white" : "bg-white text-[#0c2340] border border-[#0C2340]/10"
          }`}
        >
          {v === "crm" ? "Spin CRM" : "Connected Members"}
        </button>
      ))}
    </div>
  );

  // ── Full layout ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-[#F7F9FC]">

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <LeftSidebar
        shop={shop}
        ownerName={ownerName}
        superAdmin={superAdmin}
        tab={tab}
        onSelect={setTab}
        onSignOut={signOut}
      />

      {/* ── Main content area ────────────────────────────────────────────── */}
      <div className="md:ml-[260px]">

        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-20 bg-white border-b border-[#0C2340]/8 px-4 py-3 flex items-center gap-3">
          <img
            src={shop.logo_url || DEFAULT_LOGO}
            alt={shop.name}
            className="w-9 h-9 rounded-xl object-cover border border-[#0C2340]/10 shadow-sm shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-display font-black text-[#0C2340] truncate leading-tight">
              {shop.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${shop.is_active ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9aa5b5]">
                {shop.is_active ? "Active" : "Paused"}
              </span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="px-4 sm:px-6 pt-5 pb-32 md:pb-10 max-w-4xl md:mx-auto">
          <SubscriptionBanner />

          {/* Primary tabs */}
          <TabMount active={tab === "overview"}>
            <OverviewTab shop={shop} onNavigate={setTab} />
          </TabMount>

          <TabMount active={tab === "campaign"}>
            <CampaignHub
              shop={shop}
              onSaved={loadShop}
              doUpdate={doUpdateShop}
              superAdmin={superAdmin}
              onNavigateTab={setTab}
            />
          </TabMount>

          <TabMount active={tab === "customers"}>
            {customersToggle}
            {customersView === "crm"
              ? <CustomerCrm shop={shop} />
              : <ShopConnectionsTab shop={shop} />
            }
          </TabMount>

          <TabMount active={tab === "analytics"}>
            <StatsTab shop={shop} />
          </TabMount>

          <TabMount active={tab === "settings"}>
            <SettingsTab
              shop={shop}
              onSaved={loadShop}
              doUpdate={doUpdateShop}
              superAdmin={superAdmin}
              onSignOut={signOut}
            />
          </TabMount>

          {/* Secondary tabs — back button hidden on desktop (sidebar handles nav) */}
          <TabMount active={tab === "codes"}>
            <div className="md:hidden flex items-center gap-2 mb-3">
              <button
                onClick={() => setTab("overview")}
                className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg bg-white border border-[#0C2340]/10 text-[#0c2340] hover:bg-[#ECEFF5] min-h-[44px]"
              >
                ← Back
              </button>
              <h2 className="text-lg font-black text-[#0c2340]">Access Codes</h2>
            </div>
            <h2 className="hidden md:block text-xl font-display font-black text-[#0c2340] mb-4">Access Codes</h2>
            <CodesTab shop={shop} campaignId={null} campaignSlug={null} />
          </TabMount>

          <TabMount active={tab === "qr"}>
            <div className="md:hidden flex items-center gap-2 mb-3">
              <button
                onClick={() => setTab("overview")}
                className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg bg-white border border-[#0C2340]/10 text-[#0c2340] hover:bg-[#ECEFF5] min-h-[44px]"
              >
                ← Back
              </button>
              <h2 className="text-lg font-black text-[#0c2340]">Customer Hub</h2>
            </div>
            <h2 className="hidden md:block text-xl font-display font-black text-[#0c2340] mb-4">Customer Hub</h2>
            <CustomerHubTab shop={shop} onNavigate={setTab} />
          </TabMount>

          <TabMount active={tab === "messages"}>
            <div className="md:hidden flex items-center gap-2 mb-3">
              <button
                onClick={() => setTab("overview")}
                className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg bg-white border border-[#0C2340]/10 text-[#0c2340] hover:bg-[#ECEFF5] min-h-[44px]"
              >
                ← Back
              </button>
              <h2 className="text-lg font-black text-[#0c2340]">Marketing</h2>
            </div>
            <h2 className="hidden md:block text-xl font-display font-black text-[#0c2340] mb-4">Marketing</h2>
            <MarketingHub shop={shop} />
          </TabMount>

          <TabMount active={tab === "claims"}>
            <div className="md:hidden flex items-center gap-2 mb-3">
              <button
                onClick={() => setTab("overview")}
                className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg bg-white border border-[#0C2340]/10 text-[#0c2340] hover:bg-[#ECEFF5] min-h-[44px]"
              >
                ← Back
              </button>
              <h2 className="text-lg font-black text-[#0c2340]">Prize Claims</h2>
            </div>
            <h2 className="hidden md:block text-xl font-display font-black text-[#0c2340] mb-4">Prize Claims</h2>
            <ClaimsTab shop={shop} />
          </TabMount>
        </div>
      </div>

      {/* ── Mobile bottom nav ────────────────────────────────────────────── */}
      <BottomNavigation
        tab={tab}
        onSelect={setTab}
        onSignOut={signOut}
        superAdmin={superAdmin}
      />
    </div>
  );
}

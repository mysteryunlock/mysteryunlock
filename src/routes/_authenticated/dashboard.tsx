import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listMyShops, updateMyShop, createShop } from "@/lib/shops.functions";
import { MarketingHub } from "@/components/dashboard/MarketingHub";
import { TabMount } from "@/components/dashboard/TabMount";
import { SecondaryHeader } from "@/components/dashboard/SecondaryHeader";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
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
import type { Shop, TabKey } from "@/components/dashboard/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Mystery Unlock" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const fetchMyShops = useServerFn(listMyShops);
  const doCreateShop = useServerFn(createShop);
  const doUpdateShop = useServerFn(updateMyShop);
  const [shop, setShop] = useState<Shop | null>(null);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [ownerName, setOwnerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [customersView, setCustomersView] = useState<"crm" | "connections">("crm");
  const VALID_TABS: TabKey[] = ["overview", "campaign", "customers", "analytics", "settings", "codes", "qr", "messages", "claims"];
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
      if (res.superAdmin) {
        navigate({ to: "/super-admin" });
        return;
      }
      const list = res.shops as Shop[];
      setShop(list[0] ?? null);
    } catch {
      // Network/API failure — do NOT clear an already-loaded shop, and do not
      // fall through to the create-shop form. Surface a retry instead.
      setLoadErr(true);
    } finally {
      setLoading(false);
    }
  }, [fetchMyShops]);

  useEffect(() => { loadShop(); }, [loadShop]);
  useEffect(() => { if (typeof window !== "undefined") sessionStorage.setItem("mu_tab", tab); }, [tab]);

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
    return <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (loadErr && !shop) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[#0c2340] font-semibold">We couldn't load your dashboard.</p>
        <p className="text-sm text-[#6b7a93]">Check your connection and try again.</p>
        <div className="flex gap-2">
          <button onClick={loadShop} className="bg-[#FF6B1A] text-white font-semibold px-5 py-2.5 rounded-xl">Retry</button>
          <button onClick={signOut} className="bg-[#F5F7FA] text-[#0c2340] font-semibold px-5 py-2.5 rounded-xl">Sign out</button>
        </div>
      </div>
    );
  }

  if (!shop) {
    return <CreateShopForm onCreated={loadShop} onSignOut={signOut} doCreate={doCreateShop} />;
  }

  return (
    <div className="min-h-[100dvh] bg-white pb-28">
      <div className="px-4 sm:px-6 pt-5 max-w-5xl mx-auto">
        {/* Top: greeting + actions */}
        <DashboardHeader shop={shop} ownerName={ownerName} superAdmin={superAdmin} onSignOut={signOut} />

        <SubscriptionBanner />

        <TabMount active={tab === "overview"}>
          <OverviewTab shop={shop} onNavigate={setTab} />
        </TabMount>
        <TabMount active={tab === "campaign"}><CampaignHub shop={shop} onSaved={loadShop} doUpdate={doUpdateShop} superAdmin={superAdmin} onNavigateTab={setTab} /></TabMount>
        <TabMount active={tab === "customers"}>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setCustomersView("crm")}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                customersView === "crm" ? "bg-[#FF6B1A] text-white" : "bg-[#F5F7FA] text-[#0c2340]"
              }`}
            >
              Spin CRM
            </button>
            <button
              onClick={() => setCustomersView("connections")}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                customersView === "connections" ? "bg-[#FF6B1A] text-white" : "bg-[#F5F7FA] text-[#0c2340]"
              }`}
            >
              Connected Members
            </button>
          </div>
          {customersView === "crm" ? <CustomerCrm shop={shop} /> : <ShopConnectionsTab shop={shop} />}
        </TabMount>
        <TabMount active={tab === "analytics"}><StatsTab shop={shop} /></TabMount>
        <TabMount active={tab === "settings"}>
          <SettingsTab shop={shop} onSaved={loadShop} doUpdate={doUpdateShop} superAdmin={superAdmin} onSignOut={signOut} />
        </TabMount>

        {/* Secondary tabs (reached via quick actions) */}
        <TabMount active={tab === "codes"}>
          <SecondaryHeader title="Access Codes" onBack={() => setTab("overview")} />
          <CodesTab shop={shop} campaignId={null} campaignSlug={null} />
        </TabMount>
        <TabMount active={tab === "qr"}>
          <SecondaryHeader title="Customer Hub" onBack={() => setTab("overview")} />
          <CustomerHubTab shop={shop} onNavigate={setTab} />
        </TabMount>
        <TabMount active={tab === "messages"}>
          <SecondaryHeader title="Marketing" onBack={() => setTab("overview")} />
          <MarketingHub shop={shop} />
        </TabMount>
        <TabMount active={tab === "claims"}>
          <SecondaryHeader title="Prize Claims" onBack={() => setTab("overview")} />
          <ClaimsTab shop={shop} />
        </TabMount>
      </div>

      {/* Bottom nav */}
      <BottomNavigation tab={tab} onSelect={setTab} />
    </div>
  );
}

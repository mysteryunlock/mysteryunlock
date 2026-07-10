import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getShopByConnectCodeFn, connectToShopFn } from "@/lib/shop-connections.functions";

export const Route = createFileRoute("/connect/$code")({
  head: () => ({ meta: [{ title: "Connect — Mystery Unlock" }] }),
  component: ConnectPage,
});

type PublicShop = { id: string; name: string; slug: string; logo_url: string | null };

function ConnectPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const fetchShop = useServerFn(getShopByConnectCodeFn);
  const connectToShop = useServerFn(connectToShopFn);

  const [shop, setShop] = useState<PublicShop | null | undefined>(undefined);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectedMsg, setConnectedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [shopRes, sessionRes] = await Promise.allSettled([
      fetchShop({ data: { code } }),
      supabase.auth.getSession(),
    ]);

    if (shopRes.status === "fulfilled") {
      setShop(shopRes.value.shop);
    } else {
      setShop(null);
    }

    if (sessionRes.status === "fulfilled") {
      setIsLoggedIn(!!sessionRes.value.data.session);
    } else {
      setIsLoggedIn(false);
    }
  }, [fetchShop, code]);

  useEffect(() => { load(); }, [load]);

  const onConnect = async () => {
    if (!isLoggedIn) {
      try { sessionStorage.setItem("mu_pending_connect", code); } catch {}
      navigate({ to: "/customer-auth" });
      return;
    }
    setConnecting(true);
    setErrorMsg(null);
    try {
      const res = await connectToShop({ data: { code } });
      setConnectedMsg(`You're now connected to ${res.shop.name}!`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not connect. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  if (shop === undefined || isLoggedIn === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-8 animate-pulse h-64" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-8 text-center space-y-3">
          <p className="text-2xl">🔍</p>
          <p className="font-bold text-foreground">Shop not found</p>
          <p className="text-sm text-muted-foreground">This code is invalid or the shop is no longer active.</p>
          <Link to="/" className="inline-block mt-2 text-sm font-semibold text-gold hover:underline">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-sm p-8 text-center space-y-5 animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-2xl gradient-primary flex items-center justify-center text-white overflow-hidden shadow-sm">
          {shop.logo_url ? (
            <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
          ) : (
            <Store className="w-8 h-8" />
          )}
        </div>
        <div>
          <p className="font-bold text-xl text-foreground">{shop.name}</p>
          <p className="text-sm text-muted-foreground mt-1">Connect to become a member and get updates</p>
        </div>

        {connectedMsg ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground bg-gold/10 border border-gold/30 rounded-xl px-4 py-3">
              {connectedMsg}
            </p>
            <Link
              to="/portal/shops"
              className="inline-block w-full px-5 py-3 rounded-xl gradient-primary text-white text-sm font-bold shadow-sm hover:opacity-90 transition"
            >
              View My Shops
            </Link>
          </div>
        ) : (
          <>
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            <button
              type="button"
              onClick={onConnect}
              disabled={connecting}
              className="w-full px-5 py-3 rounded-xl gradient-primary text-white text-sm font-bold shadow-sm hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60"
            >
              {connecting ? "Connecting…" : isLoggedIn ? "Connect" : "Sign in to Connect"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

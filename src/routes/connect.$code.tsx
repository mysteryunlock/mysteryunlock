import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Disc3, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getShopByConnectCodeFn,
  connectToShopFn,
  checkShopConnectionFn,
} from "@/lib/shop-connections.functions";

export const Route = createFileRoute("/connect/$code")({
  head: () => ({ meta: [{ title: "Connect — Mystery Unlock" }] }),
  component: ConnectPage,
});

type PublicShop = { id: string; name: string; slug: string; logo_url: string | null };
type PageState =
  | "loading"
  | "not-found"
  | "unauthenticated"
  | "not-connected"
  | "already-connected"
  | "just-connected";

function ConnectPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const fetchShop = useServerFn(getShopByConnectCodeFn);
  const connectToShop = useServerFn(connectToShopFn);
  const checkConnection = useServerFn(checkShopConnectionFn);

  const [shop, setShop] = useState<PublicShop | null | undefined>(undefined);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPageState("loading");
    const [shopRes, sessionRes] = await Promise.allSettled([
      fetchShop({ data: { code } }),
      supabase.auth.getSession(),
    ]);

    const shopData = shopRes.status === "fulfilled" ? shopRes.value.shop : null;
    const session = sessionRes.status === "fulfilled" ? sessionRes.value.data.session : null;

    if (!shopData) {
      setShop(null);
      setPageState("not-found");
      return;
    }

    setShop(shopData);

    if (!session) {
      setPageState("unauthenticated");
      return;
    }

    try {
      const { connected } = await checkConnection({ data: { code } });
      setPageState(connected ? "already-connected" : "not-connected");
    } catch {
      setPageState("not-connected");
    }
  }, [fetchShop, checkConnection, code]);

  useEffect(() => { load(); }, [load]);

  const onSignIn = () => {
    try { sessionStorage.setItem("mu_pending_connect", code); } catch {}
    navigate({ to: "/customer-auth" });
  };

  const onConnect = async () => {
    if (!shop) return;
    setConnecting(true);
    setErrorMsg(null);
    try {
      await connectToShop({ data: { code } });
      setPageState("just-connected");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not connect. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-8 animate-pulse h-64" />
      </div>
    );
  }

  if (pageState === "not-found") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-8 text-center space-y-3">
          <p className="text-2xl">🔍</p>
          <p className="font-bold text-foreground">Shop not found</p>
          <p className="text-sm text-muted-foreground">
            This code is invalid or the shop is no longer active.
          </p>
          <Link to="/" className="inline-block mt-2 text-sm font-semibold text-gold hover:underline">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  const shopObj = shop!;
  const spinUrl = `/s/${shopObj.slug}`;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-sm p-8 text-center space-y-5 animate-fade-in">

        {/* Shop logo / icon */}
        <div className="w-16 h-16 mx-auto rounded-2xl gradient-primary flex items-center justify-center text-white overflow-hidden shadow-sm">
          {shopObj.logo_url ? (
            <img src={shopObj.logo_url} alt={shopObj.name} className="w-full h-full object-cover" />
          ) : (
            <Store className="w-8 h-8" />
          )}
        </div>

        {/* Shop name */}
        <div>
          <p className="font-bold text-xl text-foreground">{shopObj.name}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {pageState === "already-connected" || pageState === "just-connected"
              ? "You're a connected member of this shop"
              : "Connect to become a member and get updates"}
          </p>
        </div>

        {/* State-specific UI */}
        {pageState === "unauthenticated" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onSignIn}
              className="w-full px-5 py-3 rounded-xl gradient-primary text-white text-sm font-bold shadow-sm hover:opacity-90 active:scale-[0.98] transition"
            >
              Sign in to Connect
            </button>
            <Link
              to={spinUrl}
              className="block w-full px-5 py-3 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-muted/40 transition"
            >
              <span className="flex items-center justify-center gap-2">
                <Disc3 className="w-4 h-4 text-gold" />
                Spin &amp; Win
              </span>
            </Link>
          </div>
        )}

        {pageState === "not-connected" && (
          <div className="space-y-3">
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            <button
              type="button"
              onClick={onConnect}
              disabled={connecting}
              className="w-full px-5 py-3 rounded-xl gradient-primary text-white text-sm font-bold shadow-sm hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60"
            >
              {connecting ? "Joining…" : "Join This Shop"}
            </button>
            <Link
              to={spinUrl}
              className="block w-full px-5 py-3 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-muted/40 transition"
            >
              <span className="flex items-center justify-center gap-2">
                <Disc3 className="w-4 h-4 text-gold" />
                Spin &amp; Win
              </span>
            </Link>
          </div>
        )}

        {pageState === "just-connected" && (
          <div className="space-y-3">
            <div className="rounded-xl bg-gold/10 border border-gold/30 px-4 py-3 text-sm font-semibold text-foreground">
              🎉 You've joined {shopObj.name}!
            </div>
            <Link
              to={spinUrl}
              className="block w-full px-5 py-3 rounded-xl gradient-primary text-white text-sm font-bold shadow-sm hover:opacity-90 transition"
            >
              <span className="flex items-center justify-center gap-2">
                <Disc3 className="w-4 h-4" />
                Spin &amp; Win
              </span>
            </Link>
            <Link
              to="/portal/shops"
              className="block w-full px-5 py-2 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-muted/40 transition"
            >
              View My Shops
            </Link>
          </div>
        )}

        {pageState === "already-connected" && (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700">
              ✓ You're already a member
            </div>
            <Link
              to={spinUrl}
              className="block w-full px-5 py-3 rounded-xl gradient-primary text-white text-sm font-bold shadow-sm hover:opacity-90 transition"
            >
              <span className="flex items-center justify-center gap-2">
                <Disc3 className="w-4 h-4" />
                Spin &amp; Win
              </span>
            </Link>
            <Link
              to="/portal/shops"
              className="block w-full px-5 py-2 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-muted/40 transition"
            >
              View My Shops
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}

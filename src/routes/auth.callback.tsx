import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { createShop } from "@/lib/shops.functions";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Setting up — Mystery Unlock" },
    ],
  }),
  component: AuthCallbackPage,
});

function autoSlug(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

type Stage = "loading" | "setup" | "creating" | "error";

function AuthCallbackPage() {
  const navigate = useNavigate();
  const doCreateShop = useServerFn(createShop);

  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let handled = false;

    const handleSession = async (session: Session) => {
      if (handled) return;
      handled = true;

      try {
        // Check if this user already has a shop
        const { data: shop } = await supabase
          .from("shops")
          .select("id")
          .eq("owner_user_id", session.user.id)
          .maybeSingle();

        if (shop) {
          // Returning user — go straight to dashboard
          navigate({ to: "/dashboard" });
        } else {
          // New Google user — needs to set up a shop
          setStage("setup");
        }
      } catch {
        setErrorMsg("We couldn't complete sign-in. Please try again.");
        setStage("error");
      }
    };

    // Listen for SIGNED_IN fired by the PKCE code exchange completing.
    // This is the reliable way to catch OAuth callbacks on all browsers/speeds.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
        handleSession(session);
      }
    });

    // Also check immediately — the exchange may have already completed (fast connections
    // or existing session restored from localStorage).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) handleSession(data.session);
      // else: wait for onAuthStateChange to fire when PKCE exchange finishes
    });

    // Safety timeout — if nothing fires after 10s, surface a graceful error
    const timer = setTimeout(() => {
      if (!handled) {
        handled = true;
        setErrorMsg("Sign-in timed out. Please try again.");
        setStage("error");
      }
    }, 10_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [navigate]);

  const onSetupShop = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedSlug = slugTouched ? autoSlug(slug) : autoSlug(shopName);
    if (!shopName.trim()) return;
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(resolvedSlug)) {
      setErrorMsg("Shop URL can only use lowercase letters, numbers and dashes");
      return;
    }
    setStage("creating");
    setErrorMsg("");
    try {
      await doCreateShop({ data: { name: shopName.trim(), slug: resolvedSlug } });
      navigate({ to: "/dashboard" });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not create your shop — please try again");
      setStage("setup");
    }
  };

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm border-2 outline-none transition-all";
  const fo = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#ff6b1a"; };
  const fb = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#D6E6EF"; };
  const displayedSlug = slugTouched ? slug : autoSlug(shopName);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12" style={{ background: "#F7FBFD" }}>
      <div className="flex items-center gap-3 mb-8">
        <img src={DEFAULT_LOGO} alt="" className="w-10 h-10 rounded-xl object-cover ring-1 ring-black/10" />
        <div>
          <div className="text-base font-black tracking-wider" style={{ color: "#2A3E4B", fontFamily: "'Space Grotesk', sans-serif" }}>MYSTERY UNLOCK</div>
          <div className="text-xs tracking-[0.2em] uppercase" style={{ color: "#ff6b1a" }}>Shop Owner Portal</div>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-black/5 border p-8" style={{ borderColor: "#2A3E4B0f" }}>

        {/* Loading */}
        {stage === "loading" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#ff6b1a" }} />
            <p className="text-sm font-medium" style={{ color: "#2A3E4B99" }}>Signing you in…</p>
          </div>
        )}

        {/* Error */}
        {stage === "error" && (
          <div className="flex flex-col items-center gap-5 py-4 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#fee2e2" }}>
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#2A3E4B" }}>Sign-in failed</h2>
              <p className="text-sm mt-1" style={{ color: "#2A3E4B80" }}>{errorMsg}</p>
            </div>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 text-sm font-semibold hover:opacity-70 transition-opacity"
              style={{ color: "#ff6b1a" }}
            >
              <ArrowLeft className="w-4 h-4" /> Try again
            </Link>
          </div>
        )}

        {/* Shop setup for new Google users */}
        {(stage === "setup" || stage === "creating") && (
          <form onSubmit={onSetupShop} className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-2xl font-black tracking-tight" style={{ color: "#2A3E4B", fontFamily: "'Space Grotesk', sans-serif" }}>
                One last step
              </h2>
              <p className="text-sm mt-1.5" style={{ color: "#2A3E4B80" }}>
                Give your spin-to-win campaign a name to get started.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2A3E4B80" }}>Shop name</label>
              <input
                value={shopName}
                onChange={(e) => {
                  const nextName = e.target.value;
                  setShopName(nextName);
                  if (!slugTouched) setSlug(autoSlug(nextName));
                  setErrorMsg("");
                }}
                placeholder="My Mobile Shop"
                maxLength={80}
                required
                autoFocus
                className={inputCls}
                style={{ background: "#F7FBFD", borderColor: "#D6E6EF", color: "#2A3E4B" }}
                onFocus={fo} onBlur={fb}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2A3E4B80" }}>Shop URL</label>
              <div
                className="flex items-center rounded-xl px-4 py-3 border-2 transition-all"
                style={{ background: "#F7FBFD", borderColor: "#D6E6EF" }}
                onFocusCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#ff6b1a"}
                onBlurCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#D6E6EF"}
              >
                <span className="text-sm mr-1" style={{ color: "#2A3E4B50" }}>/s/</span>
                <input
                  value={displayedSlug}
                  onChange={(e) => { setSlugTouched(true); setSlug(autoSlug(e.target.value)); }}
                  placeholder="my-mobile-shop"
                  maxLength={40}
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "#2A3E4B" }}
                />
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{errorMsg}</div>
            )}

            <button
              type="submit"
              disabled={stage === "creating" || !shopName.trim()}
              className="w-full font-bold py-3.5 rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #ff6b1a, #ff8c42)", color: "white", boxShadow: "0 8px 24px #ff6b1a40" }}
            >
              {stage === "creating" && <Loader2 className="w-4 h-4 animate-spin" />}
              {stage === "creating" ? "Creating your shop…" : "Create shop & go to dashboard"}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}
                className="text-xs hover:underline transition-opacity"
                style={{ color: "#2A3E4B60" }}
              >
                Cancel and sign out
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

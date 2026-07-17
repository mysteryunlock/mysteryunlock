import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getPublicShop } from "@/lib/shops.functions";
import { validateAccessCode } from "@/lib/access-codes.functions";
import { listPublicCampaigns } from "@/lib/campaigns.functions";
import { getMyProfileFn } from "@/lib/customer-auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { playClick } from "@/lib/sounds";
import { parseServerValidationError } from "@/lib/utils";
import { codeChars, slugSchema } from "@/lib/validation";

const entrySearch = z.object({
  code: codeChars.optional(),
  c: slugSchema.optional(),
});

const phoneRe = /^[+\d][\d\s\-()]{4,29}$/;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/s/$slug/")({
  validateSearch: entrySearch,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Mystery Unlock` },
      { name: "description", content: `Enter your access code to spin and win.` },
    ],
  }),
  component: ShopEntry,
  errorComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Could not load this shop.
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Shop not found or unavailable.
    </div>
  ),
});

function ShopEntry() {
  const { slug } = Route.useParams();
  const { code: prefillCode, c: campaignSlug } = Route.useSearch();
  const navigate = useNavigate();
  const fetchShop = useServerFn(getPublicShop);
  const validate = useServerFn(validateAccessCode);
  const fetchCampaigns = useServerFn(listPublicCampaigns);
  const fetchProfile = useServerFn(getMyProfileFn);

  const shopQuery = useQuery({
    queryKey: ["public-shop", slug],
    queryFn: async () => (await fetchShop({ data: { slug } })).shop,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const campaignsQ = useQuery({
    queryKey: ["public-campaigns", slug],
    queryFn: async () => (await fetchCampaigns({ data: { slug } })).campaigns,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  // ── Portal customer session check ─────────────────────────────────────────
  // If the visitor already has an active customer session, we hide the
  // name/phone/email fields and let them spin with just the access code.
  type PortalCustomer = { email: string; name: string | null; phone: string | null };
  const [portalCustomer, setPortalCustomer] = useState<PortalCustomer | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setSessionChecked(true); return; }
        // Session found — verify it belongs to a customer (not a shop owner).
        try {
          const res = await fetchProfile({ data: {} });
          setPortalCustomer({
            email: res.customer.email ?? "",
            name:  res.customer.name  ?? null,
            phone: res.customer.phone ?? null,
          });
        } catch {
          // Session belongs to a shop owner or other non-customer user.
        }
      } catch {
        // No session.
      } finally {
        setSessionChecked(true);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public-visitor form state (only used when not a portal customer) ──────
  const [code,    setCode]    = useState(prefillCode?.toUpperCase() ?? "");
  const [name,    setName]    = useState("");
  const [contact, setContact] = useState("");
  const [email,   setEmail]   = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [codeStatus, setCodeStatus] = useState<
    | { state: "idle" }
    | { state: "checking" }
    | { state: "valid" }
    | { state: "invalid" }
    | { state: "used"; date: string | null }
  >({ state: "idle" });

  useEffect(() => {
    if (prefillCode) setCode(prefillCode.toUpperCase());
  }, [prefillCode]);

  useEffect(() => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || !/^[A-Z0-9-]+$/.test(trimmed) || trimmed.length < 4) {
      setCodeStatus({ state: "idle" });
      return;
    }
    setCodeStatus({ state: "checking" });
    const handle = setTimeout(async () => {
      try {
        const res = await validate({ data: { slug, code: trimmed, ...(campaignSlug ? { campaignSlug } : {}) } });
        if (res.ok) setCodeStatus({ state: "valid" });
        else if (res.reason === "used") setCodeStatus({ state: "used", date: res.spun_at ?? null });
        else setCodeStatus({ state: "invalid" });
      } catch {
        setCodeStatus({ state: "idle" });
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [code, slug, campaignSlug, validate]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submit = async () => {
    playClick();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return setError("Please enter your access code");
    if (!/^[A-Z0-9-]+$/.test(trimmed)) return setError("Code can only contain letters, numbers, dashes");

    // Public visitor: validate name/contact/email fields.
    let trimmedName = "";
    let trimmedContact = "";
    let trimmedEmail = "";
    if (!portalCustomer) {
      trimmedName = name.trim();
      if (!trimmedName) return setError("Please enter your name");
      if (trimmedName.length > 40) return setError("Name is too long");
      trimmedContact = contact.trim();
      if (trimmedContact && !phoneRe.test(trimmedContact)) return setError("Please enter a valid contact number");
      trimmedEmail = email.trim();
      if (trimmedEmail && !emailRe.test(trimmedEmail)) return setError("Please enter a valid email address");
    }

    setLoading(true);
    setError("");
    try {
      const res = await validate({ data: { slug, code: trimmed, ...(campaignSlug ? { campaignSlug } : {}) } });
      if (!res.ok) {
        setError("This code is invalid or has already been used.");
        setLoading(false);
        return;
      }

      // Choose the interaction route based on the campaign's game_type.
      // Defaults to "spin" when game_type is absent (existing campaigns).
      const camList = campaignsQ.data ?? [];
      const activeCam = campaignSlug
        ? camList.find((c) => c.slug === campaignSlug)
        : camList.find((c) => c.is_default) ?? camList[0];
      const gameType = (activeCam?.theme as { game_type?: string } | null)?.game_type;
      const interactionRoute = gameType === "scratch"
        ? "/s/$slug/scratch" as const
        : "/s/$slug/spin"    as const;

      if (portalCustomer) {
        // Authenticated customer flow.
        // Pass email and name invisibly so spinAndRecord can record ownership
        // in access_codes.customer_email — this allows createPrizeClaimFn to
        // verify the spin belongs to this customer when saving the prize.
        navigate({
          to: interactionRoute,
          params: { slug },
          search: {
            code:   res.code,
            portal: "1",
            email:  portalCustomer.email,
            ...(portalCustomer.name ? { name:    portalCustomer.name } : {}),
            ...(campaignSlug        ? { c:       campaignSlug        } : {}),
          },
        });
      } else {
        // Public visitor flow.
        navigate({
          to: interactionRoute,
          params: { slug },
          search: {
            code: res.code,
            name: trimmedName,
            ...(campaignSlug   ? { c:       campaignSlug   } : {}),
            ...(trimmedContact ? { contact: trimmedContact } : {}),
            ...(trimmedEmail   ? { email:   trimmedEmail   } : {}),
          },
        });
      }
    } catch (err) {
      setError(parseServerValidationError(err) ?? "Could not verify your code. Please try again.");
      setLoading(false);
    }
  };

  // ── Early returns ──────────────────────────────────────────────────────────
  if (shopQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!shopQuery.data) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Shop not found or unavailable.</div>;
  }
  const shop = shopQuery.data;
  const logo = shop.logo_url || DEFAULT_LOGO;

  // Campaign picker: when there are 2+ active campaigns and no `?c=` chosen yet.
  const campaigns = campaignsQ.data ?? [];
  const showPicker = !campaignSlug && campaigns.length > 1;

  if (showPicker) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
        <img src={logo} alt={shop.name} className="w-32 h-32 rounded-full object-cover border-2 border-[var(--gold)]/70 mb-6" />
        <h1 className="text-2xl font-black tracking-[0.18em] text-center uppercase">{shop.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a campaign to spin</p>
        <div className="mt-8 w-full max-w-sm grid gap-3">
          {campaigns.map((c) => {
            const accent = (c.theme as { accent?: string } | null)?.accent || "#1f3460";
            return (
              <button
                key={c.id}
                onClick={() => { playClick(); navigate({ to: "/s/$slug", params: { slug }, search: { c: c.slug } }); }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-[#0c2340]/10 shadow-sm hover:shadow-md transition text-left"
              >
                <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-xl" style={{ background: accent }}>
                  {(c.theme as { game_type?: string } | null)?.game_type === "scratch" ? "🎟" : "🎡"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#0c2340] truncate">{c.name}</p>
                  <p className="text-xs text-[#4a5b78] truncate">
                    {(c.theme as { game_type?: string } | null)?.game_type === "scratch" ? "Scratch Card" : "Spin Wheel"} · /{c.slug}
                  </p>
                </div>
                <span className="text-[#FF6B00] font-bold">→</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const selectedCampaign = campaignSlug ? campaigns.find((c) => c.slug === campaignSlug) : campaigns.find((c) => c.is_default);
  const selectedGameType = (selectedCampaign?.theme as { game_type?: string } | null)?.game_type;
  const isScratchGame    = selectedGameType === "scratch";

  const campaignNotFound =
    !!campaignSlug && !campaignsQ.isLoading && campaignsQ.data !== undefined && !selectedCampaign;

  if (campaignNotFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 text-center gap-4">
        <img src={logo} alt={shop.name} className="w-24 h-24 rounded-full object-cover border-2 border-[var(--gold)]/70" />
        <h1 className="text-2xl font-black tracking-[0.18em] uppercase">{shop.name}</h1>
        <p className="text-2xl mt-2">🔍</p>
        <p className="font-bold text-foreground text-lg">Campaign not found</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          The campaign link you used is no longer active or doesn't exist.
        </p>
        <button
          onClick={() => navigate({ to: "/s/$slug", params: { slug }, search: {} })}
          className="mt-4 gradient-primary text-[#0F1115] font-bold py-3 px-8 rounded-xl glow-orange"
        >
          Go to Main Page
        </button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="relative animate-pulse-glow rounded-full mb-8">
        <img
          src={logo}
          alt={shop.name}
          className="w-44 h-44 rounded-full object-cover border-2 border-[var(--gold)]/70"
          draggable={false}
        />
      </div>
      <h1 className="text-3xl font-black tracking-[0.18em] text-center uppercase">{shop.name}</h1>
      <p className="mt-2 text-sm tracking-[0.32em] text-gold uppercase">
        {selectedCampaign?.name ?? "Mystery Unlock Campaign"}
      </p>
      {!campaignsQ.isLoading && selectedCampaign && (
        <div className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-full border ${isScratchGame ? "bg-purple-500/10 border-purple-500/20" : "bg-sky-500/10 border-sky-500/20"}`}>
          <span className="text-base leading-none">{isScratchGame ? "🎟" : "🎡"}</span>
          <span className={`text-sm font-semibold ${isScratchGame ? "text-purple-300" : "text-sky-300"}`}>
            {isScratchGame ? "Scratch Card" : "Spin Wheel"}
          </span>
        </div>
      )}
      {campaigns.length > 1 && (
        <button
          onClick={() => navigate({ to: "/s/$slug", params: { slug }, search: {} })}
          className="mt-2 text-xs text-[#4a5b78] underline"
        >
          Choose different campaign
        </button>
      )}

      {/* Session check skeleton */}
      {!sessionChecked && (
        <div className="glass rounded-2xl p-5 mt-10 w-full max-w-sm animate-float-up space-y-4">
          <div className="h-12 bg-[#F5F7FA] rounded-xl animate-pulse" />
          <div className="h-12 bg-[#F5F7FA] rounded-xl animate-pulse" />
        </div>
      )}

      {/* Main form — only shown once session check is complete */}
      {sessionChecked && (
        <div className="glass rounded-2xl p-5 mt-10 w-full max-w-sm animate-float-up">

          {/* ── Portal customer: signed-in banner ─── */}
          {portalCustomer && (
            <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 shrink-0">
                {(portalCustomer.name || portalCustomer.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-800 truncate">
                  {portalCustomer.name || portalCustomer.email}
                </p>
                <p className="text-[11px] text-emerald-600 truncate">Signed in · enter your access code to spin</p>
              </div>
            </div>
          )}

          {/* ── Public visitor fields ─── */}
          {!portalCustomer && (
            <>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Your Name</label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Enter your full name"
                maxLength={40}
                className="mt-2 w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 text-base text-[#0c2340] placeholder:text-[#0c2340]/50 outline-none focus:border-[#ff6b1a]"
              />

              <label className="text-xs uppercase tracking-widest text-muted-foreground mt-4 block">Contact Number</label>
              <input
                value={contact}
                onChange={(e) => { setContact(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Enter your contact number"
                inputMode="tel"
                maxLength={30}
                className="mt-2 w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 text-base text-[#0c2340] placeholder:text-[#0c2340]/50 outline-none focus:border-[#ff6b1a]"
              />

              <label className="text-xs uppercase tracking-widest text-muted-foreground mt-4 block">Email Address</label>
              <input
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Enter your email address"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={255}
                className="mt-2 w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 text-base text-[#0c2340] placeholder:text-[#0c2340]/50 outline-none focus:border-[#ff6b1a]"
              />
            </>
          )}

          {/* ── Access code (always shown) ─── */}
          <label className={`text-xs uppercase tracking-widest text-muted-foreground ${portalCustomer ? "" : "mt-4"} block`}>
            Access Code
          </label>
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Access code"
            maxLength={32}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="mt-2 w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 text-base tracking-widest text-center font-mono text-[#0c2340] placeholder:text-[#0c2340]/50 outline-none focus:border-[#ff6b1a]"
          />
          {codeStatus.state === "checking" && (
            <p className="mt-2 text-xs text-center text-muted-foreground">Checking code…</p>
          )}
          {codeStatus.state === "valid" && (
            <p className="mt-2 text-xs text-center text-emerald-600 font-semibold">
              ✓ Code is valid — ready to {isScratchGame ? "scratch" : "spin"}
            </p>
          )}
          {codeStatus.state === "invalid" && (
            <p className="mt-2 text-xs text-center text-destructive font-semibold">✗ This code is not recognized</p>
          )}
          {codeStatus.state === "used" && (
            <p className="mt-2 text-xs text-center text-destructive font-semibold">
              ✗ This code was already used{codeStatus.date ? ` on ${new Date(codeStatus.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}` : ""}
            </p>
          )}
          {error && <p className="text-destructive text-sm mt-2 text-center">{error}</p>}

          <button
            onClick={submit}
            disabled={loading}
            className="mt-5 w-full gradient-primary text-[#0F1115] font-bold text-lg py-4 rounded-xl glow-orange active:scale-[0.98] transition disabled:opacity-60"
          >
            {loading ? "VERIFYING..." : "SUBMIT"}
          </button>
          <p className="mt-3 text-[11px] text-muted-foreground text-center">Each code can be used only once.</p>
        </div>
      )}
    </div>
  );
}

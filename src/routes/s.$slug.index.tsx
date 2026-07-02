import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getPublicShop } from "@/lib/shops.functions";
import { validateAccessCode } from "@/lib/access-codes.functions";
import { listPublicCampaigns } from "@/lib/campaigns.functions";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { playClick } from "@/lib/sounds";

const entrySearch = z.object({
  code: z.string().min(1).max(64).optional(),
  c: z.string().min(1).max(40).optional(),
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

  const [code, setCode] = useState(prefillCode?.toUpperCase() ?? "");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
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

  if (shopQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!shopQuery.data) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Shop not found or unavailable.</div>;
  }
  const shop = shopQuery.data;
  const logo = shop.logo_url || DEFAULT_LOGO;

  // Campaign picker: when there are 2+ active campaigns and no `?c=` chosen yet, show a picker.
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
                <div className="w-10 h-10 rounded-full shrink-0" style={{ background: accent }} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#0c2340] truncate">{c.name}</p>
                  <p className="text-xs text-[#4a5b78] truncate">/{c.slug}</p>
                </div>
                <span className="text-[#FF6B00] font-bold">→</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const submit = async () => {
    playClick();
    const trimmedName = name.trim();
    if (!trimmedName) return setError("Please enter your name");
    if (trimmedName.length > 40) return setError("Name is too long");
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return setError("Please enter your access code");
    if (!/^[A-Z0-9-]+$/.test(trimmed)) return setError("Code can only contain letters, numbers, dashes");
    const trimmedContact = contact.trim();
    if (trimmedContact && !phoneRe.test(trimmedContact)) return setError("Please enter a valid contact number");
    const trimmedEmail = email.trim();
    if (trimmedEmail && !emailRe.test(trimmedEmail)) return setError("Please enter a valid email address");
    setLoading(true);
    setError("");
    try {
      const res = await validate({ data: { slug, code: trimmed, ...(campaignSlug ? { campaignSlug } : {}) } });
      if (!res.ok) {
        setError("This code is invalid or has already been used.");
        setLoading(false);
        return;
      }
      navigate({
        to: "/s/$slug/spin",
        params: { slug },
        search: {
          code: res.code,
          name: trimmedName,
          ...(campaignSlug ? { c: campaignSlug } : {}),
          ...(trimmedContact ? { contact: trimmedContact } : {}),
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
        },
      });
    } catch {
      setError("Could not verify your code. Please try again.");
      setLoading(false);
    }
  };

  const selectedCampaign = campaignSlug ? campaigns.find((c) => c.slug === campaignSlug) : campaigns.find((c) => c.is_default);

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
      {campaigns.length > 1 && (
        <button
          onClick={() => navigate({ to: "/s/$slug", params: { slug }, search: {} })}
          className="mt-2 text-xs text-[#4a5b78] underline"
        >
          Choose different campaign
        </button>
      )}

      <div className="glass rounded-2xl p-5 mt-10 w-full max-w-sm animate-float-up">
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

        <label className="text-xs uppercase tracking-widest text-muted-foreground mt-4 block">Access Code</label>
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
          <p className="mt-2 text-xs text-center text-emerald-600 font-semibold">✓ Code is valid — ready to spin</p>
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
    </div>
  );
}

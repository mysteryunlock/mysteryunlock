import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { InstallAppButton } from "@/components/InstallAppButton";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { playClick, playWin, playLose, startSpinTicks } from "@/lib/sounds";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { listActivePlans } from "@/lib/plans.functions";
import { getSiteSettings } from "@/lib/site-settings.functions";
import { Hero } from "@/components/landing/Hero";
import { WhyChooseUs } from "@/components/landing/WhyChooseUs";
import { HowItWorks } from "@/components/landing/HowItWorks";

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {}
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mystery Unlock — Premium spin-to-win campaigns for modern shops" },
      {
        name: "description",
        content:
          "Run elegant spin-to-win campaigns. Brand your wheel, share a QR, and watch every win in a beautiful dashboard.",
      },
      { property: "og:title", content: "Mystery Unlock — Spin · Win · Enjoy" },
      {
        property: "og:description",
        content:
          "Premium spin-to-win SaaS for boutique shops. Brand, share, and track campaigns customers remember.",
      },
    ],
  }),
  loader: async () => {
    try {
      const [plansRes, settingsRes] = await Promise.allSettled([
        listActivePlans(),
        getSiteSettings(),
      ]);
      return {
        plans: plansRes.status === "fulfilled" ? (plansRes.value.plans ?? []) : [],
        settings: settingsRes.status === "fulfilled" ? settingsRes.value.settings : {},
      };
    } catch {
      return { plans: [], settings: {} };
    }
  },
  staleTime: 0,
  component: Landing,
});


// Brand palette
const C = {
  bg: "#F7FBFD",
  light: "#D6E6EF",
  primary: "#7FA6B8",
  primaryDark: "#5e8a9e",
  dark: "#2A3E4B",
};

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="rounded-2xl bg-white overflow-hidden flex items-center justify-center ring-1 ring-[#2A3E4B]/10 shadow-sm"
      style={{ width: size, height: size }}
    >
      <img src={DEFAULT_LOGO} alt="Mystery Unlock" className="w-full h-full object-contain" />
    </div>
  );
}

const DEMO_PRIZES = [
  "Rs.2000 Cash",
  "Bass Earphones",
  "Try Again",
  "Ultima Watch",
  "Rs.1000 Cash",
  "Kick AirBuds",
  "Rs.100 Cash",
  "Cooler Fan",
];

function WheelVisual({ reducedMotion }: { reducedMotion: boolean }) {
  const SEG_COUNT = DEMO_PRIZES.length;
  const SEG = 360 / SEG_COUNT;
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<string | null>(null);
  const [prizes, setPrizes] = useState<string[]>(DEMO_PRIZES);
  const rotationRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const cancelTicksRef = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (cancelTicksRef.current) cancelTicksRef.current();
  }, []);

  const size = 360;
  const r = size / 2;
  const cx = r, cy = r;
  const textR = r * 0.7;

  const segments = useMemo(() => {
    return Array.from({ length: SEG_COUNT }).map((_, i) => {
      const centerAngle = i * SEG;
      const a1 = (centerAngle - SEG / 2 - 90) * Math.PI / 180;
      const a2 = (centerAngle + SEG / 2 - 90) * Math.PI / 180;
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2);
      const y2 = cy + r * Math.sin(a2);
      const isDark = i % 2 === 0;
      const tx = cx + textR * Math.cos((centerAngle - 90) * Math.PI / 180);
      const ty = cy + textR * Math.sin((centerAngle - 90) * Math.PI / 180);
      return {
        path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`,
        isDark,
        tx,
        ty,
        rotate: centerAngle + 90,
      };
    });
  }, [SEG_COUNT, SEG, cx, cy, r, textR]);

  const shortLabel = (name: string) => {
    if (/cash/i.test(name)) return name.replace(/\s*Cash/i, "").replace("Rs.", "₨");
    return name.split(" ")[0];
  };

  const SPIN_DURATION = reducedMotion ? 1200 : 5200;
  const SPIN_EASING = reducedMotion ? "ease-out" : "cubic-bezier(0.16, 1, 0.3, 1)";
  const EXTRA_ROTATIONS = reducedMotion ? 1 : 6;

  const handleSpin = () => {
    if (spinning) return;
    const reshuffled = shuffle(DEMO_PRIZES);
    setPrizes(reshuffled);
    setWonPrize(null);
    setSpinning(true);

    if (!reducedMotion) {
      playClick();
      vibrate(25);
      if (cancelTicksRef.current) cancelTicksRef.current();
      cancelTicksRef.current = startSpinTicks(SPIN_DURATION);
    }

    const targetIndex = Math.floor(Math.random() * SEG_COUNT);
    const center = targetIndex * SEG;
    const base = ((360 - center) % 360 + 360) % 360;
    const current = rotationRef.current;
    const currentMod = ((current % 360) + 360) % 360;
    const delta = ((base - currentMod) + 360) % 360;
    const next = current + EXTRA_ROTATIONS * 360 + delta;
    rotationRef.current = next;
    setRotation(next);
    timerRef.current = window.setTimeout(() => {
      setSpinning(false);
      const prize = reshuffled[targetIndex];
      setWonPrize(prize);
      if (!reducedMotion) {
        if (prize === "Try Again") {
          playLose();
          vibrate([60, 40, 60]);
        } else {
          playWin();
          vibrate([30, 50, 30, 50, 120]);
        }
      }
    }, SPIN_DURATION);
  };

  return (
    <div className="relative w-full max-w-[460px] aspect-square mx-auto">
      {!reducedMotion && (
        <div
          aria-hidden
          className="absolute -inset-8 rounded-full pointer-events-none opacity-60"
          style={{ background: `radial-gradient(circle, ${C.primary}55, transparent 65%)`, filter: "blur(20px)" }}
        />
      )}
      <div
        className="absolute inset-0 rounded-full p-[3%]"
        style={{
          background: `linear-gradient(135deg, ${C.dark}, ${C.primary})`,
          boxShadow: `0 40px 100px -25px ${C.dark}66, 0 0 0 1px ${C.dark}10`,
        }}
      >
        <div className="w-full h-full rounded-full bg-white p-[2%]">
          <div
            className="w-full h-full rounded-full relative overflow-hidden"
            style={{ background: `radial-gradient(circle, ${C.bg} 0%, ${C.light} 100%)` }}
          >
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full"
              style={{
                transform: `translateZ(0) rotate(${rotation}deg)`,
                transition: spinning ? `transform ${SPIN_DURATION}ms ${SPIN_EASING}` : "none",
                willChange: reducedMotion ? "auto" : "transform",
                backfaceVisibility: "hidden",
                transformOrigin: "50% 50%",
              }}
              shapeRendering="optimizeSpeed"
            >
              {segments.map((s, i) => (
                <g key={i}>
                  <path
                    d={s.path}
                    fill={s.isDark ? C.dark : C.light}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x={s.tx}
                    y={s.ty}
                    fill={s.isDark ? "#ffffff" : C.dark}
                    fontSize="15"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${s.rotate} ${s.tx} ${s.ty})`}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {shortLabel(prizes[i] ?? "")}
                  </text>
                </g>
              ))}
              <circle cx={cx} cy={cy} r={r * 0.22} fill="#ffffff" stroke={C.dark} strokeWidth="2" />
            </svg>

            <button
              type="button"
              onClick={handleSpin}
              disabled={spinning}
              aria-label="Spin the wheel"
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[22%] h-[22%] rounded-full bg-white flex items-center justify-center disabled:cursor-not-allowed cursor-pointer z-20 ${
                reducedMotion ? "" : "hover:scale-105 active:scale-95 transition-transform"
              }`}
              style={{
                border: `2px solid ${C.dark}`,
                boxShadow: `0 10px 30px -5px ${C.dark}80`,
              }}
            >
              <span
                className="font-display font-bold tracking-[0.2em] text-sm"
                style={{ color: C.dark }}
              >
                {spinning ? "..." : "SPIN"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 -top-2 -translate-x-1/2 z-10 drop-shadow-[0_4px_10px_rgba(42,62,75,0.4)]">
        <svg width="44" height="56" viewBox="0 0 44 56">
          <defs>
            <linearGradient id="gp-landing" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.primary} />
              <stop offset="100%" stopColor={C.dark} />
            </linearGradient>
          </defs>
          <path d="M22 54 L4 12 Q22 0 40 12 Z" fill="url(#gp-landing)" stroke={C.dark} strokeWidth="1.5" />
          <circle cx="22" cy="14" r="4" fill="#fff" />
        </svg>
      </div>

      {wonPrize && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md ${
            reducedMotion ? "" : "animate-fade-in"
          }`}
          style={{ background: `${C.dark}b3` }}
          onClick={() => setWonPrize(null)}
        >
          <div
            className={`relative w-full max-w-sm rounded-3xl bg-white shadow-[0_40px_100px_-10px_rgba(42,62,75,0.6)] overflow-hidden ${
              reducedMotion ? "" : "animate-scale-in"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-6 pt-8 pb-14 text-center relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${C.dark}, ${C.primary})` }}
            >
              <div
                className="absolute inset-0 opacity-40"
                style={{ background: `radial-gradient(circle at 50% 0%, ${C.light}, transparent 60%)` }}
              />
              <div className="relative">
                <span className="inline-block text-[11px] font-bold uppercase tracking-[0.3em] text-white/90">
                  {wonPrize === "Try Again" ? "So close!" : "Congratulations"}
                </span>
                <div className="mt-3 text-5xl">{wonPrize === "Try Again" ? "🎯" : "🎉"}</div>
              </div>
            </div>
            <div className="px-6 pt-6 pb-7 text-center -mt-8">
              <div
                className="mx-auto inline-block px-5 py-2 rounded-full bg-white border shadow-md text-xs font-bold uppercase tracking-widest"
                style={{ borderColor: `${C.dark}1a`, color: C.dark }}
              >
                {wonPrize === "Try Again" ? "Result" : "You won"}
              </div>
              <h3 className="font-display mt-4 text-3xl font-bold leading-tight" style={{ color: C.dark }}>
                {wonPrize}
              </h3>
              <p className="mt-2 text-sm" style={{ color: `${C.dark}99` }}>
                {wonPrize === "Try Again"
                  ? "Better luck next spin — give it another go!"
                  : "This is a demo spin. Create your shop to run real campaigns."}
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  onClick={() => { setWonPrize(null); setTimeout(handleSpin, reducedMotion ? 0 : 150); }}
                  className="w-full py-3.5 rounded-full text-white font-bold text-sm tracking-wide transition-all hover:scale-[1.02]"
                  style={{
                    background: `linear-gradient(135deg, ${C.dark}, ${C.primary})`,
                    boxShadow: `0 10px 30px -10px ${C.dark}b3`,
                  }}
                >
                  Spin Again
                </button>
                <button
                  onClick={() => setWonPrize(null)}
                  className="w-full py-2.5 rounded-full font-semibold text-xs transition-colors"
                  style={{ color: `${C.dark}99` }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
    { href: "#contact", label: "Contact" },
  ];

  return (
    <nav
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 backdrop-blur-xl border-b border-[#2A3E4B]/10 shadow-[0_4px_24px_-12px_rgba(42,62,75,0.15)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 py-3.5">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark size={38} />
          <span className="font-display font-bold tracking-tight text-lg" style={{ color: C.dark }}>
            Mystery Unlock
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-4 py-2 rounded-full text-sm font-medium transition-colors hover:bg-[#D6E6EF]/50"
              style={{ color: `${C.dark}cc` }}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-2">
          <Link
            to="/auth"
            className="px-4 py-2 rounded-full text-sm font-semibold transition-colors hover:bg-[#D6E6EF]/50"
            style={{ color: C.dark }}
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:scale-[1.03]"
            style={{
              background: `linear-gradient(135deg, ${C.dark}, ${C.primary})`,
              boxShadow: `0 8px 20px -8px ${C.dark}99`,
            }}
          >
            Start Free
          </Link>
        </div>

        <button
          aria-label="Open menu"
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center"
          style={{ color: C.dark, background: scrolled ? "transparent" : `${C.light}80` }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            {open ? (
              <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>
            ) : (
              <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-[#2A3E4B]/10 bg-white/95 backdrop-blur-xl">
          <div className="px-5 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-4 py-3 rounded-xl text-sm font-medium"
                style={{ color: C.dark }}
              >
                {l.label}
              </a>
            ))}
            <div className="h-px my-2 bg-[#2A3E4B]/10" />
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ color: C.dark }}
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="px-4 py-3 rounded-xl text-sm font-bold text-white text-center mt-1"
              style={{ background: `linear-gradient(135deg, ${C.dark}, ${C.primary})` }}
            >
              Start Free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

function Section({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`max-w-7xl mx-auto px-5 md:px-8 ${className}`}>
      {children}
    </section>
  );
}

function FeatureIcon({ d }: { d: string }) {
  return (
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
      style={{ background: `${C.light}`, color: C.dark }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </div>
  );
}

function Faq({ q, a, open, onClick }: { q: string; a: string; open: boolean; onClick: () => void }) {
  return (
    <div
      className="rounded-2xl bg-white border transition-all"
      style={{ borderColor: open ? `${C.primary}66` : `${C.dark}14` }}
    >
      <button
        onClick={onClick}
        className="w-full text-left px-5 md:px-6 py-5 flex items-center justify-between gap-4"
      >
        <span className="font-semibold text-base md:text-lg" style={{ color: C.dark }}>
          {q}
        </span>
        <span
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform"
          style={{
            background: open ? C.dark : C.light,
            color: open ? "#fff" : C.dark,
            transform: open ? "rotate(45deg)" : "rotate(0)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? 400 : 0 }}
      >
        <p className="px-5 md:px-6 pb-5 text-sm md:text-base leading-relaxed" style={{ color: `${C.dark}b3` }}>
          {a}
        </p>
      </div>
    </div>
  );
}

const FEATURE_ICONS = [
  "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83",
  "M20 12V22H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z",
  "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h2M16 14v3M14 17h3M19 17v4M16 21h5",
  "M3 3v18h18M7 16l4-4 4 4 5-5",
  "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
];
const DEFAULT_FEATURE_ITEMS = [
  { t: "Spin Wheel", desc: "Beautifully smooth, fully branded wheels customers love to spin." },
  { t: "Smart Rewards", desc: "Tune win probabilities per prize and cap inventory in real time." },
  { t: "Instant QR Code", desc: "One-tap QR for posters, receipts, and storefronts — no app install." },
  { t: "Live Analytics", desc: "Track spins, wins, conversion, and ROI from a single dashboard." },
  { t: "Your Branding", desc: "Custom logo, colors, and slug — your shop, your identity." },
  { t: "Bank-grade Security", desc: "Row-level isolation, signed access codes, and audited backups." },
];

function Landing() {
  const router = useRouter();
  const [reducedMotion, setReducedMotion] = useReducedMotion();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") router.invalidate(); };
    document.addEventListener("visibilitychange", onVisible);

    // Instantly refresh when the admin saves a setting in another tab
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("mu_settings_updated");
      bc.onmessage = () => router.invalidate();
    } catch {}

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      bc?.close();
    };
  }, [router]);

  const steps = [
    { t: "Create campaign", d: "Name your shop and pick a slug." },
    { t: "Add rewards", d: "Upload prize images and set odds." },
    { t: "Share QR", d: "Print or display — anywhere customers walk." },
    { t: "Customers spin", d: "A delightful, branded moment." },
    { t: "Track results", d: "Real-time analytics and winners log." },
  ];

  const DEFAULT_TESTIMONIALS = [
    { n: "Anisha Rai", r: "Boutique Owner", q: "Foot traffic jumped 38% the week we launched. Customers love it." },
    { n: "Bikash Shrestha", r: "Cafe Manager", q: "Setup took five minutes. The dashboard is genuinely beautiful." },
    { n: "Priya Karki", r: "Salon Founder", q: "Our regulars come back just to spin again. Best retention tool we've used." },
  ];

  const fallbackPlans = [
    {
      name: "Starter",
      price: "Free",
      period: "forever",
      desc: "Launch your first campaign in minutes.",
      features: ["1 active campaign", "Up to 100 spins / mo", "Branded wheel & QR", "Basic analytics"],
      cta: "Start Free",
      highlight: false,
    },
    {
      name: "Growth",
      price: "Rs.999",
      period: "/ month",
      desc: "For shops scaling daily campaigns.",
      features: ["Unlimited campaigns", "10,000 spins / mo", "Custom branding", "Advanced analytics", "Priority support"],
      cta: "Start Growth",
      highlight: true,
    },
    {
      name: "Business",
      price: "Custom",
      period: "tailored",
      desc: "Multi-location & enterprise needs.",
      features: ["Unlimited everything", "Multi-shop accounts", "Dedicated success manager", "Custom integrations"],
      cta: "Contact Sales",
      highlight: false,
    },
  ];

  const { plans: livePlansRaw, settings: siteSettings } = Route.useLoaderData() as { plans: Array<{ name: string; tagline: string | null; price_amount: number; currency: string; period: string; features: string[]; cta_label: string | null; is_highlighted: boolean }>; settings: Record<string, unknown> };
  const hero = (siteSettings?.hero ?? {}) as { badge?: string; title_main?: string; title_highlight?: string; subtitle?: string; cta_primary?: string; cta_secondary?: string };
  const heroBadge = hero.badge ?? "New · Premium spin SaaS";
  const heroTitleMain = hero.title_main ?? "Turn every visit into a";
  const heroTitleHighlight = hero.title_highlight ?? "memorable spin.";
  const heroSubtitle = hero.subtitle ?? "Mystery Unlock is the elegant, modern way to run spin-to-win campaigns. Brand your wheel, share a QR, and track every winner from one beautiful dashboard.";
  const heroCTAPrimary = hero.cta_primary ?? "Start Free";
  const heroCTASecondary = hero.cta_secondary ?? "Watch Demo";
  const announcement = (siteSettings?.announcement ?? {}) as { enabled?: boolean; text?: string; link?: string };
  const contactSettings = (siteSettings?.contact ?? {}) as { whatsapp?: string };
  const whatsappNumber = contactSettings.whatsapp ?? "9779769402069";
  const fmtPrice = (amt: number, cur: string) => {
    if (amt <= 0) return "Free";
    const sym = cur?.toUpperCase() === "NPR" ? "Rs." : (cur || "");
    return `${sym}${Number(amt).toLocaleString()}`;
  };
  type PlanCard = { name: string; price: string; period: string; desc: string; features: string[]; cta: string; highlight: boolean };
  const livePlans: PlanCard[] | null = (livePlansRaw && livePlansRaw.length)
    ? livePlansRaw.map((p) => ({
        name: p.name,
        price: fmtPrice(p.price_amount, p.currency),
        period: p.price_amount > 0 ? `/ ${p.period}` : (p.period || "forever"),
        desc: p.tagline || "",
        features: p.features ?? [],
        cta: p.cta_label || (p.price_amount > 0 ? `Start ${p.name}` : "Start Free"),
        highlight: !!p.is_highlighted,
      }))
    : null;
  const plans: PlanCard[] = livePlans ?? fallbackPlans;




  const statsSettings = siteSettings?.stats as Array<{value:string;label:string}> | undefined;
  const stats = statsSettings?.length ? statsSettings : [
    { value: "10k+", label: "Spins delivered" },
    { value: "98%", label: "Customer delight" },
    { value: "<1m", label: "Setup time" },
  ];


  const featuresFromSettings = siteSettings?.features as Array<{t:string;desc:string}> | undefined;
  const features = FEATURE_ICONS.map((d, i) => ({
    d,
    t: featuresFromSettings?.[i]?.t ?? DEFAULT_FEATURE_ITEMS[i].t,
    desc: featuresFromSettings?.[i]?.desc ?? DEFAULT_FEATURE_ITEMS[i].desc,
  }));

  const testimonialsFromSettings = siteSettings?.testimonials as Array<{n:string;r:string;q:string}> | undefined;
  const testimonials = testimonialsFromSettings?.length ? testimonialsFromSettings : DEFAULT_TESTIMONIALS;

  const faqsFromSettings = siteSettings?.faqs as Array<{q:string;a:string}> | undefined;
  const faqs = faqsFromSettings?.length ? faqsFromSettings : [
    { q: "How quickly can I launch a campaign?", a: "Under 2 minutes — create an account, name your shop, upload prizes, and share the QR code. No app install required for your customers." },
    { q: "Do my customers need an app?", a: "No. They scan your QR code with any phone camera and spin in the browser. The page is a fast, installable PWA if they want to save it." },
    { q: "Can I control prize odds?", a: "Yes — set weighted probabilities per prize and adjust them anytime. The atomic spin engine guarantees fair, tamper-proof outcomes." },
    { q: "What about my brand?", a: "Upload your logo and pick your slug. The spin page, QR, and result screens all reflect your brand identity end-to-end." },
    { q: "Is my customer data safe?", a: "Yes. Every shop runs in an isolated row-level secure environment, with signed access codes and encrypted storage." },
    { q: "Can I cancel anytime?", a: "Absolutely. Plans are month-to-month, no contracts. Your data stays exportable as CSV at all times." },
  ];

  const finalCtaSettings = (siteSettings?.finalCta ?? {}) as { heading?: string; subtitle?: string; cta_primary?: string; cta_secondary?: string };
  const finalCtaHeading = finalCtaSettings.heading ?? "Ready to spin up something delightful?";
  const finalCtaSubtitle = finalCtaSettings.subtitle ?? "Join shops creating moments customers come back for. Free to start, simple to scale.";
  const finalCtaPrimary = finalCtaSettings.cta_primary ?? "Start Free";
  const finalCtaSecondary = finalCtaSettings.cta_secondary ?? "Talk to Sales";

  return (
    <div className="min-h-screen w-full" style={{ background: C.bg, color: C.dark }}>
      <Navbar />

      {/* ANNOUNCEMENT BANNER */}
      {announcement.enabled && announcement.text && (
        <div className="w-full py-2.5 px-4 text-center text-sm font-semibold" style={{ background: C.dark, color: "#fff" }}>
          {announcement.link ? (
            <a href={announcement.link} className="hover:underline">{announcement.text}</a>
          ) : (
            <span>{announcement.text}</span>
          )}
        </div>
      )}

      {/* HERO — Landing Page 2.0, built on the Mystery Unlock UI Foundation */}
      <Hero
        badge={heroBadge}
        titleMain={heroTitleMain}
        titleHighlight={heroTitleHighlight}
        subtitle={heroSubtitle}
        ctaPrimaryLabel={heroCTAPrimary}
        ctaSecondaryLabel={heroCTASecondary}
        stats={stats}
        reducedMotion={reducedMotion}
        onToggleReducedMotion={() => setReducedMotion(!reducedMotion)}
        visual={<WheelVisual reducedMotion={reducedMotion} />}
      />

      {/* WHY CHOOSE US — Landing Page 2.0 */}
      <WhyChooseUs />

      {/* HOW IT WORKS — Landing Page 2.0 */}
      <HowItWorks />

      {/* FEATURES */}
      <Section id="features" className="py-20 lg:py-28">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span
            className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full"
            style={{ background: C.light, color: C.dark }}
          >
            Features
          </span>
          <h2 className="font-display mt-5 text-3xl md:text-5xl font-bold leading-tight" style={{ color: C.dark }}>
            Everything you need to delight customers.
          </h2>
          <p className="mt-4 text-base md:text-lg" style={{ color: `${C.dark}b3` }}>
            Polished tools for boutique shops that care about every detail.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.t}
              className="group p-7 rounded-3xl bg-white border transition-all duration-300 hover:-translate-y-1"
              style={{
                borderColor: `${C.dark}14`,
                boxShadow: `0 1px 0 ${C.dark}08`,
              }}
            >
              <FeatureIcon d={f.d} />
              <h3 className="font-display font-bold text-lg mb-2" style={{ color: C.dark }}>{f.t}</h3>
              <p className="text-sm leading-relaxed" style={{ color: `${C.dark}b3` }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* WHEEL DEMO */}
      <Section id="wheel-demo" className="py-20 lg:py-28">
        <div
          className="rounded-[2rem] p-8 md:p-14 grid lg:grid-cols-[1fr_minmax(0,440px)] gap-10 lg:gap-14 items-center"
          style={{ background: `linear-gradient(135deg, ${C.light}, ${C.bg})` }}
        >
          <div>
            <span
              className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full bg-white"
              style={{ color: C.dark }}
            >
              Try it now
            </span>
            <h2 className="font-display mt-5 text-3xl md:text-4xl font-bold leading-tight" style={{ color: C.dark }}>
              Spin a live demo wheel.
            </h2>
            <p className="mt-4 text-base md:text-lg max-w-md" style={{ color: `${C.dark}cc` }}>
              Tap SPIN to feel the smooth deceleration, premium haptics, and prize reveal modal your
              customers will experience.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="px-6 py-3 rounded-full font-bold text-sm text-white"
                style={{ background: C.dark }}
              >
                Build your own
              </Link>
              <InstallAppButton
                variant="outline"
                size="lg"
                className="!rounded-full !text-sm !font-semibold !px-6"
              />
            </div>
          </div>
          <div>
            <WheelVisual reducedMotion={reducedMotion} />
          </div>
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section className="py-20 lg:py-28">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span
            className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full"
            style={{ background: C.light, color: C.dark }}
          >
            How it works
          </span>
          <h2 className="font-display mt-5 text-3xl md:text-5xl font-bold leading-tight" style={{ color: C.dark }}>
            From idea to first spin in minutes.
          </h2>
        </div>

        <ol className="relative grid md:grid-cols-5 gap-6">
          <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-px" style={{ background: `${C.primary}66` }} />
          {steps.map((s, i) => (
            <li key={s.t} className="relative">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-white relative z-10 mx-auto md:mx-0"
                style={{
                  background: `linear-gradient(135deg, ${C.dark}, ${C.primary})`,
                  boxShadow: `0 8px 20px -8px ${C.dark}80`,
                }}
              >
                {i + 1}
              </div>
              <h3 className="font-display font-bold mt-4 text-center md:text-left" style={{ color: C.dark }}>
                {s.t}
              </h3>
              <p className="mt-2 text-sm text-center md:text-left" style={{ color: `${C.dark}99` }}>
                {s.d}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {/* DASHBOARD PREVIEW */}
      <Section className="py-20 lg:py-28">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span
            className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full"
            style={{ background: C.light, color: C.dark }}
          >
            Dashboard
          </span>
          <h2 className="font-display mt-5 text-3xl md:text-5xl font-bold leading-tight" style={{ color: C.dark }}>
            Beautiful data, at a glance.
          </h2>
        </div>

        <div
          className="relative rounded-[2rem] p-3 md:p-4 border"
          style={{
            background: `linear-gradient(135deg, ${C.light}80, ${C.bg})`,
            borderColor: `${C.dark}14`,
            boxShadow: `0 40px 80px -30px ${C.dark}40`,
          }}
        >
          <div className="rounded-[1.5rem] bg-white overflow-hidden" style={{ boxShadow: `0 1px 0 ${C.dark}10` }}>
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: `${C.dark}0f` }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
              <span className="ml-3 text-xs font-semibold" style={{ color: `${C.dark}80` }}>mystery-unlock / dashboard</span>
            </div>
            <div className="p-5 md:p-8">
              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                {[
                  { l: "Spins today", v: "1,284", d: "+18.2%" },
                  { l: "Total winners", v: "342", d: "+9.4%" },
                  { l: "Conversion", v: "26.6%", d: "+3.1%" },
                ].map((m) => (
                  <div
                    key={m.l}
                    className="rounded-2xl p-5 border"
                    style={{ background: C.bg, borderColor: `${C.dark}10` }}
                  >
                    <div className="text-[11px] uppercase tracking-wider font-bold" style={{ color: `${C.dark}80` }}>{m.l}</div>
                    <div className="font-display text-2xl font-bold mt-2" style={{ color: C.dark }}>{m.v}</div>
                    <div className="text-xs font-semibold mt-1" style={{ color: C.primaryDark }}>{m.d}</div>
                  </div>
                ))}
              </div>

              {/* Bars */}
              <div className="rounded-2xl p-5 border" style={{ borderColor: `${C.dark}10` }}>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <div className="font-display font-bold" style={{ color: C.dark }}>Spins this week</div>
                    <div className="text-xs" style={{ color: `${C.dark}80` }}>Mon — Sun</div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: C.light, color: C.dark }}>
                    +24% vs last week
                  </span>
                </div>
                <div className="flex items-end gap-2 h-32">
                  {[40, 65, 50, 80, 70, 95, 88].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-lg transition-all"
                      style={{
                        height: `${h}%`,
                        background: `linear-gradient(180deg, ${C.primary}, ${C.dark})`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* TESTIMONIALS */}
      <Section className="py-20 lg:py-28">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span
            className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full"
            style={{ background: C.light, color: C.dark }}
          >
            Loved by owners
          </span>
          <h2 className="font-display mt-5 text-3xl md:text-5xl font-bold leading-tight" style={{ color: C.dark }}>
            Shop owners are raving.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((t) => (
            <div
              key={t.n}
              className="p-7 rounded-3xl bg-white border"
              style={{ borderColor: `${C.dark}14` }}
            >
              <div className="flex gap-0.5 mb-4" style={{ color: C.primary }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <p className="text-base leading-relaxed mb-5" style={{ color: C.dark }}>
                "{t.q}"
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${C.dark}, ${C.primary})` }}
                >
                  {t.n[0]}
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: C.dark }}>{t.n}</div>
                  <div className="text-xs" style={{ color: `${C.dark}99` }}>{t.r}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* PRICING */}
      <Section id="pricing" className="py-20 lg:py-28">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span
            className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full"
            style={{ background: C.light, color: C.dark }}
          >
            Pricing
          </span>
          <h2 className="font-display mt-5 text-3xl md:text-5xl font-bold leading-tight" style={{ color: C.dark }}>
            Simple, transparent pricing.
          </h2>
          <p className="mt-4 text-base md:text-lg" style={{ color: `${C.dark}b3` }}>
            Start free. Upgrade when you're ready.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`p-7 md:p-8 rounded-3xl border relative transition-all ${
                p.highlight ? "lg:-translate-y-2" : ""
              }`}
              style={
                p.highlight
                  ? {
                      background: `linear-gradient(135deg, ${C.dark}, ${C.primary})`,
                      borderColor: "transparent",
                      color: "#fff",
                      boxShadow: `0 30px 60px -20px ${C.dark}99`,
                    }
                  : { background: "#fff", borderColor: `${C.dark}14` }
              }
            >
              {p.highlight && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: "#fff", color: C.dark }}
                >
                  Most popular
                </span>
              )}
              <div className="font-display font-bold text-lg" style={{ color: p.highlight ? "#fff" : C.dark }}>
                {p.name}
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold" style={{ color: p.highlight ? "#fff" : C.dark }}>
                  {p.price}
                </span>
                <span className="text-sm" style={{ color: p.highlight ? "#ffffffcc" : `${C.dark}99` }}>{p.period}</span>
              </div>
              <p className="mt-3 text-sm" style={{ color: p.highlight ? "#ffffffcc" : `${C.dark}b3` }}>{p.desc}</p>

              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: p.highlight ? "#fff" : C.dark }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/auth"
                className="mt-8 block text-center py-3.5 rounded-full font-bold text-sm transition-all hover:scale-[1.02]"
                style={
                  p.highlight
                    ? { background: "#fff", color: C.dark }
                    : { background: C.dark, color: "#fff" }
                }
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="py-20 lg:py-28">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-10 lg:gap-16">
          <div>
            <span
              className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full"
              style={{ background: C.light, color: C.dark }}
            >
              FAQ
            </span>
            <h2 className="font-display mt-5 text-3xl md:text-4xl font-bold leading-tight" style={{ color: C.dark }}>
              Questions, answered.
            </h2>
            <p className="mt-4" style={{ color: `${C.dark}b3` }}>
              Can't find what you're looking for?{" "}
              <a href="#contact" className="font-semibold underline underline-offset-4" style={{ color: C.dark }}>
                Talk to us
              </a>
              .
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {faqs.map((f, i) => (
              <Faq
                key={f.q}
                q={f.q}
                a={f.a}
                open={openFaq === i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </Section>

      {/* FINAL CTA */}
      <Section className="py-20 lg:py-28">
        <div
          className="relative overflow-hidden rounded-[2rem] p-10 md:p-16 text-center"
          style={{
            background: `linear-gradient(135deg, ${C.dark}, ${C.primary})`,
            boxShadow: `0 40px 100px -30px ${C.dark}b3`,
          }}
        >
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ background: `radial-gradient(circle at 30% 0%, ${C.light}, transparent 60%)` }}
          />
          <div className="relative">
            <h2 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">
              {finalCtaHeading}
            </h2>
            <p className="mt-5 text-white/85 max-w-xl mx-auto text-base md:text-lg">
              {finalCtaSubtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/auth"
                className="px-7 py-3.5 rounded-full font-bold text-sm transition-all hover:scale-[1.03] bg-white"
                style={{ color: C.dark, boxShadow: `0 14px 36px -12px ${C.dark}` }}
              >
                {finalCtaPrimary}
              </Link>
              <a
                href="#contact"
                className="px-7 py-3.5 rounded-full font-bold text-sm text-white border border-white/30 hover:bg-white/10 transition-colors"
              >
                {finalCtaSecondary}
              </a>
            </div>
          </div>
        </div>
      </Section>

      {/* FOOTER */}
      <footer id="contact" className="border-t" style={{ borderColor: `${C.dark}14` }}>
        <Section className="py-14">
          <div className="grid md:grid-cols-[2fr_1fr_1fr_1.5fr] gap-10">
            <div>
              <div className="flex items-center gap-2.5">
                <BrandMark size={36} />
                <span className="font-display font-bold text-lg" style={{ color: C.dark }}>Mystery Unlock</span>
              </div>
              <p className="mt-4 text-sm max-w-xs" style={{ color: `${C.dark}99` }}>
                Premium spin-to-win SaaS for boutique shops, salons, and cafes.
              </p>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: C.dark }}>Product</div>
              <ul className="space-y-2.5 text-sm" style={{ color: `${C.dark}b3` }}>
                <li><a href="#features" className="hover:underline">Features</a></li>
                <li><a href="#pricing" className="hover:underline">Pricing</a></li>
                <li><a href="#faq" className="hover:underline">FAQ</a></li>
                <li><Link to="/auth" className="hover:underline">Sign in</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: C.dark }}>Company</div>
              <ul className="space-y-2.5 text-sm" style={{ color: `${C.dark}b3` }}>
                <li><Link to="/contact" className="hover:underline">Contact Us</Link></li>
                <li><Link to="/trust" className="hover:underline">Trust & security</Link></li>
                <li><Link to="/privacy" className="hover:underline">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:underline">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: C.dark }}>Get in touch</div>
              <div className="flex flex-col gap-3">
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 text-sm font-semibold transition-colors hover:opacity-80"
                  style={{ color: C.dark }}
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: C.light }}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
                      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zM17.472 14.382c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                    </svg>
                  </span>
                  9769402069
                </a>
                <a
                  href="mailto:support@mysteryunlock.com"
                  className="inline-flex items-center gap-2.5 text-sm font-semibold transition-colors hover:opacity-80"
                  style={{ color: C.dark }}
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: C.light }}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
                      <path d="M12 12.713L.015 3h23.97L12 12.713zM12 14.713L0 5v15h24V5l-12 9.713z" />
                    </svg>
                  </span>
                  support@mysteryunlock.com
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t flex flex-wrap items-center justify-between gap-3" style={{ borderColor: `${C.dark}14` }}>
            <p className="text-xs" style={{ color: `${C.dark}80` }}>
              © {new Date().getFullYear()} Mystery Unlock. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs" style={{ color: `${C.dark}80` }}>
              <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
              <span>·</span>
              <Link to="/terms" className="hover:underline">Terms of Service</Link>
              <span>·</span>
              <Link to="/contact" className="hover:underline">Contact</Link>
            </div>
          </div>
        </Section>
      </footer>
    </div>
  );
}

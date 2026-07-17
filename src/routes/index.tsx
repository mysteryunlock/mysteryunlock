import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
import { InstallAppButton } from "@/components/InstallAppButton";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { playClick, playWin, playLose, startSpinTicks } from "@/lib/sounds";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { listActivePlans } from "@/lib/plans.functions";
import { getSiteSettings } from "@/lib/site-settings.functions";
import { Hero } from "@/components/landing/Hero";
import { WhyChooseUs } from "@/components/landing/WhyChooseUs";
const HowItWorks = lazy(() => import("@/components/landing/HowItWorks").then(m => ({ default: m.HowItWorks })));
const Features = lazy(() => import("@/components/landing/Features").then(m => ({ default: m.Features })));
const DashboardPreview = lazy(() => import("@/components/landing/DashboardPreview").then(m => ({ default: m.DashboardPreview })));
const CustomerExperience = lazy(() => import("@/components/landing/CustomerExperience").then(m => ({ default: m.CustomerExperience })));
const RealResults = lazy(() => import("@/components/landing/RealResults").then(m => ({ default: m.RealResults })));
const IndustryShowcase = lazy(() => import("@/components/landing/IndustryShowcase").then(m => ({ default: m.IndustryShowcase })));
const WhoItsFor = lazy(() => import("@/components/landing/WhoItsFor").then(m => ({ default: m.WhoItsFor })));
const HowToLaunch = lazy(() => import("@/components/landing/HowToLaunch").then(m => ({ default: m.HowToLaunch })));
const Pricing = lazy(() => import("@/components/landing/Pricing").then(m => ({ default: m.Pricing })));
const FAQ = lazy(() => import("@/components/landing/FAQ").then(m => ({ default: m.FAQ })));
const FinalCTA = lazy(() => import("@/components/landing/FinalCTA").then(m => ({ default: m.FinalCTA })));
const LandingFooter = lazy(() => import("@/components/landing/LandingFooter").then(m => ({ default: m.LandingFooter })));

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

// ─── Structured data (JSON-LD) ────────────────────────────────────────────────
// These schemas are injected via TanStack Router's "script:ld+json" meta key,
// which renders as <script type="application/ld+json"> in the document head.
// Data is sourced only from verifiable project facts — no fabricated ratings.

const SITE_URL = "https://mysteryunlock.com";
const LOGO_URL = `${SITE_URL}/logo.png`;

const LD_ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Mystery Unlock",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: LOGO_URL,
    width: 512,
    height: 512,
  },
  email: "support@mysteryunlock.com",
  description:
    "Premium spin-to-win SaaS for boutique shops, salons, and cafés. Brand your wheel, share a QR code, and track every winner in a beautiful dashboard.",
  // sameAs omitted — no verified social profiles exist in the project
};

const LD_WEBSITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Mystery Unlock",
  url: SITE_URL,
  description:
    "Run elegant spin-to-win loyalty campaigns. Brand your wheel, share a QR, and watch every win in a beautiful real-time dashboard.",
  // potentialAction omitted — no website-level search feature exists
};

const LD_SOFTWARE_APP = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Mystery Unlock",
  url: SITE_URL,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Spin-to-win loyalty campaign platform for retail shops. Create branded spin wheels, generate QR codes, track customers, and grow repeat business.",
  offers: [
    {
      "@type": "Offer",
      name: "Starter",
      price: "999",
      priceCurrency: "NPR",
      description:
        "For small shops getting started. Includes 1 Campaign, up to 200 Customers, QR Campaigns, Basic Analytics, and Email Support.",
    },
    {
      "@type": "Offer",
      name: "Growth",
      price: "2499",
      priceCurrency: "NPR",
      description:
        "Everything you need to scale loyalty. Includes Unlimited Campaigns, Unlimited Customers, CRM, Loyalty Program, and Advanced Analytics.",
    },
  ],
  // aggregateRating omitted — no genuine rating data source in the project
};

export const Route = createFileRoute("/")({
  head: ({ loaderData }) => {
    const settings = ((loaderData as { settings?: Record<string, unknown> })?.settings ?? {});
    const seo = (settings.seo ?? {}) as { title?: string; description?: string; og_title?: string; og_description?: string };
    const pageTitle = seo.title || "Mystery Unlock — Premium spin-to-win campaigns for modern shops";
    const pageDesc = seo.description || "Run elegant spin-to-win campaigns. Brand your wheel, share a QR, and watch every win in a beautiful dashboard.";
    const ogTitle = seo.og_title || "Mystery Unlock — Spin · Win · Enjoy";
    const ogDesc = seo.og_description || "Premium spin-to-win SaaS for boutique shops. Brand, share, and track campaigns customers remember.";
    return {
      meta: [
        { title: pageTitle },
        { name: "description", content: pageDesc },
        // ── Open Graph ──────────────────────────────────────────────────────
        { property: "og:type", content: "website" },
        { property: "og:url", content: SITE_URL },
        { property: "og:site_name", content: "Mystery Unlock" },
        { property: "og:title", content: ogTitle },
        { property: "og:description", content: ogDesc },
        { property: "og:image", content: LOGO_URL },
        { property: "og:image:width", content: "512" },
        { property: "og:image:height", content: "512" },
        { property: "og:image:alt", content: "Mystery Unlock logo" },
        // ── Twitter Card ────────────────────────────────────────────────────
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: ogTitle },
        { name: "twitter:description", content: ogDesc },
        { name: "twitter:image", content: LOGO_URL },
        { name: "twitter:image:alt", content: "Mystery Unlock logo" },
        // ── JSON-LD structured data ─────────────────────────────────────────
        { "script:ld+json": LD_ORGANIZATION },
        { "script:ld+json": LD_WEBSITE },
        { "script:ld+json": LD_SOFTWARE_APP },
      ],
      links: [
        { rel: "canonical", href: SITE_URL },
      ],
    };
  },
  loader: async () => {
    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, rej) => setTimeout(() => rej(new Error("loader_timeout")), ms)),
      ]);
    const [plansRes, settingsRes] = await Promise.allSettled([
      withTimeout(listActivePlans(), 5000),
      withTimeout(getSiteSettings(), 5000),
    ]);
    return {
      plans: plansRes.status === "fulfilled" ? (plansRes.value.plans ?? []) : [],
      settings: settingsRes.status === "fulfilled" ? settingsRes.value.settings : {},
    };
  },
  staleTime: Infinity,
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="win-modal-title"
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md ${
            reducedMotion ? "" : "animate-fade-in"
          }`}
          style={{ background: `${C.dark}b3` }}
          onClick={() => setWonPrize(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setWonPrize(null); }}
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
              <h3 id="win-modal-title" className="font-display mt-4 text-3xl font-bold leading-tight" style={{ color: C.dark }}>
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
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
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
            to="/welcome"
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
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden w-11 h-11 rounded-full flex items-center justify-center"
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
        <div id="mobile-nav" className="lg:hidden border-t border-[#2A3E4B]/10 bg-white/95 backdrop-blur-xl">
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
              to="/welcome"
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

// ─── Static data — module scope prevents recreation on every render ───────────

const LANDING_HOW_IT_WORKS_STEPS = [
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


// ─────────────────────────────────────────────────────────────────────────────

function Landing() {
  const router = useRouter();
  const [reducedMotion, setReducedMotion] = useReducedMotion();
  const toggleReducedMotion = useCallback(() => setReducedMotion((m) => !m), [setReducedMotion]);

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

  const { settings: siteSettings } = Route.useLoaderData() as { settings: Record<string, unknown> };
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

  const statsSettings = siteSettings?.stats as Array<{value:string;label:string}> | undefined;
  const stats = statsSettings?.length ? statsSettings : [
    { value: "10k+", label: "Spins delivered" },
    { value: "98%", label: "Customer delight" },
    { value: "<1m", label: "Setup time" },
  ];

  const testimonialsFromSettings = siteSettings?.testimonials as Array<{n:string;r:string;q:string}> | undefined;
  const testimonials = testimonialsFromSettings?.length ? testimonialsFromSettings : DEFAULT_TESTIMONIALS;

  const whyChooseUsSettings = siteSettings?.whyChooseUs as
    | { heading?: string; items?: { title: string; desc: string }[] }
    | undefined;

  const faqSettings = siteSettings?.faqs
    ? { items: siteSettings.faqs as { q: string; a: string; category?: string }[] }
    : undefined;

  const finalCtaSettings = siteSettings?.finalCta as
    | { heading?: string; subtitle?: string; cta_primary?: string; cta_secondary?: string }
    | undefined;

  const howItWorksSettings = siteSettings?.howItWorks as
    | { heading?: string; subtitle?: string; steps?: { title: string; description: string }[] }
    | undefined;

  const featuresSectionSettings = siteSettings?.featuresSection as
    | { heading?: string; subtitle?: string; business_label?: string; customer_label?: string; business?: { title: string; description: string }[]; customer?: { title: string; description: string }[] }
    | undefined;

  const dashboardPreviewSettings = siteSettings?.dashboardPreview as
    | { heading?: string; subtitle?: string }
    | undefined;

  const customerExperienceSettings = siteSettings?.customerExperience as
    | { heading?: string; subtitle?: string }
    | undefined;

  const realResultsSettings = siteSettings?.realResults as
    | { heading?: string; subtitle?: string }
    | undefined;

  const industryShowcaseSettings = siteSettings?.industryShowcase as
    | { heading?: string; subtitle?: string }
    | undefined;

  const whoItsForSettings = siteSettings?.whoItsFor as
    | { heading?: string; subtitle?: string }
    | undefined;

  const howToLaunchSettings = siteSettings?.howToLaunch as
    | { heading?: string; subtitle?: string; steps?: { title: string; subtitle: string }[] }
    | undefined;

  const pricingSectionSettings = siteSettings?.pricingSection as
    | { heading?: string; subtitle?: string }
    | undefined;

  const footerSettingsData = siteSettings?.footer as
    | { business_name?: string; tagline?: string; email?: string; whatsapp?: string; address?: string; facebook?: string; instagram?: string; twitter?: string }
    | undefined;

  const themeData = siteSettings?.theme as
    | { accent?: string; primary?: string }
    | undefined;

  const themeVars = themeData ? `
    :root {
      --mu-accent: ${themeData.accent ?? "#FF6B1A"};
      --mu-primary: ${themeData.primary ?? "#2A3E4B"};
    }
  ` : null;

  return (
    <div className="min-h-[100dvh] w-full" style={{ background: C.bg, color: C.dark }}>
      {themeVars && <style dangerouslySetInnerHTML={{ __html: themeVars }} />}
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

      <main id="main-content">
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
        onToggleReducedMotion={toggleReducedMotion}
        visual={<WheelVisual reducedMotion={reducedMotion} />}
      />

      {/* WHY CHOOSE US — Landing Page 2.0 */}
      <WhyChooseUs settings={whyChooseUsSettings} />

      <Suspense fallback={null}>
      {/* HOW IT WORKS — Landing Page 2.0 */}
      <HowItWorks settings={howItWorksSettings} />

      {/* FEATURES — Landing Page 2.0 */}
      <Features settings={featuresSectionSettings} />

      {/* DASHBOARD PREVIEW — Landing Page 2.0 */}
      <DashboardPreview settings={dashboardPreviewSettings} />

      {/* CUSTOMER EXPERIENCE — Landing Page 2.0 */}
      <CustomerExperience settings={customerExperienceSettings} />

      {/* REAL RESULTS — Landing Page 2.0 */}
      <RealResults settings={realResultsSettings} />

      {/* INDUSTRY SHOWCASE — Landing Page 2.0 */}
      <IndustryShowcase settings={industryShowcaseSettings} />

      {/* WHO IT'S FOR — Landing Page 2.0 */}
      <WhoItsFor settings={whoItsForSettings} />

      {/* HOW TO LAUNCH — Landing Page 2.0 */}
      <HowToLaunch settings={howToLaunchSettings} />

      {/* PRICING — Landing Page 2.0 */}
      <Pricing settings={pricingSectionSettings} />

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
          {LANDING_HOW_IT_WORKS_STEPS.map((s, i) => (
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

      {/* FAQ — Landing Page 2.0 */}
      <FAQ settings={faqSettings} />

      {/* FINAL CTA — Landing Page 2.0 */}
      <FinalCTA settings={finalCtaSettings} />
      </Suspense>

      </main>

      {/* FOOTER */}
      <Suspense fallback={null}>
        <LandingFooter whatsappNumber={whatsappNumber} settings={footerSettingsData} />
      </Suspense>
    </div>
  );
}

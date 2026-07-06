import { ArrowRight, Star, Zap, Shield, RotateCcw } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { SectionContainer } from "@/components/foundation/layout/SectionContainer";
import { PrimaryButton } from "@/components/foundation/buttons/PrimaryButton";
import { OutlineButton } from "@/components/foundation/buttons/OutlineButton";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const B = {
  dark: "#2A3E4B",
  mid: "#7FA6B8",
  light: "#D6E6EF",
  bg: "#F7FBFD",
  accent: "#FF6B00",
};

// ─── Social proof data ────────────────────────────────────────────────────────
const STATS = [
  { value: "128+", label: "Active shops" },
  { value: "4.9★", label: "Average rating" },
  { value: "<2 min", label: "Setup time" },
  { value: "Free", label: "To get started" },
];

const TRUST_ITEMS = [
  { icon: <Zap className="size-3.5" />, label: "No credit card required" },
  { icon: <Shield className="size-3.5" />, label: "14-day risk-free trial" },
  { icon: <RotateCcw className="size-3.5" />, label: "Cancel anytime" },
];

// ─── Decorative spin wheel ────────────────────────────────────────────────────
function DecorativeWheel({ className = "" }: { className?: string }) {
  const segments = 8;
  const segColors = [
    "rgba(255,107,0,0.9)",
    "rgba(255,255,255,0.12)",
    "rgba(255,107,0,0.6)",
    "rgba(255,255,255,0.08)",
    "rgba(255,107,0,0.75)",
    "rgba(255,255,255,0.10)",
    "rgba(255,107,0,0.5)",
    "rgba(255,255,255,0.06)",
  ];

  const r = 90;
  const cx = 100;
  const cy = 100;
  const sweepAngle = (2 * Math.PI) / segments;

  const paths = Array.from({ length: segments }, (_, i) => {
    const startAngle = (i * sweepAngle) - Math.PI / 2;
    const endAngle = startAngle + sweepAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
  });

  return (
    <div className={`relative ${className}`} aria-hidden>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full animate-spin motion-reduce:animate-none"
        style={{ animationDuration: "24s", animationTimingFunction: "linear" }}
      >
        {/* Segments */}
        {paths.map((d, i) => (
          <path key={i} d={d} fill={segColors[i]} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        ))}
        {/* Dividing lines */}
        {Array.from({ length: segments }, (_, i) => {
          const angle = (i / segments) * 2 * Math.PI - Math.PI / 2;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + r * Math.cos(angle)}
              y2={cy + r * Math.sin(angle)}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1}
            />
          );
        })}
        {/* Hub */}
        <circle cx={cx} cy={cy} r={14} fill={B.dark} stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={6} fill={B.accent} />
      </svg>

      {/* Pointer */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1"
        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}
      >
        <svg width="16" height="24" viewBox="0 0 16 24">
          <polygon points="8,0 16,18 8,14 0,18" fill={B.accent} />
        </svg>
      </div>
    </div>
  );
}

// ─── Star rating display ──────────────────────────────────────────────────────
function StarRating({ count = 5 }: { count?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }, (_, i) => (
        <Star key={i} className="size-3.5 fill-current" style={{ color: "#FBBF24" }} aria-hidden />
      ))}
    </span>
  );
}

// ─── Avatar stack ─────────────────────────────────────────────────────────────
function AvatarStack() {
  // Coloured initials as avatar placeholders
  const avatars = [
    { initials: "PK", bg: "#FF6B00" },
    { initials: "AS", bg: "#10b981" },
    { initials: "RB", bg: "#6366f1" },
    { initials: "MJ", bg: "#f59e0b" },
    { initials: "TD", bg: "#3b82f6" },
  ];
  return (
    <div role="img" className="flex items-center" aria-label="Shop owners using Mystery Unlock">
      {avatars.map((a, i) => (
        <div
          key={a.initials}
          className="w-8 h-8 rounded-full border-2 border-white grid place-items-center text-[10px] font-black text-white shrink-0"
          style={{
            background: a.bg,
            marginLeft: i === 0 ? 0 : -10,
            zIndex: avatars.length - i,
          }}
          aria-hidden
        >
          {a.initials}
        </div>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function FinalCTA() {
  return (
    <SectionContainer
      as="section"
      id="final-cta"
      maxWidth="xl"
      spacing="none"
      className="py-20 lg:py-28"
      aria-labelledby="final-cta-heading"
    >
      <div
        className="relative overflow-hidden rounded-[2rem]"
        style={{
          background: `linear-gradient(135deg, ${B.dark} 0%, #1a2e38 60%, #0f1e26 100%)`,
          boxShadow: `0 40px 100px -30px ${B.dark}cc`,
        }}
      >
        {/* ── Decorative background glows ──────────────────────────── */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            background: `
              radial-gradient(ellipse 60% 50% at 10% 0%, rgba(127,166,184,0.18) 0%, transparent 70%),
              radial-gradient(ellipse 40% 40% at 90% 100%, rgba(255,107,0,0.12) 0%, transparent 60%)
            `,
          }}
        />

        {/* ── Decorative wheel (desktop only, right side) ───────────── */}
        <div
          className="absolute right-[-60px] top-1/2 -translate-y-1/2 w-[320px] h-[320px] opacity-15 pointer-events-none hidden lg:block"
          aria-hidden
        >
          <DecorativeWheel className="w-full h-full" />
        </div>

        {/* ── Decorative small wheel (top-left, all screens) ───────── */}
        <div
          className="absolute left-[-40px] top-[-40px] w-[160px] h-[160px] opacity-[0.07] pointer-events-none"
          aria-hidden
        >
          <DecorativeWheel className="w-full h-full" />
        </div>

        {/* ── Main content ─────────────────────────────────────────── */}
        <div className="relative px-8 py-14 md:px-16 md:py-20 max-w-2xl">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-6">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full"
              style={{ background: `${B.accent}20`, color: B.accent }}
            >
              <Zap className="size-3" />
              Get started today
            </span>
          </div>

          {/* Heading */}
          <h2
            id="final-cta-heading"
            className="font-display text-4xl md:text-5xl lg:text-[3.25rem] font-black text-white leading-[1.08] tracking-tight"
          >
            Ready to turn every visit into a{" "}
            <span style={{ color: B.accent }}>memorable&nbsp;spin?</span>
          </h2>

          {/* Subheading */}
          <p
            className="mt-5 text-base md:text-lg max-w-lg leading-relaxed"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Join 128+ shops already running spin-to-win campaigns with Mystery
            Unlock. Free to start, live in under 2 minutes, no credit card
            needed.
          </p>

          {/* Social proof: avatars + stars */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <AvatarStack />
            <div>
              <div className="flex items-center gap-1.5">
                <StarRating count={5} />
                <span className="text-sm font-bold text-white">4.9</span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                from 128+ shop owners
              </p>
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryButton
              asChild
              size="lg"
              className="font-bold shadow-lg"
              style={{ background: B.accent, color: "white" }}
            >
              <Link to="/auth" className="flex items-center gap-2">
                Start Free — No card needed
                <ArrowRight className="size-5" />
              </Link>
            </PrimaryButton>

            <OutlineButton
              asChild
              size="lg"
              className="font-bold border-white/20 text-white hover:bg-white/10"
            >
              <a href="#contact" className="flex items-center gap-2">
                Talk to sales
              </a>
            </OutlineButton>
          </div>

          {/* Trust strip */}
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
            {TRUST_ITEMS.map((t) => (
              <div key={t.label} className="flex items-center gap-1.5">
                <span style={{ color: `${B.accent}cc` }}>{t.icon}</span>
                <span className="text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Stats bar ────────────────────────────────────────────── */}
        <div
          className="relative px-8 md:px-16 pb-10 grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* divider background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "rgba(255,255,255,0.02)" }}
            aria-hidden
          />
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`relative pt-7 pb-2 ${
                i > 0 ? "md:pl-8 md:border-l md:border-white/[0.06]" : ""
              } ${i >= 2 ? "mt-5 md:mt-0" : ""}`}
            >
              <p
                className="font-display text-3xl font-black leading-none"
                style={{ color: i % 2 === 0 ? B.accent : "white" }}
              >
                {s.value}
              </p>
              <p
                className="text-[11px] font-medium mt-1.5"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </SectionContainer>
  );
}

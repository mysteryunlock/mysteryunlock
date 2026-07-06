import { memo } from "react";
import { TrendingUp, Users, Gift, Repeat } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SectionContainer } from "@/components/foundation/layout/SectionContainer";
import { FoundationCard } from "@/components/foundation/cards/Card";

// ─── Brand tokens ──────────────────────────────────────────────
const B = {
  dark: "#2A3E4B",
  mid: "#7FA6B8",
  light: "#D6E6EF",
  bg: "#F7FBFD",
  accent: "#FF6B00",
};

// ─── Outcome metrics ───────────────────────────────────────────
const METRICS = [
  {
    value: "38%",
    label: "Average foot traffic increase",
    sub: "in the first month",
    icon: <TrendingUp className="size-5" />,
    accent: "text-[#FF6B00]",
    glow: "from-[#FF6B00]/10 to-transparent",
  },
  {
    value: "3.2×",
    label: "More repeat visits",
    sub: "vs shops without loyalty",
    icon: <Repeat className="size-5" />,
    accent: "text-emerald-600",
    glow: "from-emerald-500/10 to-transparent",
  },
  {
    value: "94%",
    label: "Customer satisfaction",
    sub: "across all active shops",
    icon: <Users className="size-5" />,
    accent: "text-blue-600",
    glow: "from-blue-500/10 to-transparent",
  },
  {
    value: "<2m",
    label: "Average setup time",
    sub: "from sign-up to first spin",
    icon: <Gift className="size-5" />,
    accent: "text-violet-600",
    glow: "from-violet-500/10 to-transparent",
  },
];

// ─── Case studies ──────────────────────────────────────────────
const CASES = [
  {
    type: "Boutique Fashion",
    owner: "Anisha Rai",
    initials: "AR",
    avatarBg: "from-[#FF6B00] to-[#ff8c38]",
    result: "+38% foot traffic",
    resultSub: "in 4 weeks",
    quote:
      "Customers who used to visit once a month now come every week just to spin. It paid for itself in the first campaign.",
    tag: "Retail",
    tagColor: "bg-orange-100 text-orange-700",
    highlight: true,
  },
  {
    type: "Specialty Café",
    owner: "Bikash Shrestha",
    initials: "BS",
    avatarBg: "from-[#2A3E4B] to-[#7FA6B8]",
    result: "2.8× repeat orders",
    resultSub: "month over month",
    quote:
      "Setup took five minutes. The dashboard is genuinely beautiful and my regulars love getting the notification when a new campaign goes live.",
    tag: "Food & Beverage",
    tagColor: "bg-blue-100 text-blue-700",
    highlight: false,
  },
  {
    type: "Beauty Salon",
    owner: "Priya Karki",
    initials: "PK",
    avatarBg: "from-[#7c3aed] to-[#a78bfa]",
    result: "Rs.48,000 extra revenue",
    resultSub: "in 60 days",
    quote:
      "Our regulars come back just to spin again. It's the best retention tool we've used — and our customers actually thank us for it.",
    tag: "Beauty & Wellness",
    tagColor: "bg-violet-100 text-violet-700",
    highlight: false,
  },
];

// ─── Metric card ───────────────────────────────────────────────
function MetricCard({
  value,
  label,
  sub,
  icon,
  accent,
  glow,
}: (typeof METRICS)[number]) {
  return (
    <div className="relative rounded-2xl bg-white border border-[#2A3E4B]/8 shadow-sm p-6 overflow-hidden flex flex-col gap-3">
      {/* Subtle gradient wash */}
      <div
        aria-hidden
        className={`absolute inset-0 bg-gradient-to-br ${glow} pointer-events-none`}
      />
      <div className={`relative w-10 h-10 rounded-xl bg-current/10 grid place-items-center ${accent}`}
        style={{ background: "transparent" }}>
        <div className={`w-10 h-10 rounded-xl grid place-items-center ${accent}`}
          style={{ background: `color-mix(in srgb, currentColor 12%, transparent)` }}>
          {icon}
        </div>
      </div>
      <div className="relative">
        <p className={`font-display text-4xl font-black leading-none ${accent}`}>{value}</p>
        <p className="mt-1.5 text-sm font-semibold text-[#2A3E4B]">{label}</p>
        <p className="text-xs text-[#4a5b78] mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ─── Case study card ──────────────────────────────────────────
function CaseCard({
  type,
  owner,
  initials,
  avatarBg,
  result,
  resultSub,
  quote,
  tag,
  tagColor,
  highlight,
}: (typeof CASES)[number]) {
  return (
    <FoundationCard
      elevation={highlight ? "md" : "sm"}
      padding="none"
      className={`flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
        highlight ? "ring-2 ring-[#FF6B00]/30" : ""
      }`}
    >
      {/* Top accent bar */}
      <div
        className="h-1 w-full"
        style={{
          background: highlight
            ? `linear-gradient(90deg, ${B.accent}, #ff8c38)`
            : `linear-gradient(90deg, ${B.mid}, ${B.light})`,
        }}
      />

      <div className="p-6 flex flex-col gap-5 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarBg} grid place-items-center text-white text-sm font-black shrink-0`}
            >
              {initials}
            </div>
            <div>
              <p className="text-sm font-bold text-[#2A3E4B] leading-tight">{owner}</p>
              <p className="text-xs text-[#4a5b78]">{type}</p>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${tagColor}`}>
            {tag}
          </span>
        </div>

        {/* Result callout */}
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: highlight ? `${B.accent}12` : `${B.light}60` }}
        >
          <p
            className="font-display text-2xl font-black leading-none"
            style={{ color: highlight ? B.accent : B.dark }}
          >
            {result}
          </p>
          <p className="text-xs text-[#4a5b78] mt-0.5">{resultSub}</p>
        </div>

        {/* Quote */}
        <blockquote className="flex-1">
          <p className="text-sm leading-relaxed text-[#2A3E4B]/80 italic">
            "{quote}"
          </p>
        </blockquote>
      </div>
    </FoundationCard>
  );
}

// ─── CMS settings shape ───────────────────────────────────────
export interface RealResultsSettings {
  heading?: string;
  subtitle?: string;
}

// ─── Main export ──────────────────────────────────────────────
export const RealResults = memo(function RealResults({ settings }: { settings?: RealResultsSettings }) {
  return (
    <SectionContainer
      as="section"
      id="results"
      maxWidth="xl"
      spacing="none"
      className="py-20 lg:py-28"
      aria-labelledby="results-heading"
    >
      {/* Section header */}
      <div className="max-w-2xl mx-auto text-center mb-14">
        <span
          className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full mb-4"
          style={{ background: B.light, color: B.dark }}
        >
          Proven Results
        </span>
        <h2
          id="results-heading"
          className="font-display text-3xl md:text-4xl font-bold leading-tight"
          style={{ color: B.dark }}
        >
          {settings?.heading ?? "Numbers shops don't stop talking about"}
        </h2>
        <p className="mt-4 text-base md:text-lg" style={{ color: `${B.dark}cc` }}>
          {settings?.subtitle ?? "From boutiques to cafés to salons — Mystery Unlock delivers measurable growth from the very first campaign."}
        </p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {METRICS.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Divider with label */}
      <div className="flex items-center gap-4 mb-10">
        <div className="flex-1 h-px" style={{ background: `${B.dark}12` }} />
        <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: `${B.dark}66` }}>
          Shop stories
        </span>
        <div className="flex-1 h-px" style={{ background: `${B.dark}12` }} />
      </div>

      {/* Case studies */}
      <div className="grid md:grid-cols-3 gap-5 mb-14">
        {CASES.map((c) => (
          <CaseCard key={c.owner} {...c} />
        ))}
      </div>

      {/* Lead-in CTA toward pricing */}
      <div
        className="rounded-2xl px-8 py-10 text-center relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${B.dark}, ${B.mid})` }}
      >
        {/* Soft radial highlight */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${B.light}30, transparent 65%)`,
          }}
        />
        <div className="relative">
          <p className="text-white/70 text-sm font-semibold uppercase tracking-[0.2em] mb-3">
            Ready to see your own numbers?
          </p>
          <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">
            Your first campaign is free.
          </h3>
          <p className="text-white/70 text-base mb-7 max-w-md mx-auto">
            No credit card. No setup fee. Launch in under two minutes and
            watch the results come in.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center px-7 py-3 rounded-full font-bold text-sm text-[#2A3E4B] transition-all hover:scale-[1.03]"
              style={{ background: "white", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.25)" }}
            >
              Start Free Today
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center px-7 py-3 rounded-full font-bold text-sm text-white border border-white/30 transition-all hover:bg-white/10"
            >
              View Pricing
            </a>
          </div>
        </div>
      </div>
    </SectionContainer>
  );
});

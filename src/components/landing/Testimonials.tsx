import { useState } from "react";
import { Star, Quote, TrendingUp, Users, Award, ThumbsUp } from "lucide-react";
import { SectionContainer } from "@/components/foundation/layout/SectionContainer";
import { FoundationCard } from "@/components/foundation/cards/Card";
import { FoundationBadge } from "@/components/foundation/feedback/Badge";

// ─── Brand tokens ──────────────────────────────────────────────
const B = {
  dark: "#2A3E4B",
  mid: "#7FA6B8",
  light: "#D6E6EF",
  bg: "#F7FBFD",
  accent: "#FF6B00",
};

// ─── Types ─────────────────────────────────────────────────────
type Testimonial = {
  name: string;
  role: string;
  business: string;
  industry: string;
  avatar: string;
  quote: string;
  shortQuote: string;
  rating: 5;
  metric?: { value: string; label: string };
  featured?: boolean;
};

// ─── Data ──────────────────────────────────────────────────────
const TESTIMONIALS: Testimonial[] = [
  {
    name: "Anisha Rai",
    role: "Owner",
    business: "Anisha's Boutique",
    industry: "Fashion Retail",
    avatar: "AR",
    quote:
      "We launched our first spin campaign on a Saturday morning. By Monday we had more walk-ins than any week this year. The dashboard made it obvious which prizes were driving people back in — we doubled down on those instantly.",
    shortQuote: "More walk-ins than any week this year.",
    rating: 5,
    metric: { value: "+38%", label: "Foot traffic in month 1" },
    featured: true,
  },
  {
    name: "Bikash Shrestha",
    role: "Manager",
    business: "The Specialty Café",
    industry: "Food & Beverage",
    avatar: "BS",
    quote:
      "Setup took five minutes — I timed it. The QR code printed on our receipt roll that same afternoon. By Friday, customers were coming back specifically to spin again.",
    shortQuote: "Setup took five minutes. I timed it.",
    rating: 5,
    metric: { value: "2.8×", label: "Repeat order rate" },
  },
  {
    name: "Priya Karki",
    role: "Founder",
    business: "Priya's Beauty Studio",
    industry: "Beauty & Wellness",
    avatar: "PK",
    quote:
      "My regulars now rebook on the spot just to keep their spin streak alive. Referrals from word-of-mouth tripled in the first two months.",
    shortQuote: "Regulars rebook just to keep their streak alive.",
    rating: 5,
    metric: { value: "Rs.48K", label: "Extra revenue in 60 days" },
  },
  {
    name: "Sushil Thapa",
    role: "Operations Head",
    business: "Sushil's Kitchen",
    industry: "Restaurant",
    avatar: "ST",
    quote:
      "The wheel is the first thing customers mention when they post on Instagram. The branded experience feels premium — nothing like the old punch-card system.",
    shortQuote: "The wheel is the first thing customers mention on Instagram.",
    rating: 5,
    metric: { value: "+45%", label: "Weekend bookings" },
  },
  {
    name: "Maya Gurung",
    role: "Co-founder",
    business: "FitZone Studio",
    industry: "Fitness",
    avatar: "MG",
    quote:
      "Attendance on quiet Tuesdays jumped 60% once members knew they could hit their milestone spin earlier in the week. Mystery Unlock genuinely changed our retention.",
    shortQuote: "Tuesday attendance jumped 60% after launch.",
    rating: 5,
    metric: { value: "3.2×", label: "Member retention rate" },
  },
  {
    name: "Rohan Maharjan",
    role: "Owner",
    business: "PageTurner Books",
    industry: "Retail",
    avatar: "RM",
    quote:
      "I was skeptical a spin wheel would work for a bookshop. Within three weeks, our average basket grew by 28% as customers rounded up to qualify for a spin. Completely surprised me.",
    shortQuote: "Average basket grew 28%. Completely surprised me.",
    rating: 5,
    metric: { value: "+28%", label: "Average basket size" },
  },
];

const FEATURED = TESTIMONIALS.find((t) => t.featured)!;
const GRID = TESTIMONIALS.filter((t) => !t.featured);

// ─── Rating aggregate ──────────────────────────────────────────
const AGGREGATE = {
  score: "4.9",
  total: "128",
  breakdown: [
    { stars: 5, pct: 91 },
    { stars: 4, pct: 7 },
    { stars: 3, pct: 2 },
    { stars: 2, pct: 0 },
    { stars: 1, pct: 0 },
  ],
};

// ─── Stars component ───────────────────────────────────────────
function Stars({ count = 5, size = 14 }: { count?: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i < count ? "fill-amber-400 text-amber-400" : "fill-[#D6E6EF] text-[#D6E6EF]"}
        />
      ))}
    </div>
  );
}

// ─── Avatar ────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  "from-[#FF6B00] to-amber-500",
  "from-[#2A3E4B] to-[#7FA6B8]",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-blue-600",
  "from-rose-500 to-pink-600",
];

function Avatar({ initials, index, size = "md" }: { initials: string; index: number; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "w-16 h-16 text-xl" : size === "sm" ? "w-9 h-9 text-sm" : "w-11 h-11 text-base";
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]} grid place-items-center text-white font-bold shrink-0`}
    >
      {initials}
    </div>
  );
}

// ─── Mini testimonial card ─────────────────────────────────────
function MiniCard({ t, index }: { t: Testimonial; index: number }) {
  return (
    <FoundationCard
      elevation="sm"
      padding="md"
      hover="lift"
      className="flex flex-col gap-4 h-full"
    >
      <Stars size={13} />
      <blockquote className="text-sm leading-relaxed flex-1" style={{ color: `${B.dark}e6` }}>
        "{t.shortQuote}"
      </blockquote>

      {t.metric && (
        <div
          className="rounded-xl px-3 py-2.5 flex items-center gap-3"
          style={{ background: `${B.light}80` }}
        >
          <TrendingUp className="size-4 shrink-0" style={{ color: B.accent }} />
          <div>
            <p className="font-display text-base font-black" style={{ color: B.accent }}>
              {t.metric.value}
            </p>
            <p className="text-[10px] text-[#4a5b78] leading-none">{t.metric.label}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1 border-t border-[#2A3E4B]/6">
        <Avatar initials={t.avatar} index={index + 1} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: B.dark }}>
            {t.name}
          </p>
          <p className="text-[11px] truncate" style={{ color: `${B.dark}80` }}>
            {t.role}, {t.business}
          </p>
        </div>
        <FoundationBadge variant="subtle" className="ml-auto shrink-0 text-[9px]">
          {t.industry}
        </FoundationBadge>
      </div>
    </FoundationCard>
  );
}

// ─── Rating panel ──────────────────────────────────────────────
function RatingPanel() {
  return (
    <FoundationCard elevation="sm" padding="md" className="flex flex-col gap-5">
      {/* Score */}
      <div className="text-center pb-4 border-b border-[#2A3E4B]/8">
        <p className="font-display text-5xl font-black" style={{ color: B.dark }}>
          {AGGREGATE.score}
        </p>
        <Stars size={18} />
        <p className="mt-2 text-xs" style={{ color: `${B.dark}80` }}>
          Based on {AGGREGATE.total} verified reviews
        </p>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-2">
        {AGGREGATE.breakdown.map((row) => (
          <div key={row.stars} className="flex items-center gap-2.5">
            <span className="text-[11px] font-semibold w-3 text-right" style={{ color: B.dark }}>
              {row.stars}
            </span>
            <Star className="size-3 fill-amber-400 text-amber-400 shrink-0" />
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: `${B.light}` }}>
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${row.pct}%` }}
              />
            </div>
            <span className="text-[11px] w-7 text-right" style={{ color: `${B.dark}80` }}>
              {row.pct}%
            </span>
          </div>
        ))}
      </div>

      {/* Trust icons */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#2A3E4B]/8">
        {[
          { icon: <ThumbsUp className="size-4" />, label: "NPS 72" },
          { icon: <Award className="size-4" />, label: "Verified" },
          { icon: <Users className="size-4" />, label: "128 shops" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl flex flex-col items-center gap-1.5 py-2.5 text-center"
            style={{ background: `${B.light}50` }}
          >
            <span style={{ color: B.dark }}>{item.icon}</span>
            <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: `${B.dark}99` }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </FoundationCard>
  );
}

// ─── Main export ───────────────────────────────────────────────
export function TestimonialsShowcase() {
  const [expanded, setExpanded] = useState(false);

  return (
    <SectionContainer
      as="section"
      id="testimonials-showcase"
      maxWidth="xl"
      spacing="none"
      className="py-20 lg:py-28"
      aria-labelledby="testimonials-heading"
    >
      {/* Section header */}
      <div className="max-w-2xl mx-auto text-center mb-14">
        <span
          className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full mb-4"
          style={{ background: B.light, color: B.dark }}
        >
          Loved by Shop Owners
        </span>
        <h2
          id="testimonials-heading"
          className="font-display text-3xl md:text-4xl font-bold leading-tight"
          style={{ color: B.dark }}
        >
          Real shops. Real results. Real love.
        </h2>
        <p className="mt-4 text-base md:text-lg" style={{ color: `${B.dark}cc` }}>
          Over 128 shops across Nepal trust Mystery Unlock to run their loyalty campaigns.
          Here's what they say.
        </p>
      </div>

      {/* Featured testimonial + rating side by side */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-5 mb-6">
        {/* Featured quote */}
        <FoundationCard
          elevation="md"
          padding="none"
          className="overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${B.dark} 0%, #3d5a6b 100%)` }}
        >
          <div className="p-7 md:p-10 flex flex-col gap-6 h-full">
            {/* Quote mark */}
            <div
              className="w-12 h-12 rounded-2xl grid place-items-center"
              style={{ background: `${B.accent}25` }}
            >
              <Quote className="size-6" style={{ color: B.accent }} />
            </div>

            <Stars size={16} />

            <blockquote
              className="text-xl md:text-2xl font-medium leading-relaxed flex-1"
              style={{ color: "#ffffffee" }}
            >
              "{FEATURED.quote}"
            </blockquote>

            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-3.5">
                <Avatar initials={FEATURED.avatar} index={0} size="lg" />
                <div>
                  <p className="font-bold text-white text-base">{FEATURED.name}</p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {FEATURED.role}, {FEATURED.business}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {FEATURED.industry}
                  </p>
                </div>
              </div>

              {FEATURED.metric && (
                <div
                  className="ml-auto rounded-2xl px-4 py-3 text-right"
                  style={{ background: `${B.accent}20`, border: `1px solid ${B.accent}40` }}
                >
                  <p
                    className="font-display text-3xl font-black"
                    style={{ color: B.accent }}
                  >
                    {FEATURED.metric.value}
                  </p>
                  <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                    {FEATURED.metric.label}
                  </p>
                </div>
              )}
            </div>
          </div>
        </FoundationCard>

        {/* Rating panel */}
        <RatingPanel />
      </div>

      {/* Testimonial grid — 3 always visible, expand button for 3 more */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        {(expanded ? GRID : GRID.slice(0, 3)).map((t, i) => (
          <MiniCard key={t.name} t={t} index={i} />
        ))}
      </div>

      {/* Show more / less toggle */}
      {!expanded && GRID.length > 3 && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold border transition-all hover:shadow-sm"
            style={{
              color: B.dark,
              borderColor: `${B.dark}25`,
              background: "white",
            }}
          >
            Show {GRID.length - 3} more reviews
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      )}

      {expanded && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold border transition-all hover:shadow-sm"
            style={{
              color: B.dark,
              borderColor: `${B.dark}25`,
              background: "white",
            }}
          >
            Show less
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
        </div>
      )}
    </SectionContainer>
  );
}

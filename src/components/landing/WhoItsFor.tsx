import { useState } from "react";
import {
  Coffee,
  Utensils,
  Smartphone,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Dumbbell,
  Pill,
  CheckCircle2,
  Sparkles,
  Plus,
} from "lucide-react";
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

// ─── Industry data — extend this array to add more industries ──
export type Industry = {
  key: string;
  icon: React.ReactNode;
  name: string;
  tagline: string;
  description: string;
  useCases: string[];
  sampleCampaign: {
    name: string;
    prizes: string[];
  };
  accentColor: string;       // Tailwind bg- class for icon gradient
  lightBg: string;           // Tailwind bg- class for icon badge bg
  textColor: string;         // Tailwind text- class for accent text
};

export const INDUSTRIES: Industry[] = [
  {
    key: "cafe",
    icon: <Coffee className="size-5" />,
    name: "Cafés & Coffee Shops",
    tagline: "Turn daily drinkers into loyal fans",
    description:
      "High-frequency visits make cafés the perfect fit. A morning spin campaign converts habit into attachment — and brings regulars back even on off days.",
    useCases: [
      "Replace old punch-card loyalty schemes",
      "Boost footfall during slow morning slots",
      "Drive repeat orders with streak incentives",
    ],
    sampleCampaign: {
      name: "Morning Spin",
      prizes: ["Free Upgrade", "10% Off Next", "Mystery Drink", "Free Cookie"],
    },
    accentColor: "from-amber-500 to-amber-600",
    lightBg: "bg-amber-50",
    textColor: "text-amber-600",
  },
  {
    key: "restaurant",
    icon: <Utensils className="size-5" />,
    name: "Restaurants",
    tagline: "Fill tables and keep diners returning",
    description:
      "A post-meal spin turns a good experience into a reason to come back. Tie it to the bill receipt and watch weekend bookings climb.",
    useCases: [
      "Post-meal reward printed on the receipt",
      "Weekend group dining bonuses",
      "Drive rebooking at the table",
    ],
    sampleCampaign: {
      name: "Table Spin",
      prizes: ["Free Dessert", "10% Off Bill", "Free Appetiser", "Rs.200 Off"],
    },
    accentColor: "from-emerald-500 to-teal-600",
    lightBg: "bg-emerald-50",
    textColor: "text-emerald-600",
  },
  {
    key: "mobile",
    icon: <Smartphone className="size-5" />,
    name: "Mobile & Electronics",
    tagline: "Reward buyers and drive repeat purchases",
    description:
      "Electronics customers often buy once and disappear. A post-purchase spin brings them back for accessories, repairs, and upgrades.",
    useCases: [
      "After-purchase spin to build relationship",
      "Accessory upsell wheel at checkout",
      "Service plan and warranty incentives",
    ],
    sampleCampaign: {
      name: "Tech Spin",
      prizes: ["Free Screen Guard", "Rs.500 Off", "Free Case", "Extended Warranty"],
    },
    accentColor: "from-blue-500 to-blue-600",
    lightBg: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    key: "salon",
    icon: <Scissors className="size-5" />,
    name: "Beauty Salons",
    tagline: "Keep clients booked and raving",
    description:
      "Salons run on repeat appointments. A post-service spin and referral wheel turns your chair into a loyalty engine that runs itself.",
    useCases: [
      "Post-appointment reward to lock in rebooking",
      "Referral spin for bringing a friend",
      "Streak reward for 3 visits in a month",
    ],
    sampleCampaign: {
      name: "Glow-Up Spin",
      prizes: ["Free Treatment", "20% Off Color", "Luxury Mask", "Express Blow-dry"],
    },
    accentColor: "from-violet-500 to-purple-600",
    lightBg: "bg-violet-50",
    textColor: "text-violet-600",
  },
  {
    key: "fashion",
    icon: <ShoppingBag className="size-5" />,
    name: "Fashion Stores",
    tagline: "Turn browsers into buyers, buyers into loyalists",
    description:
      "Tie spins to a minimum spend threshold and watch average basket size grow as customers round up their purchase to qualify.",
    useCases: [
      "Spin unlock at Rs.1,000+ purchase",
      "Season opener campaign for new arrivals",
      "VIP tier reward for top customers",
    ],
    sampleCampaign: {
      name: "Style Spin",
      prizes: ["Rs.500 Voucher", "Free Gift Wrap", "Mystery Accessory", "15% Off"],
    },
    accentColor: "from-[#FF6B00] to-amber-500",
    lightBg: "bg-orange-50",
    textColor: "text-[#FF6B00]",
  },
  {
    key: "supermarket",
    icon: <ShoppingCart className="size-5" />,
    name: "Supermarkets",
    tagline: "Reward every basket, build weekly habits",
    description:
      "High visit frequency meets high volume. A per-basket spin scheme drives weekly habit and gives shoppers a reason to choose you over the competition.",
    useCases: [
      "Per-visit spin above a minimum spend",
      "Double-spin weekends to drive traffic",
      "Festive holiday campaigns with big prizes",
    ],
    sampleCampaign: {
      name: "Basket Spin",
      prizes: ["5% Off Basket", "Free Product", "Rs.200 Voucher", "Mystery Bundle"],
    },
    accentColor: "from-[#2A3E4B] to-[#7FA6B8]",
    lightBg: "bg-[#D6E6EF]/70",
    textColor: "text-[#2A3E4B]",
  },
  {
    key: "gym",
    icon: <Dumbbell className="size-5" />,
    name: "Gyms & Fitness Studios",
    tagline: "Reward consistency, reduce churn",
    description:
      "Gyms lose members in month 2. A check-in milestone spin creates a habit loop — members show up more often just to keep their streak alive.",
    useCases: [
      "Spin unlock every 10 check-ins",
      "Class booking reward for regulars",
      "Membership renewal bonus campaigns",
    ],
    sampleCampaign: {
      name: "Milestone Spin",
      prizes: ["Free PT Session", "Protein Shake", "Month Extension", "Gym Gear"],
    },
    accentColor: "from-rose-500 to-pink-600",
    lightBg: "bg-rose-50",
    textColor: "text-rose-600",
  },
  {
    key: "pharmacy",
    icon: <Pill className="size-5" />,
    name: "Pharmacies",
    tagline: "Build trust and reward healthy habits",
    description:
      "Pharmacies thrive on regular customers. A wellness spin campaign rewards repeat visits, seasonal health purchases, and health check tie-ins.",
    useCases: [
      "Spin on purchases above a threshold",
      "Seasonal campaigns (flu season, supplements)",
      "Reward for health check visits",
    ],
    sampleCampaign: {
      name: "Wellness Spin",
      prizes: ["Free Vitamin Sample", "Health Voucher", "10% Off", "Free Consultation"],
    },
    accentColor: "from-cyan-500 to-cyan-600",
    lightBg: "bg-cyan-50",
    textColor: "text-cyan-600",
  },
];

// ─── How many cards to show before "Show more" ─────────────────
const INITIAL_VISIBLE = 4;

// ─── Mini campaign pill strip ──────────────────────────────────
function CampaignPills({ prizes }: { prizes: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {prizes.map((p) => (
        <span
          key={p}
          className="text-[10px] font-semibold px-2 py-1 rounded-full bg-white border"
          style={{ borderColor: `${B.dark}15`, color: B.dark }}
        >
          {p}
        </span>
      ))}
    </div>
  );
}

// ─── Individual industry card ──────────────────────────────────
function IndustryCard({ industry, index }: { industry: Industry; index: number }) {
  return (
    <FoundationCard
      elevation="sm"
      hover="lift"
      padding="md"
      className="flex flex-col gap-4 h-full"
      style={{
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl grid place-items-center bg-gradient-to-br ${industry.accentColor} text-white shrink-0`}
        >
          {industry.icon}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight" style={{ color: B.dark }}>
            {industry.name}
          </p>
          <p className={`text-[11px] font-semibold mt-0.5 ${industry.textColor}`}>
            {industry.tagline}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed flex-1" style={{ color: `${B.dark}cc` }}>
        {industry.description}
      </p>

      {/* Use cases */}
      <ul className="space-y-1.5">
        {industry.useCases.map((uc) => (
          <li key={uc} className="flex items-start gap-2 text-[11px]" style={{ color: `${B.dark}e0` }}>
            <CheckCircle2
              className={`size-3.5 mt-0.5 shrink-0 ${industry.textColor}`}
              aria-hidden
            />
            {uc}
          </li>
        ))}
      </ul>

      {/* Sample campaign */}
      <div
        className={`rounded-xl p-3 ${industry.lightBg}`}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className={`size-3 ${industry.textColor}`} aria-hidden />
          <span className={`text-[10px] font-bold uppercase tracking-wide ${industry.textColor}`}>
            {industry.sampleCampaign.name}
          </span>
        </div>
        <CampaignPills prizes={industry.sampleCampaign.prizes} />
      </div>
    </FoundationCard>
  );
}

// ─── Featured hero card (left column) ─────────────────────────
function FeaturedCard() {
  return (
    <FoundationCard
      elevation="md"
      padding="none"
      className="overflow-hidden h-full"
      style={{ background: `linear-gradient(135deg, ${B.dark} 0%, #3d5a6b 100%)` }}
    >
      <div className="p-7 md:p-10 flex flex-col gap-6 h-full">
        {/* Badge */}
        <div
          className="w-12 h-12 rounded-2xl grid place-items-center"
          style={{ background: `${B.accent}25` }}
        >
          <ShoppingCart className="size-6" style={{ color: B.accent }} />
        </div>

        <div>
          <span
            className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full mb-4"
            style={{ background: `${B.accent}30`, color: B.accent }}
          >
            Any type of shop
          </span>
          <h3
            className="font-display text-2xl md:text-3xl font-bold leading-tight text-white"
          >
            If customers walk through your door, Mystery Unlock works for you.
          </h3>
          <p className="mt-4 text-sm md:text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
            We built one platform that adapts to every retail context — from a corner pharmacy
            to a five-branch gym chain. The spin wheel, QR code, and dashboard stay the same.
            Your prizes, campaign timing, and branding are completely yours.
          </p>
        </div>

        {/* Industry chip row */}
        <div className="flex flex-wrap gap-2 mt-auto">
          {INDUSTRIES.map((ind) => (
            <span
              key={ind.key}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: "rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {ind.icon}
              {ind.name.split(" ")[0]}
            </span>
          ))}
        </div>

        {/* CTA */}
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 self-start px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:scale-[1.03]"
          style={{ background: B.accent, color: "#fff", boxShadow: `0 8px 20px -8px ${B.accent}` }}
        >
          Start your campaign
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </FoundationCard>
  );
}

// ─── Summary panel (right column) ─────────────────────────────
function SummaryPanel() {
  const stats = [
    { value: `${INDUSTRIES.length}`, label: "Industry types supported", icon: <ShoppingBag className="size-4" /> },
    { value: "128+", label: "Active shops across Nepal", icon: <CheckCircle2 className="size-4" /> },
    { value: "<2m", label: "Average setup time", icon: <Sparkles className="size-4" /> },
  ];

  return (
    <FoundationCard elevation="sm" padding="md" className="flex flex-col gap-5 h-full">
      <div>
        <p className="font-display text-lg font-bold" style={{ color: B.dark }}>
          One platform, every shop type
        </p>
        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: `${B.dark}99` }}>
          Whether you're running a single café or managing a chain of salons — the same
          powerful tool runs every campaign.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-4 rounded-xl px-4 py-3"
            style={{ background: `${B.light}60` }}
          >
            <div
              className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
              style={{ background: B.dark, color: "#fff" }}
            >
              {s.icon}
            </div>
            <div>
              <p className="font-display text-xl font-black" style={{ color: B.dark }}>
                {s.value}
              </p>
              <p className="text-[11px] leading-tight" style={{ color: `${B.dark}80` }}>
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* "More coming" nudge */}
      <div
        className="mt-auto rounded-xl p-4 flex items-start gap-3"
        style={{ background: `${B.accent}12`, border: `1px dashed ${B.accent}50` }}
      >
        <Plus className="size-4 mt-0.5 shrink-0" style={{ color: B.accent }} />
        <p className="text-[11px] leading-relaxed" style={{ color: `${B.dark}cc` }}>
          <span className="font-bold" style={{ color: B.accent }}>More on the way.</span>{" "}
          Schools, event venues, co-working spaces — new verticals are added based on
          merchant demand.
        </p>
      </div>
    </FoundationCard>
  );
}

// ─── Main export ───────────────────────────────────────────────
export function WhoItsFor() {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? INDUSTRIES : INDUSTRIES.slice(0, INITIAL_VISIBLE);
  const hiddenCount = INDUSTRIES.length - INITIAL_VISIBLE;

  return (
    <SectionContainer
      as="section"
      id="who-its-for"
      maxWidth="xl"
      spacing="none"
      className="py-20 lg:py-28"
      aria-labelledby="who-its-for-heading"
    >
      {/* Section header */}
      <div className="max-w-2xl mx-auto text-center mb-14">
        <span
          className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full mb-4"
          style={{ background: B.light, color: B.dark }}
        >
          Who It's Built For
        </span>
        <h2
          id="who-its-for-heading"
          className="font-display text-3xl md:text-4xl font-bold leading-tight"
          style={{ color: B.dark }}
        >
          Works for every kind of shop
        </h2>
        <p className="mt-4 text-base md:text-lg" style={{ color: `${B.dark}cc` }}>
          Mystery Unlock isn't a one-size-fits-all loyalty tool — it's shaped
          around how each business type actually works.
        </p>
      </div>

      {/* Featured card + summary panel */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-5 mb-6">
        <FeaturedCard />
        <SummaryPanel />
      </div>

      {/* Industry grid */}
      <div id="industry-grid" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {visible.map((industry, i) => (
          <IndustryCard key={industry.key} industry={industry} index={i} />
        ))}
      </div>

      {/* Show more / less */}
      <div className="text-center">
        <button
          type="button"
          aria-expanded={showAll}
          aria-controls="industry-grid"
          onClick={() => setShowAll((v) => !v)}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold border transition-all hover:shadow-sm"
          style={{ color: B.dark, borderColor: `${B.dark}25`, background: "white" }}
        >
          {showAll ? "Show less" : `Show ${hiddenCount} more industries`}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ transform: showAll ? "rotate(180deg)" : "none", transition: "transform 200ms" }}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
    </SectionContainer>
  );
}

import { useState, memo } from "react";
import {
  Coffee,
  Scissors,
  ShoppingBag,
  Utensils,
  Dumbbell,
  BookOpen,
  Sparkles,
  Gift,
  TrendingUp,
  Users,
  Star,
  Zap,
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
  accent: "#FF6B1A",
};

// ─── Industry data ─────────────────────────────────────────────
const INDUSTRIES = [
  {
    key: "cafe",
    icon: <Coffee className="size-6" />,
    label: "Cafés & Coffee Shops",
    tagline: "Turn daily drinkers into loyal fans",
    color: "from-amber-500 to-amber-600",
    lightBg: "bg-amber-50",
    textAccent: "text-amber-600",
    campaign: "Morning Spin",
    prizes: ["Free Upgrade", "10% Off Next", "Free Cookie", "Mystery Drink"],
    stat: { value: "2.8×", label: "more repeat orders" },
    story:
      "Kiran's Café launched a morning spin campaign. By week two, daily footfall doubled — regulars started arriving earlier just to spin before work.",
    badges: ["Daily habit", "High frequency", "Low ticket"],
  },
  {
    key: "boutique",
    icon: <ShoppingBag className="size-6" />,
    label: "Boutiques & Fashion",
    tagline: "Give every purchase a moment of delight",
    color: "from-[#FF6B1A] to-[#ff8c38]",
    lightBg: "bg-orange-50",
    textAccent: "text-[#FF6B1A]",
    campaign: "Season Opener Spin",
    prizes: ["15% Discount", "Free Gift Wrap", "Rs.500 Voucher", "Mystery Accessory"],
    stat: { value: "+38%", label: "foot traffic in 30 days" },
    story:
      "Anisha's Boutique tied spins to purchases over Rs.1,000. Customers started buying more per visit to hit the threshold and earn their spin.",
    badges: ["High ticket", "Seasonal", "Premium feel"],
  },
  {
    key: "salon",
    icon: <Scissors className="size-6" />,
    label: "Salons & Beauty",
    tagline: "Reward the clients who keep you booked",
    color: "from-violet-500 to-violet-600",
    lightBg: "bg-violet-50",
    textAccent: "text-violet-600",
    campaign: "Glow-Up Spin",
    prizes: ["Free Treatment", "20% Off Color", "Express Blow-dry", "Luxury Hair Mask"],
    stat: { value: "Rs.48K", label: "extra revenue in 60 days" },
    story:
      "Priya's Salon gave a spin with every appointment. Clients started rebooking on the spot to keep their spin streak — and referrals tripled.",
    badges: ["Appointment-based", "Upsell friendly", "High loyalty"],
  },
  {
    key: "restaurant",
    icon: <Utensils className="size-6" />,
    label: "Restaurants & Food",
    tagline: "Make every meal a reason to return",
    color: "from-emerald-500 to-emerald-600",
    lightBg: "bg-emerald-50",
    textAccent: "text-emerald-600",
    campaign: "Foodie Friday Spin",
    prizes: ["Free Dessert", "10% Off Bill", "Free Appetiser", "Rs.200 Voucher"],
    stat: { value: "94%", label: "customer satisfaction" },
    story:
      "Sushil's Grill added a QR code to every table receipt. Weekend covers increased by 45% as diners booked again specifically to claim their spin.",
    badges: ["Table turnover", "Group dining", "Weekend boost"],
  },
  {
    key: "gym",
    icon: <Dumbbell className="size-6" />,
    label: "Gyms & Fitness",
    tagline: "Reward consistency, reduce churn",
    color: "from-blue-500 to-blue-600",
    lightBg: "bg-blue-50",
    textAccent: "text-blue-600",
    campaign: "Milestone Spin",
    prizes: ["Free PT Session", "Protein Shake", "Month Extension", "Branded Gear"],
    stat: { value: "3.2×", label: "member retention rate" },
    story:
      "FitZone gave members a spin for every 10 check-ins. Attendance on quiet Tuesdays jumped 60% as members tried to hit their milestone faster.",
    badges: ["Membership", "Check-in habit", "Goal-driven"],
  },
  {
    key: "bookshop",
    icon: <BookOpen className="size-6" />,
    label: "Bookshops & Retail",
    tagline: "Give browsers a reason to buy — and return",
    color: "from-[#2A3E4B] to-[#7FA6B8]",
    lightBg: "bg-[#D6E6EF]/60",
    textAccent: "text-[#2A3E4B]",
    campaign: "Reader's Wheel",
    prizes: ["Free Bookmark Set", "10% Off Any Book", "Mystery Novel", "Rs.300 Credit"],
    stat: { value: "<2m", label: "to launch first campaign" },
    story:
      "PageTurner Books added a spin with every purchase over Rs.400. Average basket size grew by 28% as customers rounded up to qualify.",
    badges: ["Niche appeal", "Community vibe", "Basket builder"],
  },
];

// ─── Mini campaign mockup ──────────────────────────────────────
function MiniCampaign({
  campaign,
  prizes,
  color,
}: {
  campaign: string;
  prizes: string[];
  color: string;
}) {
  return (
    <div className="rounded-xl overflow-hidden shadow-sm border border-white/20">
      {/* Header */}
      <div className={`bg-gradient-to-r ${color} px-3 py-2.5 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-white/90" />
          <span className="text-[11px] font-bold text-white">{campaign}</span>
        </div>
        <span className="text-[9px] bg-white/25 text-white font-bold rounded-full px-2 py-0.5">
          LIVE
        </span>
      </div>
      {/* Prizes */}
      <div className="bg-white px-3 py-2 grid grid-cols-2 gap-1.5">
        {prizes.map((p) => (
          <div
            key={p}
            className="flex items-center gap-1.5 rounded-lg bg-[#F4F6FA] px-2 py-1"
          >
            <Gift className="size-2.5 text-[#4a5b78] shrink-0" />
            <span className="text-[9px] font-semibold text-[#2A3E4B] truncate">{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Industry card ────────────────────────────────────────────
function IndustryCard({
  industry,
  isActive,
  onClick,
}: {
  industry: (typeof INDUSTRIES)[number];
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`industry-tab-${industry.key}`}
      aria-selected={isActive}
      aria-controls="industry-tabpanel"
      onClick={onClick}
      className={`group w-full flex flex-col items-center gap-2 rounded-2xl p-4 text-center transition-all duration-200 border ${
        isActive
          ? "border-[#FF6B1A]/40 bg-white shadow-md shadow-[#FF6B1A]/10"
          : "border-transparent bg-white/60 hover:bg-white hover:border-[#2A3E4B]/10 hover:shadow-sm"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-xl grid place-items-center transition-all bg-gradient-to-br ${industry.color} text-white ${
          isActive ? "scale-110 shadow-md" : "scale-100 group-hover:scale-105"
        }`}
      >
        {industry.icon}
      </div>
      <span
        className={`text-[11px] font-bold leading-tight transition-colors ${
          isActive ? "text-[#2A3E4B]" : "text-[#4a5b78] group-hover:text-[#2A3E4B]"
        }`}
      >
        {industry.label.split(" & ")[0]}
      </span>
    </button>
  );
}

// ─── Detail panel ─────────────────────────────────────────────
function DetailPanel({ industry }: { industry: (typeof INDUSTRIES)[number] }) {
  return (
    <div className="grid md:grid-cols-2 gap-6 items-start">
      {/* Left: story + badges */}
      <div className="flex flex-col gap-5">
        <div>
          <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full mb-3 ${industry.lightBg} ${industry.textAccent}`}>
            {industry.icon}
            {industry.label}
          </div>
          <h4
            className="font-display text-xl md:text-2xl font-bold leading-tight mb-2"
            style={{ color: B.dark }}
          >
            {industry.tagline}
          </h4>
          <p className="text-sm leading-relaxed" style={{ color: `${B.dark}99` }}>
            {industry.story}
          </p>
        </div>

        {/* Outcome stat */}
        <FoundationCard elevation="sm" padding="sm" className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl grid place-items-center bg-gradient-to-br ${industry.color} text-white shrink-0`}>
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className={`font-display text-2xl font-black ${industry.textAccent}`}>
              {industry.stat.value}
            </p>
            <p className="text-xs text-[#4a5b78]">{industry.stat.label}</p>
          </div>
        </FoundationCard>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {industry.badges.map((b) => (
            <span
              key={b}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${industry.lightBg} ${industry.textAccent}`}
            >
              {b}
            </span>
          ))}
        </div>

        {/* Feature checklist */}
        <ul className="space-y-2">
          {[
            "Branded spin wheel, zero design skills needed",
            "QR code ready to print or display in seconds",
            "Real-time dashboard to track every result",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: B.dark }}>
              <div className="w-5 h-5 rounded-full bg-emerald-100 grid place-items-center shrink-0">
                <Star className="size-3 text-emerald-600 fill-emerald-600" />
              </div>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Right: mini campaign mockup */}
      <div className="flex flex-col gap-4">
        <MiniCampaign
          campaign={industry.campaign}
          prizes={industry.prizes}
          color={industry.color}
        />

        {/* Customer metrics strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Users className="size-4" />, value: "1,240", label: "Customers" },
            { icon: <Zap className="size-4" />, value: "8,430", label: "Spins" },
            { icon: <Gift className="size-4" />, value: "474", label: "Rewards" },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm p-3 flex flex-col items-center gap-1 text-center"
            >
              <div
                className={`w-7 h-7 rounded-lg grid place-items-center ${industry.lightBg} ${industry.textAccent}`}
              >
                {m.icon}
              </div>
              <p className="font-display text-lg font-black text-[#2A3E4B]">{m.value}</p>
              <p className="text-[9px] uppercase tracking-wide font-semibold text-[#4a5b78]">
                {m.label}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          to="/auth"
          className={`w-full py-3 rounded-xl text-white text-sm font-bold text-center transition-all hover:scale-[1.02] bg-gradient-to-r ${industry.color}`}
          style={{ boxShadow: "0 8px 20px -8px rgba(0,0,0,0.3)" }}
        >
          Launch your {industry.label.split(" & ")[0].toLowerCase()} campaign <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block" aria-hidden><path d="m9 18 6-6-6-6"/></svg>
        </Link>
      </div>
    </div>
  );
}

// ─── CMS settings shape ───────────────────────────────────────
export interface IndustryShowcaseSettings {
  heading?: string;
  subtitle?: string;
}

// ─── Main export ──────────────────────────────────────────────
export const IndustryShowcase = memo(function IndustryShowcase({ settings }: { settings?: IndustryShowcaseSettings }) {
  const [active, setActive] = useState(0);
  const industry = INDUSTRIES[active];

  return (
    <SectionContainer
      as="section"
      id="industries"
      maxWidth="xl"
      spacing="none"
      className="py-20 lg:py-28"
      aria-labelledby="industries-heading"
    >
      {/* Section header */}
      <div className="max-w-2xl mx-auto text-center mb-12">
        <span
          className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full mb-4"
          style={{ background: B.light, color: B.dark }}
        >
          Built for Your Business
        </span>
        <h2
          id="industries-heading"
          className="font-display text-3xl md:text-4xl font-bold leading-tight"
          style={{ color: B.dark }}
        >
          {settings?.heading ?? "Whatever you sell, Mystery Unlock fits"}
        </h2>
        <p className="mt-4 text-base md:text-lg" style={{ color: `${B.dark}cc` }}>
          {settings?.subtitle ?? "From the morning coffee rush to the weekend boutique drop — every business type has a campaign waiting to launch."}
        </p>
      </div>

      {/* Industry selector */}
      <div
        className="rounded-2xl p-3 mb-8"
        style={{ background: `${B.light}50` }}
      >
        <div
          className="grid grid-cols-3 sm:grid-cols-6 gap-2"
          role="tablist"
          aria-label="Industry types"
          aria-orientation="horizontal"
        >
          {INDUSTRIES.map((ind, i) => (
            <IndustryCard
              key={ind.key}
              industry={ind}
              isActive={active === i}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <FoundationCard
        elevation="md"
        padding="lg"
        className="overflow-hidden"
        role="tabpanel"
        id="industry-tabpanel"
        aria-labelledby={`industry-tab-${industry.key}`}
      >
        <div key={industry.key} className="animate-fade-in">
          <DetailPanel industry={industry} />
        </div>
      </FoundationCard>
    </SectionContainer>
  );
});

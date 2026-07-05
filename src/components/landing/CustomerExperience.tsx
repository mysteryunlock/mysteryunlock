import {
  Gift,
  Coffee,
  Star,
  Bell,
  Trophy,
  ShoppingBag,
  Headphones,
  Sparkles,
  Check,
  X,
  ChevronRight,
  Flame,
  Crown,
  Zap,
  Heart,
} from "lucide-react";
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

// ─── Reward cards data ─────────────────────────────────────────
const REWARDS = [
  { label: "10% Discount", sub: "Valid on next purchase", color: "from-[#FF6B00] to-[#ff8c38]", icon: <Sparkles className="size-4" /> },
  { label: "Free Coffee", sub: "Redeem at any visit", color: "from-[#2A3E4B] to-[#7FA6B8]", icon: <Coffee className="size-4" /> },
  { label: "Mystery Gift", sub: "Reveal on your next spin", color: "from-[#7c3aed] to-[#a78bfa]", icon: <Gift className="size-4" /> },
];

// ─── Purchase history ─────────────────────────────────────────
const PURCHASES = [
  { label: "Coffee", date: "Today", amount: "Rs.180", icon: <Coffee className="size-3.5" />, color: "bg-amber-50 text-amber-600" },
  { label: "Burger", date: "Yesterday", amount: "Rs.350", icon: <Flame className="size-3.5" />, color: "bg-orange-50 text-orange-600" },
  { label: "Headphones", date: "3 days ago", amount: "Rs.2,400", icon: <Headphones className="size-3.5" />, color: "bg-violet-50 text-violet-600" },
  { label: "Accessories", date: "1 week ago", amount: "Rs.890", icon: <ShoppingBag className="size-3.5" />, color: "bg-blue-50 text-blue-600" },
];

// ─── Achievement badges ────────────────────────────────────────
const BADGES = [
  { label: "First Visit", icon: <Star className="size-3.5" />, earned: true, color: "bg-amber-100 text-amber-700" },
  { label: "Lucky Spinner", icon: <Sparkles className="size-3.5" />, earned: true, color: "bg-violet-100 text-violet-700" },
  { label: "VIP Customer", icon: <Crown className="size-3.5" />, earned: true, color: "bg-[#D6E6EF] text-[#2A3E4B]" },
  { label: "Loyal Member", icon: <Heart className="size-3.5" />, earned: false, color: "bg-gray-100 text-gray-400" },
];

// ─── Notifications ─────────────────────────────────────────────
const NOTIFICATIONS = [
  { text: "Your next reward is ready.", time: "Just now", dot: "bg-[#FF6B00]" },
  { text: "New campaign available.", time: "2h ago", dot: "bg-emerald-500" },
  { text: "You've reached Gold Membership.", time: "Yesterday", dot: "bg-amber-500" },
];

// ─── Comparison data ──────────────────────────────────────────
const TRADITIONAL = [
  "Paper loyalty cards",
  "Easy to lose",
  "Manual tracking",
  "No engagement",
  "No personalised offers",
];

const MYSTERY_UNLOCK = [
  "Digital rewards wallet",
  "Membership system",
  "Interactive campaigns",
  "Purchase history",
  "Achievement badges",
  "Personalised notifications",
];

// ─── Benefits list ─────────────────────────────────────────────
const BENEFITS = [
  {
    icon: <Zap className="size-5" />,
    accent: "bg-[#FF6B00]/10 text-[#FF6B00]",
    title: "Builds Habits, Not Just Visits",
    desc: "Every purchase earns progress. Every reward creates anticipation for the next visit — turning one-time buyers into loyal regulars.",
  },
  {
    icon: <Trophy className="size-5" />,
    accent: "bg-amber-100 text-amber-600",
    title: "Gamified Membership Tiers",
    desc: "Bronze, Silver, Gold. Customers chase the next tier with pride, spending more and visiting more often to unlock exclusive perks.",
  },
  {
    icon: <Bell className="size-5" />,
    accent: "bg-violet-100 text-violet-600",
    title: "Personalised, Timely Nudges",
    desc: "Smart notifications land at the right moment — when a reward is ready, a campaign is live, or a milestone has been hit.",
  },
];

// ─── Phone mockup ─────────────────────────────────────────────
function PhoneMockup() {
  return (
    /* Outer frame */
    <div
      className="relative mx-auto w-[260px] sm:w-[280px]"
      aria-label="Customer loyalty app preview"
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[3rem] opacity-30 blur-2xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${B.mid}, transparent 70%)` }}
      />

      {/* Phone shell */}
      <div
        className="relative rounded-[2.5rem] p-[3px] shadow-[0_40px_80px_-20px_rgba(42,62,75,0.35)]"
        style={{ background: `linear-gradient(145deg, #e8edf2, ${B.dark})` }}
      >
        <div className="rounded-[2.35rem] overflow-hidden bg-[#0f172a]">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <span className="text-[9px] font-semibold text-white/70">9:41</span>
            <div className="w-20 h-5 rounded-full bg-black mx-auto absolute left-1/2 -translate-x-1/2 top-0" />
            <div className="flex items-center gap-1">
              {[3, 4, 5].map((h) => (
                <div key={h} className="w-[3px] rounded-sm bg-white/70" style={{ height: h }} />
              ))}
              <div className="w-4 h-2 rounded-sm border border-white/50 ml-1 relative">
                <div className="absolute inset-[2px] right-1 bg-white/70 rounded-[1px]" />
              </div>
            </div>
          </div>

          {/* App header */}
          <div
            className="px-4 pt-2 pb-3.5"
            style={{ background: `linear-gradient(135deg, ${B.dark}, ${B.mid})` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/70 font-medium">Welcome back</p>
                <p className="text-sm font-bold text-white leading-tight">Anisha's Rewards</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/20 grid place-items-center text-xs font-black text-white border border-white/30">
                A
              </div>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="bg-[#F4F6FA] overflow-y-auto px-3 py-3 space-y-3" style={{ maxHeight: 420 }}>

            {/* Membership card */}
            <div
              className="rounded-2xl p-3.5 text-white relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, #b8860b, #d4a017, #f5c842)` }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-20"
                style={{ background: "radial-gradient(circle, white, transparent)", transform: "translate(30%, -30%)" }} />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Crown className="size-4 text-white" />
                  <span className="text-[11px] font-bold tracking-wide">GOLD MEMBER</span>
                </div>
                <span className="text-[10px] bg-white/25 rounded-full px-2 py-0.5 font-semibold">Active</span>
              </div>
              <div className="flex gap-0.5 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3.5 fill-white text-white" />
                ))}
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-semibold mb-1 text-white/90">
                  <span>Visit progress</span>
                  <span>18 / 20</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/30">
                  <div className="h-full rounded-full bg-white" style={{ width: "90%" }} />
                </div>
                <p className="text-[9px] text-white/80 mt-1">2 more visits to unlock Platinum</p>
              </div>
            </div>

            {/* Rewards wallet */}
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-[11px] font-bold text-[#2A3E4B] mb-2.5">Rewards Wallet</p>
              <div className="space-y-2">
                {REWARDS.map((r) => (
                  <div
                    key={r.label}
                    className={`rounded-xl bg-gradient-to-r ${r.color} p-2.5 flex items-center gap-2.5`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-white/20 grid place-items-center text-white shrink-0">
                      {r.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white leading-tight">{r.label}</p>
                      <p className="text-[9px] text-white/80">{r.sub}</p>
                    </div>
                    <ChevronRight className="size-3.5 text-white/70 shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Active campaign */}
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-[#2A3E4B]">Active Campaign</p>
                <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 rounded-full px-1.5 py-0.5">LIVE</span>
              </div>
              <p className="text-xs font-bold text-[#2A3E4B]">Summer Lucky Spin</p>
              <p className="text-[10px] text-[#4a5b78] mb-2">Ends in 6 days</p>
              <div className="h-1.5 rounded-full bg-[#D6E6EF] mb-2.5">
                <div className="h-full rounded-full bg-[#FF6B00]" style={{ width: "62%" }} />
              </div>
              <button
                type="button"
                className="w-full py-1.5 rounded-xl text-white text-[11px] font-bold"
                style={{ background: `linear-gradient(135deg, ${B.accent}, #ff8c38)` }}
              >
                Claim Reward
              </button>
            </div>

            {/* Purchase history */}
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-[11px] font-bold text-[#2A3E4B] mb-2">Purchase History</p>
              <ul className="space-y-1.5">
                {PURCHASES.map((p) => (
                  <li key={p.label} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg grid place-items-center shrink-0 ${p.color}`}>
                      {p.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-[#2A3E4B]">{p.label}</p>
                      <p className="text-[9px] text-[#4a5b78]">{p.date}</p>
                    </div>
                    <span className="text-[10px] font-bold text-[#2A3E4B]">{p.amount}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Achievement badges */}
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-[11px] font-bold text-[#2A3E4B] mb-2">Achievements</p>
              <div className="grid grid-cols-2 gap-1.5">
                {BADGES.map((b) => (
                  <div
                    key={b.label}
                    className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 ${b.earned ? b.color : "bg-gray-50 text-gray-400"}`}
                  >
                    {b.icon}
                    <span className="text-[9px] font-bold leading-tight">{b.label}</span>
                    {b.earned && <Check className="size-2.5 ml-auto shrink-0" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-[#2A3E4B]">Notifications</p>
                <Bell className="size-3.5 text-[#4a5b78]" />
              </div>
              <ul className="space-y-2">
                {NOTIFICATIONS.map((n) => (
                  <li key={n.text} className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${n.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-[#2A3E4B] leading-snug">{n.text}</p>
                      <p className="text-[9px] text-[#4a5b78]">{n.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Home bar */}
          <div className="bg-[#F4F6FA] flex justify-center py-2">
            <div className="w-24 h-1 rounded-full bg-[#2A3E4B]/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Right-side benefits ───────────────────────────────────────
function BenefitsSide() {
  return (
    <div className="flex flex-col justify-center gap-8">
      {/* Headline */}
      <div>
        <FoundationBadge variant="subtle" className="mb-4">
          Customer Experience
        </FoundationBadge>
        <h3
          className="font-display text-2xl md:text-3xl font-bold leading-tight"
          style={{ color: B.dark }}
        >
          Your Customers Keep Coming Back
        </h3>
        <p className="mt-3 text-base leading-relaxed" style={{ color: `${B.dark}bb` }}>
          Mystery Unlock doesn't only reward customers — it builds habits. Every visit increases
          loyalty. Every reward increases excitement. Every campaign creates another reason to return.
        </p>
      </div>

      {/* Benefits */}
      <ul className="flex flex-col gap-4">
        {BENEFITS.map((b) => (
          <li key={b.title} className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${b.accent}`}>
              {b.icon}
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: B.dark }}>{b.title}</p>
              <p className="text-sm leading-relaxed mt-0.5" style={{ color: `${B.dark}99` }}>{b.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Comparison card */}
      <FoundationCard elevation="sm" padding="none" className="overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-border">
          {/* Traditional */}
          <div className="p-4">
            <p
              className="text-xs font-bold uppercase tracking-wide mb-3"
              style={{ color: `${B.dark}88` }}
            >
              Traditional Loyalty
            </p>
            <ul className="space-y-2">
              {TRADITIONAL.map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs" style={{ color: `${B.dark}99` }}>
                  <div className="w-4 h-4 rounded-full bg-red-50 grid place-items-center shrink-0">
                    <X className="size-2.5 text-red-400" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Mystery Unlock */}
          <div className="p-4" style={{ background: `${B.light}40` }}>
            <p
              className="text-xs font-bold uppercase tracking-wide mb-3"
              style={{ color: B.accent }}
            >
              Mystery Unlock
            </p>
            <ul className="space-y-2">
              {MYSTERY_UNLOCK.map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs font-medium" style={{ color: B.dark }}>
                  <div className="w-4 h-4 rounded-full bg-emerald-100 grid place-items-center shrink-0">
                    <Check className="size-2.5 text-emerald-600" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </FoundationCard>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────
export function CustomerExperience() {
  return (
    <SectionContainer
      as="section"
      id="customer-experience"
      maxWidth="xl"
      spacing="none"
      className="py-20 lg:py-28"
      aria-labelledby="customer-experience-heading"
    >
      {/* Section header */}
      <div className="max-w-2xl mx-auto text-center mb-14">
        <span
          className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full mb-4"
          style={{ background: B.light, color: B.dark }}
        >
          For Your Customers
        </span>
        <h2
          id="customer-experience-heading"
          className="font-display text-3xl md:text-4xl font-bold leading-tight"
          style={{ color: B.dark }}
        >
          A Customer Experience They'll Love
        </h2>
        <p className="mt-4 text-base md:text-lg" style={{ color: `${B.dark}cc` }}>
          Every purchase becomes more rewarding with a modern digital loyalty experience that keeps
          customers coming back.
        </p>
      </div>

      {/* Two-column grid: phone + benefits */}
      <div className="grid lg:grid-cols-[auto_1fr] gap-12 lg:gap-16 items-start">
        {/* Phone — left on desktop, first on mobile */}
        <div className="flex justify-center">
          <PhoneMockup />
        </div>

        {/* Benefits — right on desktop, below on mobile */}
        <BenefitsSide />
      </div>
    </SectionContainer>
  );
}

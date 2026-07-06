import { useState, memo } from "react";
import { Check, X, Clock, Shield, CreditCard, RotateCcw, Lock, Star, ArrowRight, MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { SectionContainer } from "@/components/foundation/layout/SectionContainer";
import { FoundationCard } from "@/components/foundation/cards/Card";
import { FoundationBadge } from "@/components/foundation/feedback/Badge";
import { PrimaryButton } from "@/components/foundation/buttons/PrimaryButton";
import { OutlineButton } from "@/components/foundation/buttons/OutlineButton";

import {
  PLANS,
  COMPARISON_ROWS,
  PAYMENT_METHODS,
  TRUST_BADGES,
  type Plan,
  type FeatureStatus,
} from "@/data/pricing";

// ─── Brand tokens ────────────────────────────────────────────────────────────
const B = {
  dark: "#2A3E4B",
  mid: "#7FA6B8",
  light: "#D6E6EF",
  bg: "#F7FBFD",
  accent: "#FF6B00",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatPrice(amount: number | null, currency: string, billing: "monthly" | "yearly"): string {
  if (amount === null) return "Custom";
  const sym = currency?.toUpperCase() === "NPR" ? "Rs." : currency;
  return `${sym}${Number(amount).toLocaleString()}`;
}

function TrustIcon({ icon }: { icon: string }) {
  const cls = "size-4 shrink-0";
  switch (icon) {
    case "shield": return <Shield className={cls} style={{ color: B.accent }} />;
    case "card-off": return <CreditCard className={cls} style={{ color: B.accent }} />;
    case "rotate": return <RotateCcw className={cls} style={{ color: B.accent }} />;
    case "lock": return <Lock className={cls} style={{ color: B.accent }} />;
    default: return <Check className={cls} style={{ color: B.accent }} />;
  }
}

// ─── Feature status cell ─────────────────────────────────────────────────────
function StatusCell({
  status,
  highlighted,
}: {
  status: FeatureStatus | false;
  highlighted: boolean;
}) {
  if (status === false) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full"
        aria-label="Not included"
        style={{ background: highlighted ? "rgba(255,255,255,0.08)" : `${B.light}` }}
      >
        <X className="size-3" style={{ color: highlighted ? "rgba(255,255,255,0.3)" : `${B.mid}` }} />
      </span>
    );
  }
  if (status === "comingSoon") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
        aria-label="Coming soon"
        style={
          highlighted
            ? { background: "rgba(255,107,0,0.2)", color: "#FFB380" }
            : { background: `${B.accent}15`, color: B.accent }
        }
      >
        <Clock className="size-2.5" /> Soon
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full"
      aria-label="Included"
      style={
        highlighted
          ? { background: "rgba(255,255,255,0.15)" }
          : { background: "#d1fae5" }
      }
    >
      <Check className="size-3" style={{ color: highlighted ? "#86efac" : "#059669" }} />
    </span>
  );
}

// ─── Coming Soon badge for plan feature list ──────────────────────────────────
function FeatureComingSoonBadge({ highlighted }: { highlighted: boolean }) {
  return (
    <span
      className="ml-2 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
      aria-label="Coming soon"
      style={
        highlighted
          ? { background: "rgba(255,107,0,0.2)", color: "#FFB380" }
          : { background: `${B.accent}15`, color: B.accent }
      }
    >
      <Clock className="size-2.5" /> Coming Soon
    </span>
  );
}

// ─── Individual plan card ─────────────────────────────────────────────────────
function PlanCard({
  plan,
  billing,
}: {
  plan: Plan;
  billing: "monthly" | "yearly";
}) {
  const price = billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
  const formatted = formatPrice(price, plan.currency, billing);
  const hl = plan.isHighlighted;

  return (
    <div
      className={`relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300 ${
        hl ? "shadow-2xl md:scale-[1.02] z-10" : "shadow-md hover:shadow-xl hover:-translate-y-1"
      }`}
      style={
        hl
          ? { background: `linear-gradient(160deg, ${B.dark} 0%, #1a2e38 100%)` }
          : { background: "white", border: `1px solid ${B.light}` }
      }
      aria-label={`${plan.name} plan`}
    >
      {/* Popular badge ribbon */}
      {hl && plan.badge && (
        <div
          className="absolute top-0 right-0 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-white"
          style={{ background: B.accent, borderBottomLeftRadius: 12 }}
        >
          <Star className="size-2.5 fill-current" />
          {plan.badge}
        </div>
      )}

      {/* Card header */}
      <div className="px-6 pt-7 pb-5" style={{ borderBottom: `1px solid ${hl ? "rgba(255,255,255,0.08)" : B.light}` }}>
        <p
          className="text-xs font-bold uppercase tracking-[0.2em] mb-1"
          style={{ color: hl ? B.mid : B.mid }}
        >
          {plan.name}
        </p>
        <p
          className="text-sm mb-4 leading-snug"
          style={{ color: hl ? "rgba(255,255,255,0.6)" : `${B.dark}99` }}
        >
          {plan.tagline}
        </p>

        {/* Price */}
        <div className="flex items-end gap-1.5">
          <span
            key={`${plan.id}-${billing}-${formatted}`}
            className="font-display text-4xl font-black leading-none transition-all duration-300"
            style={{ color: hl ? "white" : B.dark }}
          >
            {formatted}
          </span>
          {price !== null && (
            <span
              className="text-sm font-medium mb-0.5"
              style={{ color: hl ? "rgba(255,255,255,0.4)" : `${B.dark}66` }}
            >
              / mo
            </span>
          )}
        </div>

        {/* Yearly saving nudge */}
        {billing === "yearly" && price !== null && plan.monthlyPrice !== null && (
          <p className="mt-2 text-[11px] font-semibold" style={{ color: hl ? "#86efac" : "#059669" }}>
            Save Rs.{((plan.monthlyPrice - price) * 12).toLocaleString()} per year
          </p>
        )}
        {price === null && (
          <p className="mt-2 text-[11px]" style={{ color: hl ? "rgba(255,255,255,0.5)" : `${B.dark}66` }}>
            Tailored to your team
          </p>
        )}
      </div>

      {/* Feature list */}
      <ul
        className="flex-1 px-6 py-5 space-y-3"
        aria-label={`${plan.name} features`}
      >
        {plan.features.map((f) => (
          <li key={f.name} className="flex items-center gap-2.5 text-sm">
            {f.status === "available" ? (
              <Check
                className="size-4 shrink-0"
                style={{ color: hl ? "#86efac" : "#059669" }}
                aria-hidden
              />
            ) : (
              <Clock
                className="size-4 shrink-0"
                style={{ color: hl ? "#FFB380" : B.accent }}
                aria-hidden
              />
            )}
            <span style={{ color: hl ? "rgba(255,255,255,0.85)" : B.dark }}>
              {f.name}
              {f.status === "comingSoon" && <FeatureComingSoonBadge highlighted={hl} />}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="px-6 pb-7">
        {hl ? (
          <PrimaryButton
            asChild
            size="lg"
            className="w-full font-bold"
            style={{ background: B.accent, color: "white" }}
          >
            <Link to="/auth">
              {plan.ctaLabel} <ArrowRight className="size-4" />
            </Link>
          </PrimaryButton>
        ) : plan.monthlyPrice === null ? (
          <OutlineButton asChild size="lg" className="w-full font-bold">
            <a href={plan.ctaHref}>{plan.ctaLabel} <ArrowRight className="size-4" /></a>
          </OutlineButton>
        ) : (
          <OutlineButton
            asChild
            size="lg"
            className="w-full font-bold"
            style={{ borderColor: `${B.dark}30`, color: B.dark }}
          >
            <Link to="/auth">
              {plan.ctaLabel} <ArrowRight className="size-4" />
            </Link>
          </OutlineButton>
        )}
      </div>
    </div>
  );
}

// ─── Comparison table ─────────────────────────────────────────────────────────
function ComparisonTable() {
  // Group rows by category
  const categories = [...new Set(COMPARISON_ROWS.map((r) => r.category))];

  return (
    <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: B.light }}>
      <table className="w-full min-w-[640px] border-collapse text-sm" aria-label="Feature comparison table">
        <thead>
          <tr style={{ background: B.dark }}>
            <th
              scope="col"
              className="text-left px-5 py-4 font-display font-bold text-white rounded-tl-2xl"
              style={{ width: "40%" }}
            >
              Feature
            </th>
            {PLANS.map((plan) => (
              <th
                key={plan.id}
                scope="col"
                className="text-center px-4 py-4 font-display font-bold"
                style={{ color: plan.isHighlighted ? B.accent : "white" }}
              >
                {plan.name}
                {plan.isHighlighted && (
                  <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full align-middle"
                    style={{ background: `${B.accent}20`, color: B.accent }}
                  >
                    ★
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        {categories.map((cat) => (
          <tbody key={cat}>
            {/* Category header */}
            <tr style={{ background: `${B.light}60` }}>
              <td
                colSpan={PLANS.length + 1}
                className="px-5 py-2 text-[11px] font-black uppercase tracking-[0.2em]"
                style={{ color: B.mid }}
              >
                {cat}
              </td>
            </tr>
            {/* Feature rows */}
            {COMPARISON_ROWS.filter((r) => r.category === cat).map((row) => (
              <tr
                key={row.feature}
                className="border-t transition-colors hover:bg-[#F0F6FA]"
                style={{ borderColor: `${B.light}` }}
              >
                <td className="px-5 py-3 font-medium" style={{ color: B.dark }}>
                  {row.feature}
                </td>
                {PLANS.map((plan) => (
                  <td key={plan.id} className="px-4 py-3 text-center">
                    <StatusCell status={row.plans[plan.id]} highlighted={false} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

// ─── Payment methods ──────────────────────────────────────────────────────────
function PaymentMethods() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
      {PAYMENT_METHODS.map((pm) => (
        <div
          key={pm.name}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:shadow-sm"
          style={{ borderColor: `${B.light}`, background: "white" }}
          title={pm.status === "comingSoon" ? `${pm.name} — Coming Soon` : pm.name}
        >
          {/* Icon placeholder */}
          <span
            className="w-8 h-5 rounded grid place-items-center text-white text-[9px] font-black shrink-0"
            aria-hidden
            style={{ background: pm.color }}
          >
            {pm.abbr}
          </span>
          <span className="text-xs font-semibold" style={{ color: B.dark }}>{pm.name}</span>
          {pm.status === "comingSoon" && (
            <span
              className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
              style={{ background: `${B.accent}15`, color: B.accent }}
              aria-label="Coming soon"
            >
              Soon
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export const Pricing = memo(function Pricing() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <SectionContainer
      as="section"
      id="pricing"
      maxWidth="xl"
      spacing="none"
      className="py-20 lg:py-28"
      aria-labelledby="pricing-heading"
    >
      {/* ── Section header ─────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto text-center mb-12">
        <FoundationBadge variant="subtle" className="mb-4 uppercase tracking-widest text-[11px]">
          Pricing
        </FoundationBadge>
        <h2
          id="pricing-heading"
          className="font-display text-3xl md:text-4xl font-bold leading-tight mb-4"
          style={{ color: B.dark }}
        >
          Simple, transparent pricing.
        </h2>
        <p className="text-base md:text-lg" style={{ color: `${B.dark}cc` }}>
          One plan for every stage of your business. No hidden fees, no lock-in.
        </p>

        {/* ── Monthly / Yearly toggle ────────────────────────────────────── */}
        <div
          className="inline-flex items-center gap-1 mt-8 p-1 rounded-full border"
          style={{ borderColor: B.light, background: `${B.light}50` }}
          role="radiogroup"
          aria-label="Billing period"
        >
          {(["monthly", "yearly"] as const).map((period) => (
            <button
              key={period}
              type="button"
              role="radio"
              aria-checked={billing === period}
              onClick={() => setBilling(period)}
              className="relative px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200"
              style={
                billing === period
                  ? { background: B.dark, color: "white", boxShadow: "0 1px 4px rgba(42,62,75,0.25)" }
                  : { color: `${B.dark}99` }
              }
            >
              {period === "monthly" ? "Monthly" : (
                <span className="flex items-center gap-1.5">
                  Yearly
                  <span
                    className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                    style={{ background: "#d1fae5", color: "#059669" }}
                  >
                    Save 20%
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Plan cards ─────────────────────────────────────────────────── */}
      <div
        className="grid md:grid-cols-3 gap-6 items-center mb-16"
        aria-label="Pricing plans"
      >
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} billing={billing} />
        ))}
      </div>

      {/* ── Trust badges ───────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border py-6 px-6 mb-14"
        style={{ borderColor: B.light, background: `${B.bg}` }}
      >
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: B.mid }}>
          Our Commitment
        </p>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
          {TRUST_BADGES.map((badge) => (
            <div key={badge.label} className="flex items-center gap-2">
              <TrustIcon icon={badge.icon} />
              <span className="text-sm font-semibold" style={{ color: B.dark }}>
                {badge.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature comparison table ────────────────────────────────────── */}
      <div className="mb-14">
        <h3
          className="font-display text-xl font-bold text-center mb-6"
          style={{ color: B.dark }}
        >
          Compare all features
        </h3>
        <ComparisonTable />
      </div>

      {/* ── Payment methods ─────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border py-6 px-6 mb-10 text-center"
        style={{ borderColor: B.light, background: "white" }}
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em] mb-1" style={{ color: B.mid }}>
          Payment Methods
        </p>
        <p className="text-sm mb-1" style={{ color: `${B.dark}99` }}>
          Secure local and international payment options — all coming soon.
        </p>
        <PaymentMethods />
      </div>

      {/* ── FAQ shortcut ────────────────────────────────────────────────── */}
      <div className="text-center">
        <p className="text-base font-semibold mb-3" style={{ color: B.dark }}>
          Still have questions?
        </p>
        <OutlineButton
          asChild
          size="default"
          className="font-semibold"
          style={{ borderColor: `${B.dark}30`, color: B.dark }}
        >
          <a href="#faq" className="inline-flex items-center gap-2">
            <MessageCircle className="size-4" />
            Talk to our team
          </a>
        </OutlineButton>
      </div>
    </SectionContainer>
  );
});

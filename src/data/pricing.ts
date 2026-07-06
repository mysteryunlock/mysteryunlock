// ─────────────────────────────────────────────────────────────────────────────
// src/data/pricing.ts
// All pricing data lives here. Edit this file to change plans, prices, or
// feature availability without touching the Pricing UI component.
// ─────────────────────────────────────────────────────────────────────────────

export type FeatureStatus = "available" | "comingSoon";

export interface PlanFeature {
  name: string;
  status: FeatureStatus;
}

export interface Plan {
  /** Unique key used as React key and for comparison table look-ups */
  id: "starter" | "growth" | "enterprise";
  name: string;
  tagline: string;
  /** Monthly price in NPR. null = contact-sales */
  monthlyPrice: number | null;
  /** Yearly price in NPR (per month equivalent). null = contact-sales */
  yearlyPrice: number | null;
  currency: string;
  /** Shown in the CTA button */
  ctaLabel: string;
  /** Route / href the CTA points to */
  ctaHref: string;
  /** Secondary action (used on Enterprise: "Talk to us") */
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  isHighlighted: boolean;
  /** Short badge text, e.g. "Most Popular" */
  badge?: string;
  features: PlanFeature[];
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Small shops getting started.",
    monthlyPrice: 999,
    yearlyPrice: 799,
    currency: "NPR",
    ctaLabel: "Start Free Trial",
    ctaHref: "/auth",
    isHighlighted: false,
    features: [
      { name: "1 Campaign", status: "available" },
      { name: "200 Customers", status: "available" },
      { name: "QR Campaigns", status: "available" },
      { name: "Basic Analytics", status: "available" },
      { name: "Email Support", status: "available" },
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Everything you need to scale loyalty.",
    monthlyPrice: 2499,
    yearlyPrice: 1999,
    currency: "NPR",
    ctaLabel: "Start Growing",
    ctaHref: "/auth",
    isHighlighted: true,
    badge: "Most Popular",
    features: [
      { name: "Unlimited Campaigns", status: "available" },
      { name: "Unlimited Customers", status: "available" },
      { name: "CRM", status: "available" },
      { name: "Loyalty Program", status: "available" },
      { name: "Email Marketing", status: "comingSoon" },
      { name: "SMS Marketing", status: "comingSoon" },
      { name: "Advanced Analytics", status: "available" },
      { name: "AI Campaign Suggestions", status: "comingSoon" },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For chains, franchises, and high-volume shops.",
    monthlyPrice: null,
    yearlyPrice: null,
    currency: "NPR",
    ctaLabel: "Contact Sales",
    ctaHref: "mailto:sales@mysteryunlock.com",
    isHighlighted: false,
    features: [
      { name: "Multi Branch", status: "available" },
      { name: "Team Management", status: "comingSoon" },
      { name: "API Access", status: "comingSoon" },
      { name: "Dedicated Success Manager", status: "available" },
      { name: "White Label", status: "comingSoon" },
      { name: "Priority Support", status: "available" },
    ],
  },
];

// ─── Comparison table rows ────────────────────────────────────────────────────
// Each row maps to one feature across all three plans.
// `plans` maps plan id → the feature status (or null = not applicable).

export interface ComparisonRow {
  category: string;
  feature: string;
  plans: Record<Plan["id"], FeatureStatus | false>;
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  // Campaigns
  {
    category: "Campaigns",
    feature: "QR Campaigns",
    plans: { starter: "available", growth: "available", enterprise: "available" },
  },
  {
    category: "Campaigns",
    feature: "Unlimited Campaigns",
    plans: { starter: false, growth: "available", enterprise: "available" },
  },
  {
    category: "Campaigns",
    feature: "AI Campaign Suggestions",
    plans: { starter: false, growth: "comingSoon", enterprise: "comingSoon" },
  },
  // Customers & CRM
  {
    category: "Customers",
    feature: "Customer Limit",
    plans: { starter: "available", growth: "available", enterprise: "available" },
  },
  {
    category: "Customers",
    feature: "CRM",
    plans: { starter: false, growth: "available", enterprise: "available" },
  },
  {
    category: "Customers",
    feature: "Loyalty Program",
    plans: { starter: false, growth: "available", enterprise: "available" },
  },
  // Marketing
  {
    category: "Marketing",
    feature: "Email Marketing",
    plans: { starter: false, growth: "comingSoon", enterprise: "comingSoon" },
  },
  {
    category: "Marketing",
    feature: "SMS Marketing",
    plans: { starter: false, growth: "comingSoon", enterprise: "comingSoon" },
  },
  // Analytics
  {
    category: "Analytics",
    feature: "Basic Analytics",
    plans: { starter: "available", growth: "available", enterprise: "available" },
  },
  {
    category: "Analytics",
    feature: "Advanced Analytics",
    plans: { starter: false, growth: "available", enterprise: "available" },
  },
  // Enterprise
  {
    category: "Enterprise",
    feature: "Multi Branch",
    plans: { starter: false, growth: false, enterprise: "available" },
  },
  {
    category: "Enterprise",
    feature: "Team Management",
    plans: { starter: false, growth: false, enterprise: "comingSoon" },
  },
  {
    category: "Enterprise",
    feature: "API Access",
    plans: { starter: false, growth: false, enterprise: "comingSoon" },
  },
  {
    category: "Enterprise",
    feature: "White Label",
    plans: { starter: false, growth: false, enterprise: "comingSoon" },
  },
  // Support
  {
    category: "Support",
    feature: "Email Support",
    plans: { starter: "available", growth: "available", enterprise: "available" },
  },
  {
    category: "Support",
    feature: "Dedicated Success Manager",
    plans: { starter: false, growth: false, enterprise: "available" },
  },
  {
    category: "Support",
    feature: "Priority Support",
    plans: { starter: false, growth: false, enterprise: "available" },
  },
];

// ─── Payment methods ──────────────────────────────────────────────────────────
export interface PaymentMethod {
  name: string;
  type: "local" | "international";
  status: "available" | "comingSoon";
  /** Short colour used for the icon background */
  color: string;
  /** Abbreviation shown inside the icon placeholder */
  abbr: string;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  { name: "eSewa", type: "local", status: "comingSoon", color: "#60D44E", abbr: "eS" },
  { name: "Khalti", type: "local", status: "comingSoon", color: "#5C2D91", abbr: "Kh" },
  { name: "Fonepay", type: "local", status: "comingSoon", color: "#E31E25", abbr: "Fp" },
  { name: "Visa", type: "international", status: "comingSoon", color: "#1A1F71", abbr: "VISA" },
  { name: "Mastercard", type: "international", status: "comingSoon", color: "#EB001B", abbr: "MC" },
];

// ─── Trust badges ─────────────────────────────────────────────────────────────
export const TRUST_BADGES = [
  { label: "14-Day Risk-Free Trial", icon: "shield" },
  { label: "No credit card required", icon: "card-off" },
  { label: "Cancel anytime", icon: "rotate" },
  { label: "Secure payments", icon: "lock" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// src/data/faq.ts
// All FAQ content lives here. Edit this file to add, remove, or reorder
// questions without touching the FAQ UI component.
// ─────────────────────────────────────────────────────────────────────────────

export type FaqCategory =
  | "Setup"
  | "Pricing"
  | "Features"
  | "Security"
  | "Support";

export interface FaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  "Setup",
  "Pricing",
  "Features",
  "Security",
  "Support",
];

export const FAQ_ITEMS: FaqItem[] = [
  // ── Setup ────────────────────────────────────────────────────────────────
  {
    id: "setup-1",
    category: "Setup",
    question: "How quickly can I launch a campaign?",
    answer:
      "Under 2 minutes — create an account, name your shop, set your prizes, and share the QR code. No developer, no agency, no waiting. Your first campaign can be live before your next customer walks through the door.",
  },
  {
    id: "setup-2",
    category: "Setup",
    question: "Do my customers need an app to spin?",
    answer:
      "No. Customers scan your QR code with any phone camera and spin directly in the browser — nothing to download. The spin page is also a fast, installable PWA, so customers who want to save it to their home screen can do that in one tap.",
  },
  {
    id: "setup-3",
    category: "Setup",
    question: "Do I need a developer or technical knowledge?",
    answer:
      "Not at all. Mystery Unlock is built for shop owners, not developers. If you can fill out a form and upload an image, you have everything you need. Our onboarding walks you through every step.",
  },
  {
    id: "setup-4",
    category: "Setup",
    question: "Can I run multiple campaigns at once?",
    answer:
      "Growth and Enterprise plans support unlimited simultaneous campaigns. On the Starter plan you can run one active campaign at a time — perfect for getting started and testing what works before scaling.",
  },
  {
    id: "setup-5",
    category: "Setup",
    question: "How do customers redeem their prizes?",
    answer:
      "After a winning spin, customers receive a unique prize code on-screen and optionally via SMS or WhatsApp (coming soon). Your staff verifies the code in the dashboard with a single click. No paper vouchers, no guesswork.",
  },

  // ── Pricing ──────────────────────────────────────────────────────────────
  {
    id: "pricing-1",
    category: "Pricing",
    question: "Is there a free trial?",
    answer:
      "Yes. Every account starts with a 14-day risk-free trial — no credit card required. You get full access to the Starter plan features so you can run a real campaign and see results before committing to anything.",
  },
  {
    id: "pricing-2",
    category: "Pricing",
    question: "Can I cancel anytime?",
    answer:
      "Absolutely. Plans are month-to-month with no long-term contracts. Cancel from your dashboard at any time and you won't be charged again. Your campaign data remains exportable as CSV even after cancellation.",
  },
  {
    id: "pricing-3",
    category: "Pricing",
    question: "What happens if I hit my customer limit on Starter?",
    answer:
      "We'll notify you before you reach the limit so you have time to upgrade. Existing customers and active campaign data are never deleted — upgrading to Growth removes the limit entirely.",
  },
  {
    id: "pricing-4",
    category: "Pricing",
    question: "Do you offer discounts for yearly billing?",
    answer:
      "Yes — switch to yearly billing and save 20% compared to monthly. The saving is shown automatically when you toggle to Yearly on the pricing page. No coupon codes needed.",
  },
  {
    id: "pricing-5",
    category: "Pricing",
    question: "What does the Enterprise plan include?",
    answer:
      "Enterprise is tailored for chains, franchises, and high-volume shops. It includes multi-branch management, a dedicated success manager, priority support, and upcoming features like team management, API access, and white-labelling. Pricing is custom — contact our sales team for a quote.",
  },

  // ── Features ─────────────────────────────────────────────────────────────
  {
    id: "features-1",
    category: "Features",
    question: "Can I control the odds for each prize?",
    answer:
      "Yes. Set weighted probabilities per prize and adjust them anytime from the campaign builder. The spin engine is atomic and tamper-proof — customers can't game the odds, and every outcome is logged in your dashboard for full auditability.",
  },
  {
    id: "features-2",
    category: "Features",
    question: "Can I brand the spin page with my logo and colours?",
    answer:
      "Yes. Upload your logo, pick your brand colours, and set a custom URL slug (e.g. mysteryunlock.com/anishas-boutique). The spin page, QR code, and result screens all reflect your identity end-to-end — customers see your brand, not ours.",
  },
  {
    id: "features-3",
    category: "Features",
    question: "What analytics does Mystery Unlock provide?",
    answer:
      "The dashboard shows real-time spins, winners, prize distribution, and customer return rates. Growth and Enterprise plans include advanced analytics: campaign performance over time, peak spin hours, customer lifetime value, and exportable reports.",
  },
  {
    id: "features-4",
    category: "Features",
    question: "What is the Loyalty Program feature?",
    answer:
      "Available on Growth and above, the Loyalty Program lets you reward repeat customers automatically — for example, giving a free spin after every 5 purchases. It integrates with the CRM so you always know which customers are most engaged.",
  },
  {
    id: "features-5",
    category: "Features",
    question: "When are Email Marketing, SMS, and AI features coming?",
    answer:
      "These are actively in development and will roll out to Growth plan subscribers first. Email Marketing and SMS Marketing are targeted for later this year. AI Campaign Suggestions — which recommends prize structures and timing based on your shop's data — is in early beta. Subscribers will be notified before launch.",
  },

  // ── Security ─────────────────────────────────────────────────────────────
  {
    id: "security-4",
    category: "Security",
    question: "Does Mystery Unlock comply with data privacy laws?",
    answer:
      "Yes. We follow recognised data privacy best practices including minimal data collection, purpose limitation, and user rights (access and deletion on request). Your customer data is stored within secure, access-controlled infrastructure and is never used for advertising or shared with third parties.",
  },
  {
    id: "security-1",
    category: "Security",
    question: "Is my customer data safe?",
    answer:
      "Yes. Every shop runs in an isolated, row-level secure environment — your data is completely separated from every other shop on the platform. Access is controlled by signed codes and encrypted storage. We never sell or share your customer data with third parties.",
  },
  {
    id: "security-2",
    category: "Security",
    question: "Who owns my customer data?",
    answer:
      "You do. Your customers, your data, full stop. You can export everything as CSV at any time, including after cancellation. Mystery Unlock is a tool for your business — the relationships you build belong entirely to you.",
  },
  {
    id: "security-3",
    category: "Security",
    question: "Can someone spin multiple times to cheat?",
    answer:
      "Mystery Unlock uses device fingerprinting and rate-limiting to prevent repeat spins from the same device within a campaign period. You can also configure spin limits per customer from the campaign settings.",
  },

  // ── Support ──────────────────────────────────────────────────────────────
  {
    id: "support-1",
    category: "Support",
    question: "How do I get help if something goes wrong?",
    answer:
      "All plans include email support with responses within 24 hours. Growth plan users get priority response times. Enterprise customers receive a dedicated success manager — a real person who knows your account — plus priority support across all channels.",
  },
  {
    id: "support-2",
    category: "Support",
    question: "Do you offer onboarding help for new shops?",
    answer:
      "Yes. When you sign up we send a step-by-step onboarding guide, and our team is available via email to help you set up your first campaign. Enterprise customers receive a personalised onboarding call with their dedicated success manager.",
  },
  {
    id: "support-3",
    category: "Support",
    question: "Can I request a new feature?",
    answer:
      "Absolutely — and we actually listen. Most of our upcoming features (Email Marketing, SMS, AI Suggestions, Team Management) came directly from shop owner feedback. Reach out via the contact form or email us at hello@mysteryunlock.com.",
  },
  {
    id: "support-4",
    category: "Support",
    question: "Is there documentation or a help centre?",
    answer:
      "Yes. We maintain a growing knowledge base with step-by-step guides for setting up campaigns, managing prizes, reading analytics, and configuring branding. Enterprise customers also receive priority access to in-person or video onboarding sessions with their dedicated success manager.",
  },
];

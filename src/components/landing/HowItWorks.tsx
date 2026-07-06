import { memo } from "react";
import type { ReactNode } from "react";
import { BarChart3, Gift, QrCode, Sparkles, Wand2 } from "lucide-react";

import { FoundationCard } from "@/components/foundation/cards/Card";
import { SectionContainer } from "@/components/foundation/layout/SectionContainer";

interface Step {
  icon: ReactNode;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    icon: <Wand2 className="size-5" />,
    title: "Create Campaign",
    description:
      "Set up your campaign, choose dates, customize branding, and define campaign rules.",
  },
  {
    icon: <Gift className="size-5" />,
    title: "Add Rewards",
    description:
      "Add discounts, free products, vouchers, loyalty points, or mystery prizes.",
  },
  {
    icon: <QrCode className="size-5" />,
    title: "Share QR Code",
    description:
      "Print your QR code or display it digitally so customers can participate instantly.",
  },
  {
    icon: <Sparkles className="size-5" />,
    title: "Customers Unlock Rewards",
    description:
      "Customers scan the QR code, enjoy the interactive unlock experience, and instantly reveal their reward.",
  },
  {
    icon: <BarChart3 className="size-5" />,
    title: "Track Results",
    description:
      "Monitor scans, conversions, reward claims, and campaign performance from your dashboard.",
  },
];

/**
 * Landing Page 2.0 — "How Mystery Unlock Works" section.
 * Built on the Mystery Unlock UI Foundation (SectionContainer, FoundationCard).
 * Mobile: stacked vertical timeline. Tablet: 2-column grid. Desktop: 5 equal columns
 * connected by a subtle horizontal line.
 */
export const HowItWorks = memo(function HowItWorks() {
  return (
    <SectionContainer
      as="section"
      id="how-it-works"
      maxWidth="xl"
      spacing="none"
      className="py-20 lg:py-28"
      aria-labelledby="how-it-works-heading"
    >
      <div className="max-w-2xl mx-auto text-center mb-14">
        <h2
          id="how-it-works-heading"
          className="font-display text-3xl md:text-4xl font-bold leading-tight text-foreground"
        >
          How Mystery Unlock Works
        </h2>
        <p className="mt-4 text-base md:text-lg text-muted-foreground">
          Launch a campaign in minutes and turn every scan into an engaging customer
          experience.
        </p>
      </div>

      <ol className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4 list-none">
        <div
          aria-hidden
          className="hidden lg:block absolute top-9 left-[10%] right-[10%] h-px bg-border"
        />

        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="relative flex animate-fade-in"
            style={{ animationDelay: `${i * 75}ms` }}
          >
            <FoundationCard
              padding="lg"
              elevation="sm"
              hover="lift"
              className="flex flex-col items-center text-center gap-3 w-full"
            >
              <div className="relative">
                <span className="flex items-center justify-center size-14 rounded-2xl bg-primary text-primary-foreground">
                  {step.icon}
                </span>
                <span
                  aria-hidden
                  className="absolute -top-2 -right-2 flex items-center justify-center size-6 rounded-full bg-accent text-accent-foreground text-xs font-bold"
                >
                  {i + 1}
                </span>
              </div>
              <h3 className="font-display font-semibold text-base text-foreground tracking-tight">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </FoundationCard>
          </li>
        ))}
      </ol>
    </SectionContainer>
  );
});

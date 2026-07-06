import { memo } from "react";
import { BarChart3, Gift, MessageCircle, Target } from "lucide-react";

import { FeatureCard } from "@/components/foundation/cards/FeatureCard";
import { SectionContainer } from "@/components/foundation/layout/SectionContainer";

export interface WhyChooseUsSettings {
  heading?: string;
  items?: { title: string; desc: string }[];
}

const REASONS = [
  {
    icon: <Target className="size-5" />,
    title: "Increase Repeat Customers",
    description:
      "Turn one-time buyers into loyal customers with engaging reward campaigns.",
  },
  {
    icon: <Gift className="size-5" />,
    title: "Reward Every Purchase",
    description:
      "Launch customizable spin campaigns with digital prizes and instant rewards.",
  },
  {
    icon: <BarChart3 className="size-5" />,
    title: "Real-Time Analytics",
    description:
      "Track campaign performance, customer engagement, and reward distribution.",
  },
  {
    icon: <MessageCircle className="size-5" />,
    title: "Customer Engagement",
    description:
      "Reconnect with customers using promotions, announcements, and loyalty campaigns.",
  },
];

/**
 * Landing Page 2.0 — "Why Businesses Choose Mystery Unlock" section.
 * Replaces the old "Trusted by modern businesses" logo strip.
 * Built entirely on the Mystery Unlock UI Foundation (SectionContainer, FeatureCard).
 * Accepts optional CMS settings to override heading and card content.
 */
export const WhyChooseUs = memo(function WhyChooseUs({ settings }: { settings?: WhyChooseUsSettings }) {
  const heading = settings?.heading ?? "Why Businesses Choose Mystery Unlock";

  const displayReasons = settings?.items?.length
    ? settings.items.map((item, i) => ({
        icon: REASONS[i % REASONS.length].icon,
        title: item.title,
        description: item.desc,
      }))
    : REASONS;

  return (
    <SectionContainer as="section" id="why-choose-us" maxWidth="xl" spacing="none" className="pb-20 lg:pb-28" aria-labelledby="why-choose-us-heading">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <h2 id="why-choose-us-heading" className="font-display text-3xl md:text-4xl font-bold leading-tight text-foreground">
          {heading}
        </h2>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-fade-in">
        {displayReasons.map((r) => (
          <FeatureCard
            key={r.title}
            icon={r.icon}
            title={r.title}
            description={r.description}
          />
        ))}
      </div>

      <p className="mt-12 text-center text-sm md:text-base max-w-2xl mx-auto text-muted-foreground">
        Built for modern retail stores, cafés, restaurants, salons, electronics shops,
        supermarkets, and local businesses.
      </p>
    </SectionContainer>
  );
});

import { memo } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  BarChart3,
  Gift,
  History,
  Megaphone,
  MessageCircle,
  QrCode,
  Smartphone,
  Star,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

import { FeatureCard } from "@/components/foundation/cards/FeatureCard";
import { SectionContainer } from "@/components/foundation/layout/SectionContainer";

interface FeatureItem {
  icon: ReactNode;
  title: string;
  description: string;
}

const BUSINESS_FEATURES: FeatureItem[] = [
  {
    icon: <Megaphone className="size-5" />,
    title: "Campaign Management",
    description: "Plan, launch, and manage every spin-to-win campaign from one place.",
  },
  {
    icon: <Users className="size-5" />,
    title: "Customer CRM",
    description: "Keep a complete profile of every customer who engages with your shop.",
  },
  {
    icon: <BarChart3 className="size-5" />,
    title: "Analytics Dashboard",
    description: "See spins, conversions, and revenue impact in real time.",
  },
  {
    icon: <QrCode className="size-5" />,
    title: "QR Campaigns",
    description: "Generate branded QR codes customers can scan anywhere, instantly.",
  },
  {
    icon: <MessageCircle className="size-5" />,
    title: "Broadcast Messaging",
    description: "Send promotions and announcements straight to engaged customers.",
  },
  {
    icon: <Trophy className="size-5" />,
    title: "Loyalty & Membership",
    description: "Reward repeat customers with tiers, points, and membership perks.",
  },
];

const CUSTOMER_FEATURES: FeatureItem[] = [
  {
    icon: <Gift className="size-5" />,
    title: "Rewards Wallet",
    description: "Every prize and voucher saved in one place, ready to redeem.",
  },
  {
    icon: <Wallet className="size-5" />,
    title: "Purchase History",
    description: "A clear, running record of every visit and reward earned.",
  },
  {
    icon: <History className="size-5" />,
    title: "Membership Levels",
    description: "Unlock better rewards and perks the more customers engage.",
  },
  {
    icon: <Star className="size-5" />,
    title: "Achievement Badges",
    description: "Fun milestones that celebrate loyalty and repeat visits.",
  },
  {
    icon: <Bell className="size-5" />,
    title: "Personalized Offers",
    description: "Relevant promotions and rewards tailored to each customer.",
  },
  {
    icon: <Smartphone className="size-5" />,
    title: "Mobile Friendly Experience",
    description: "A fast, app-like experience that works on any phone, no install needed.",
  },
];

function FeatureGroup({ label, items }: { label: string; items: FeatureItem[] }) {
  return (
    <div>
      <h3 className="font-display text-xl md:text-2xl font-bold text-foreground text-center mb-6">
        {label}
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((item) => (
          <FeatureCard
            key={item.title}
            icon={item.icon}
            title={item.title}
            description={item.description}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Landing Page 2.0 — "Everything You Need to Grow Your Business" section.
 * Two feature groups (Business / Customer), each rendered from a data array
 * via FeatureCard from the Mystery Unlock UI Foundation.
 */
export const Features = memo(function Features() {
  return (
    <SectionContainer
      as="section"
      id="features"
      maxWidth="xl"
      spacing="none"
      className="py-20 lg:py-28"
      aria-labelledby="features-heading"
    >
      <div className="max-w-2xl mx-auto text-center mb-14">
        <h2
          id="features-heading"
          className="font-display text-3xl md:text-4xl font-bold leading-tight text-foreground"
        >
          Everything You Need to Grow Your Business
        </h2>
        <p className="mt-4 text-base md:text-lg text-muted-foreground">
          Mystery Unlock gives both businesses and customers a complete loyalty
          ecosystem.
        </p>
      </div>

      <div className="flex flex-col gap-16">
        <FeatureGroup label="For Businesses" items={BUSINESS_FEATURES} />
        <FeatureGroup label="For Customers" items={CUSTOMER_FEATURES} />
      </div>
    </SectionContainer>
  );
});

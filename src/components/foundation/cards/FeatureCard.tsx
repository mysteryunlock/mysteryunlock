import * as React from "react";
import { cn } from "@/lib/utils";
import { FoundationCard } from "./Card";

export interface FeatureCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description: string;
}

/**
 * Icon + title + description card used in feature grids on marketing pages.
 */
const FeatureCard = React.forwardRef<HTMLDivElement, FeatureCardProps>(
  ({ className, icon, title, description, ...props }, ref) => (
    <FoundationCard
      ref={ref}
      padding="lg"
      elevation="sm"
      hover="lift"
      className={cn("flex flex-col gap-4 h-full", className)}
      {...props}
    >
      {icon && (
        <span className="flex items-center justify-center size-12 rounded-xl bg-primary text-primary-foreground shrink-0">
          {icon}
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <h3 className="font-display font-semibold text-lg text-foreground tracking-tight">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </FoundationCard>
  ),
);
FeatureCard.displayName = "FeatureCard";

export { FeatureCard };

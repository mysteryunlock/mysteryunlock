import * as React from "react";
import { cn } from "@/lib/utils";
import { FoundationCard } from "./Card";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** e.g. "10k+" */
  value: React.ReactNode;
  /** e.g. "Spins delivered" */
  label: string;
  icon?: React.ReactNode;
  /** Optional trend text, e.g. "+12% this month" */
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
}

/**
 * Compact metric display used on the landing page stat strip and dashboard
 * overview. Purely presentational — pass in already-computed values.
 */
const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, value, label, icon, trend, trendDirection = "neutral", ...props }, ref) => (
    <FoundationCard
      ref={ref}
      padding="md"
      elevation="sm"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    >
      <div className="flex items-center justify-center sm:justify-start gap-2">
        {icon && (
          <span className="flex items-center justify-center size-9 rounded-full bg-accent/10 text-accent shrink-0">
            {icon}
          </span>
        )}
        <span className="font-display font-bold text-2xl sm:text-3xl text-foreground tabular-nums">
          {value}
        </span>
      </div>
      <p className="text-xs sm:text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {trend && (
        <span
          className={cn(
            "text-xs font-semibold",
            trendDirection === "up" && "text-emerald-600",
            trendDirection === "down" && "text-destructive",
            trendDirection === "neutral" && "text-muted-foreground",
          )}
        >
          {trend}
        </span>
      )}
    </FoundationCard>
  ),
);
StatCard.displayName = "StatCard";

export { StatCard };

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const foundationBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        navy: "bg-primary text-primary-foreground",
        gold: "bg-accent text-accent-foreground",
        subtle: "bg-muted text-muted-foreground",
        outline: "border border-border bg-transparent text-foreground",
        success: "bg-emerald-100 text-emerald-700",
      },
    },
    defaultVariants: {
      variant: "subtle",
    },
  },
);

export interface FoundationBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof foundationBadgeVariants> {}

/**
 * Small pill used for status tags, "New" labels, or category chips.
 * Distinct from src/components/ui/badge.tsx (kept untouched) — this variant
 * set is tuned to the marketing/brand palette (navy / gold / subtle).
 */
function FoundationBadge({ className, variant, ...props }: FoundationBadgeProps) {
  return <span className={cn(foundationBadgeVariants({ variant, className }))} {...props} />;
}

export { FoundationBadge, foundationBadgeVariants };

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const foundationCardVariants = cva(
  "rounded-2xl border border-border bg-card text-card-foreground transition-shadow duration-200",
  {
    variants: {
      elevation: {
        flat: "shadow-none",
        sm: "shadow-sm",
        md: "shadow-md",
        lg: "shadow-lg",
      },
      hover: {
        none: "",
        lift: "hover:-translate-y-1 hover:shadow-lg",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      elevation: "sm",
      hover: "none",
      padding: "md",
    },
  },
);

export interface FoundationCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof foundationCardVariants> {}

/**
 * General-purpose surface card used across marketing and dashboard UI.
 * Wraps the base shadcn Card styling with brand radius + optional hover lift.
 */
const FoundationCard = React.forwardRef<HTMLDivElement, FoundationCardProps>(
  ({ className, elevation, hover, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(foundationCardVariants({ elevation, hover, padding, className }))}
      {...props}
    />
  ),
);
FoundationCard.displayName = "FoundationCard";

const FoundationCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 mb-4", className)} {...props} />
  ),
);
FoundationCardHeader.displayName = "FoundationCardHeader";

const FoundationCardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("font-display font-semibold text-lg leading-tight tracking-tight text-foreground", className)}
      {...props}
    />
  ),
);
FoundationCardTitle.displayName = "FoundationCardTitle";

const FoundationCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
FoundationCardDescription.displayName = "FoundationCardDescription";

export {
  FoundationCard,
  FoundationCardHeader,
  FoundationCardTitle,
  FoundationCardDescription,
  foundationCardVariants,
};

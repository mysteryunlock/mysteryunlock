import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const sectionContainerVariants = cva("w-full mx-auto px-4 sm:px-6 lg:px-8", {
  variants: {
    maxWidth: {
      sm: "max-w-3xl",
      md: "max-w-5xl",
      lg: "max-w-6xl",
      xl: "max-w-7xl",
      full: "max-w-none",
    },
    spacing: {
      none: "py-0",
      sm: "py-8 sm:py-10",
      md: "py-12 sm:py-16",
      lg: "py-16 sm:py-24",
    },
  },
  defaultVariants: {
    maxWidth: "lg",
    spacing: "md",
  },
});

export interface SectionContainerProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionContainerVariants> {
  /** Renders as this HTML tag. Defaults to "section". */
  as?: "section" | "div" | "article";
}

/**
 * Standard responsive wrapper for page sections — centers content, applies
 * consistent horizontal gutters and vertical rhythm. Use for landing-page
 * sections, dashboard panels, or any full-width block of content.
 */
const SectionContainer = React.forwardRef<HTMLElement, SectionContainerProps>(
  ({ className, maxWidth, spacing, as = "section", ...props }, ref) => {
    const Comp = as as React.ElementType;
    return (
      <Comp
        ref={ref}
        className={cn(sectionContainerVariants({ maxWidth, spacing, className }))}
        {...props}
      />
    );
  },
);
SectionContainer.displayName = "SectionContainer";

export { SectionContainer, sectionContainerVariants };

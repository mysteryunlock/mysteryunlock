import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const heroButtonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-full font-display font-bold cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        gold: "gradient-primary text-white glow-gold",
        outline: "bg-transparent text-white border-2 border-white/70 hover:bg-white/10",
      },
      size: {
        default: "h-12 px-7 text-sm [&_svg]:size-4",
        lg: "h-14 px-9 text-base [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "gold",
      size: "lg",
    },
  },
);

export interface HeroButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof heroButtonVariants> {
  asChild?: boolean;
}

/**
 * Large, high-impact CTA button intended for hero sections and other
 * high-visibility marketing moments. Not meant for dense UI (forms, tables).
 */
const HeroButton = React.forwardRef<HTMLButtonElement, HeroButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(heroButtonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
HeroButton.displayName = "HeroButton";

export { HeroButton, heroButtonVariants };

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const secondaryButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-display font-semibold cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/70 active:scale-[0.98]",
  {
    variants: {
      size: {
        sm: "h-9 px-4 text-sm [&_svg]:size-4",
        default: "h-11 px-6 text-sm [&_svg]:size-4",
        lg: "h-13 px-8 text-base [&_svg]:size-5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export interface SecondaryButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof secondaryButtonVariants> {
  asChild?: boolean;
}

/**
 * Secondary button for supporting actions alongside a PrimaryButton.
 * Uses a subtle neutral background so it never competes with the primary CTA.
 */
const SecondaryButton = React.forwardRef<HTMLButtonElement, SecondaryButtonProps>(
  ({ className, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(secondaryButtonVariants({ size, className }))}
        {...props}
      />
    );
  },
);
SecondaryButton.displayName = "SecondaryButton";

export { SecondaryButton, secondaryButtonVariants };

/**
 * Design System — Button
 *
 * Single button component replacing all five existing patterns:
 *   • dashboard inline bg-[#FF6B1A] strings
 *   • foundation PrimaryButton / SecondaryButton / OutlineButton
 *   • auth inline style={{ backgroundColor: "#2E3C48" }}
 *   • customer portal gradient-primary
 *   • game CTA gradient-primary text-[#0F1115]
 *
 * Variants:  primary | secondary | outline | ghost | danger
 * Sizes:     xs | sm | md (default) | lg | xl (game CTA)
 * Extras:    icon (square), loading state, asChild (Radix Slot)
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Variant definitions
// ─────────────────────────────────────────────────────────────

const btnVariants = cva(
  // Base — every button shares these
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-display font-semibold cursor-pointer select-none",
    "transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B1A] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
    "active:scale-[0.97]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        // Orange gradient — primary brand CTA
        primary: [
          "gradient-primary text-white",
          "shadow-[0_4px_16px_-4px_rgba(255,107,26,0.45)]",
          "hover:shadow-[0_6px_20px_-4px_rgba(255,107,26,0.60)]",
          "hover:opacity-95",
        ],
        // Navy fill — important secondary action
        secondary: [
          "bg-[#0C2340] text-white",
          "hover:bg-[#1a3a66]",
          "shadow-[0_2px_8px_-2px_rgba(12,35,64,0.25)]",
          "hover:shadow-[0_4px_12px_-2px_rgba(12,35,64,0.35)]",
        ],
        // Bordered — tertiary / cancel
        outline: [
          "bg-white text-[#0C2340]",
          "border border-[#0C2340]/20",
          "hover:border-[#0C2340]/40 hover:bg-[#F7F8FA]",
          "shadow-[0_1px_4px_-1px_rgba(12,35,64,0.08)]",
        ],
        // Subtle — nav links, icon-adjacent actions
        ghost: [
          "bg-transparent text-[#4a5b78]",
          "hover:bg-[#0C2340]/6 hover:text-[#0C2340]",
        ],
        // Destructive — delete, remove
        danger: [
          "bg-red-600 text-white",
          "hover:bg-red-700",
          "shadow-[0_2px_8px_-2px_rgba(220,38,38,0.35)]",
        ],
        // Subtle destructive — outlined danger
        "danger-outline": [
          "bg-white text-red-600",
          "border border-red-200",
          "hover:bg-red-50 hover:border-red-400",
        ],
      },
      size: {
        xs: "h-7 px-3 text-xs rounded-lg [&_svg]:size-3.5",
        sm: "h-9 px-4 text-sm rounded-xl [&_svg]:size-4",
        md: "h-10 px-5 text-sm rounded-xl [&_svg]:size-4",
        lg: "h-11 px-6 text-[15px] rounded-xl [&_svg]:size-5",
        xl: "h-14 px-8 text-lg tracking-wide rounded-2xl [&_svg]:size-5",
        // Square icon-only
        icon: "size-10 rounded-xl [&_svg]:size-5",
        "icon-sm": "size-8 rounded-lg [&_svg]:size-4",
        "icon-lg": "size-12 rounded-xl [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export interface BtnProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof btnVariants> {
  /** Render as a child component (e.g. <a>, Link) via Radix Slot */
  asChild?: boolean;
  /** Show a loading spinner and disable interactions */
  loading?: boolean;
  /** Left-side icon */
  leftIcon?: React.ReactNode;
  /** Right-side icon */
  rightIcon?: React.ReactNode;
}

const Btn = React.forwardRef<HTMLButtonElement, BtnProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(btnVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </Comp>
    );
  },
);
Btn.displayName = "Btn";

export { Btn, btnVariants };

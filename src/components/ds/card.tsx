/**
 * Design System — Card
 *
 * Single card component replacing all four existing patterns:
 *   • DashCard (rounded-[20px], inline hex shadow)
 *   • KpiCard (same shape, different content)
 *   • MerchantHubCard (slightly different shadow)
 *   • Portal cards (rounded-2xl bg-card border border-border)
 *
 * Variants:
 *   default    — white, 1px border, soft shadow (most content)
 *   interactive— same + hover lift + orange border glow (clickable)
 *   elevated   — stronger shadow for modals / pickers
 *   flat       — border only, no shadow (nested cards)
 *   glass      — backdrop blur + transparent white
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Variant definitions
// ─────────────────────────────────────────────────────────────

const cardVariants = cva(
  "rounded-[20px] bg-white border border-[#0C2340]/8 transition-all duration-200",
  {
    variants: {
      variant: {
        default: "shadow-[0_2px_12px_-4px_rgba(12,35,64,0.08)]",
        interactive: [
          "shadow-[0_2px_12px_-4px_rgba(12,35,64,0.08)]",
          "cursor-pointer",
          "hover:border-[#FF6B1A]/35",
          "hover:shadow-[0_6px_24px_-6px_rgba(255,107,26,0.18)]",
          "hover:-translate-y-0.5",
        ],
        elevated: "shadow-[0_6px_28px_-8px_rgba(12,35,64,0.16)]",
        flat: "shadow-none",
        glass: [
          "bg-white/70 backdrop-blur-sm",
          "border-[#0C2340]/6",
          "shadow-[0_4px_20px_-8px_rgba(12,35,64,0.10)]",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// ─────────────────────────────────────────────────────────────
// Card (generic wrapper)
// ─────────────────────────────────────────────────────────────

export interface CardProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof cardVariants> {
  /** Render as button when true (applies interactive variant automatically) */
  asButton?: boolean;
}

const Card = React.forwardRef<HTMLElement, CardProps>(
  ({ className, variant, asButton, onClick, children, ...props }, ref) => {
    // When used as a button, force interactive variant
    const resolvedVariant = asButton || onClick ? (variant ?? "interactive") : variant;

    if (asButton || onClick) {
      return (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          onClick={onClick}
          className={cn(
            cardVariants({ variant: resolvedVariant }),
            "text-left w-full",
            className,
          )}
          {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {children}
        </button>
      );
    }

    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn(cardVariants({ variant: resolvedVariant }), className)}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      >
        {children}
      </div>
    );
  },
);
Card.displayName = "Card";

// ─────────────────────────────────────────────────────────────
// KpiCard — metric card with icon, label, value, delta
// ─────────────────────────────────────────────────────────────

import type { LucideIcon } from "lucide-react";

export interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Tailwind classes for the icon container background + icon color */
  accentClass?: string;
  /** Percentage delta vs previous period (positive = up, negative = down) */
  delta?: number;
  onClick?: () => void;
  className?: string;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accentClass = "bg-[#FF6B1A]/10 text-[#FF6B1A]",
  delta,
  onClick,
  className,
}: KpiCardProps) {
  const inner = (
    <div className="p-4">
      <div className={cn("w-9 h-9 rounded-xl grid place-items-center", accentClass)}>
        <Icon className="w-4 h-4" strokeWidth={2} />
      </div>
      <p className="text-[11px] uppercase tracking-wider text-[#4a5b78] mt-3 font-semibold leading-tight">
        {label}
      </p>
      <div className="flex items-end justify-between gap-1 mt-1">
        <p className="text-2xl font-black text-[#0C2340] leading-none font-display">{value}</p>
        {delta !== undefined && (
          <span
            className={cn(
              "mb-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none",
              delta > 0
                ? "bg-emerald-50 text-emerald-700"
                : delta < 0
                  ? "bg-red-50 text-red-600"
                  : "bg-slate-100 text-slate-500",
            )}
          >
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "—"}
            {delta !== 0 ? `${Math.abs(delta)}%` : ""}
          </span>
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <Card
        variant="interactive"
        asButton
        onClick={onClick}
        className={className}
      >
        {inner}
      </Card>
    );
  }

  return (
    <Card variant="default" className={className}>
      {inner}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export { Card, cardVariants, KpiCard };

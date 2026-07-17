/**
 * Design System — Badge
 *
 * Unified badge/pill replacing:
 *   • Status pills in DashCard (hardcoded className strings)
 *   • Segment chips in CustomerCrm (hardcoded bg/text pairs)
 *   • StatusBadge in ui.tsx (custom implementation)
 *   • "Coming Soon" / "New" labels (ad-hoc span elements)
 *
 * Semantic variants map to business concepts, not just colors.
 * Size variants: sm (default) | md | lg
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Variant definitions
// ─────────────────────────────────────────────────────────────

const badgeVariants = cva(
  "inline-flex items-center gap-1 font-semibold leading-none rounded-full whitespace-nowrap",
  {
    variants: {
      variant: {
        // Campaign / record statuses
        active: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
        paused: "bg-amber-50 text-amber-700 border border-amber-200/60",
        draft: "bg-slate-100 text-slate-600 border border-slate-200/60",
        archived: "bg-slate-50 text-slate-500 border border-slate-200/60",
        // Customer segment / tier
        winner: "bg-[#FF6B1A]/10 text-[#FF6B1A] border border-[#FF6B1A]/20",
        vip: "bg-purple-50 text-purple-700 border border-purple-200/60",
        premium: "bg-[#0C2340]/8 text-[#0C2340] border border-[#0C2340]/15",
        new: "bg-sky-50 text-sky-700 border border-sky-200/60",
        lapsed: "bg-slate-100 text-slate-500 border border-slate-200/60",
        // Claim / prize statuses
        claimed: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
        unclaimed: "bg-amber-50 text-amber-700 border border-amber-200/60",
        expired: "bg-red-50 text-red-600 border border-red-200/60",
        // Feature flags
        "coming-soon": "bg-slate-100 text-slate-500 border border-slate-200/60",
        // Generic
        default: "bg-[#0C2340]/6 text-[#0C2340] border border-[#0C2340]/10",
        orange: "bg-[#FF6B1A]/10 text-[#FF6B1A] border border-[#FF6B1A]/20",
        navy: "bg-[#0C2340] text-white border border-[#0C2340]",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5 tracking-wide uppercase",
        md: "text-xs px-2.5 py-1",
        lg: "text-sm px-3 py-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Optional dot indicator before the label */
  dot?: boolean;
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full shrink-0",
            variant === "active" || variant === "claimed" ? "bg-emerald-500" :
            variant === "paused" || variant === "unclaimed" ? "bg-amber-500" :
            variant === "archived" || variant === "lapsed" || variant === "coming-soon" ? "bg-slate-400" :
            variant === "expired" ? "bg-red-500" :
            variant === "winner" || variant === "orange" ? "bg-[#FF6B1A]" :
            variant === "vip" ? "bg-purple-500" :
            variant === "new" ? "bg-sky-500" :
            variant === "navy" ? "bg-white" :
            "bg-current",
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// StatusBadge convenience — maps campaign status strings
// ─────────────────────────────────────────────────────────────

type CampaignStatus = "active" | "paused" | "draft" | "archived";

const STATUS_LABELS: Record<CampaignStatus, string> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
  archived: "Archived",
};

function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const s = (status ?? "draft") as CampaignStatus;
  const variant = (["active", "paused", "draft", "archived"].includes(s) ? s : "draft") as
    | "active"
    | "paused"
    | "draft"
    | "archived";

  return (
    <Badge variant={variant} dot className={className}>
      {STATUS_LABELS[variant] ?? status}
    </Badge>
  );
}

export { Badge, badgeVariants, StatusBadge };

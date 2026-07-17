/**
 * Design System — Skeleton / Loading States
 *
 * Unified shimmer system replacing:
 *   • dashboard/ui.tsx: SkeletonKpiCard, SkeletonBlock, SkeletonRow, ShimmerBar, ShimmerBlock
 *   • customer/PortalSkeleton.tsx: PageSkeleton, CardListSkeleton, PrizeCardSkeleton
 *   • foundation/feedback/LoadingSkeleton.tsx: card | text | avatar | table-row variants
 *   • Inline animate-pulse divs scattered across routes
 *
 * All skeletons use the GPU-composited animate-skeleton-shimmer pattern
 * defined in styles.css (will-change: transform on a sliding pseudo-element).
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Primitive: ShimmerBox — single shimmer block
// ─────────────────────────────────────────────────────────────

export interface ShimmerBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Override the shimmer animation (default: true) */
  shimmer?: boolean;
}

function ShimmerBox({ className, shimmer = true, ...props }: ShimmerBoxProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#0C2340]/6 rounded-xl",
        shimmer && "after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent after:animate-skeleton-shimmer",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonBar — single text line placeholder
// ─────────────────────────────────────────────────────────────

function SkeletonBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <ShimmerBox className={cn("h-3 rounded-lg", className)} {...props} />;
}

// ─────────────────────────────────────────────────────────────
// SkeletonBlock — arbitrary rectangular block
// ─────────────────────────────────────────────────────────────

function SkeletonBlock({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <ShimmerBox className={cn("rounded-2xl", className)} {...props} />;
}

// ─────────────────────────────────────────────────────────────
// SkeletonKpi — KPI card placeholder (matches KpiCard layout)
// ─────────────────────────────────────────────────────────────

function SkeletonKpi({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_2px_12px_-4px_rgba(12,35,64,0.08)] p-4 space-y-3",
        className,
      )}
      aria-hidden="true"
    >
      <ShimmerBox className="w-9 h-9 rounded-xl" />
      <SkeletonBar className="w-20 h-2.5 mt-3" />
      <SkeletonBar className="w-12 h-6 rounded-lg" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonRow — list row placeholder (avatar + two lines)
// ─────────────────────────────────────────────────────────────

function SkeletonRow({
  className,
  hasAvatar = true,
}: {
  className?: string;
  hasAvatar?: boolean;
}) {
  return (
    <div
      className={cn("flex items-center gap-3 py-3", className)}
      aria-hidden="true"
    >
      {hasAvatar && <ShimmerBox className="w-10 h-10 rounded-full flex-shrink-0" />}
      <div className="flex-1 space-y-2">
        <SkeletonBar className="w-1/3" />
        <SkeletonBar className="w-1/2 h-2.5" />
      </div>
      <SkeletonBar className="w-14 h-5 rounded-full flex-shrink-0" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonCard — full card placeholder
// ─────────────────────────────────────────────────────────────

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_2px_12px_-4px_rgba(12,35,64,0.08)] p-4",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex items-center gap-4">
        <ShimmerBox className="w-12 h-12 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonBar className="w-28" />
          <SkeletonBar className="w-40 h-2.5" />
        </div>
        <ShimmerBox className="w-5 h-5 rounded-full flex-shrink-0" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonAvatar — circular avatar + two text lines
// ─────────────────────────────────────────────────────────────

function SkeletonAvatar({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)} aria-hidden="true">
      <ShimmerBox className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBar className="w-1/3" />
        <SkeletonBar className="w-1/2 h-2.5" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SkeletonKpiGrid — 2×N grid of KPI cards
// ─────────────────────────────────────────────────────────────

function SkeletonKpiGrid({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3", className)}
      aria-hidden="true"
      aria-label="Loading metrics"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKpi key={i} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PageSkeleton — full-page loading shell (replaces portal version)
// ─────────────────────────────────────────────────────────────

function PageSkeleton({ hasHeader = true }: { hasHeader?: boolean }) {
  return (
    <div className="min-h-[100dvh] bg-background" aria-busy="true" aria-label="Loading">
      {hasHeader && (
        <div className="sticky top-0 z-30 bg-white/95 border-b border-[#0C2340]/8 h-24" />
      )}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        <div className="space-y-2.5">
          <SkeletonBar className="h-7 w-44" />
          <SkeletonBar className="h-4 w-36" />
        </div>
        <SkeletonKpiGrid count={4} />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export {
  ShimmerBox,
  SkeletonBar,
  SkeletonBlock,
  SkeletonKpi,
  SkeletonRow,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonKpiGrid,
  PageSkeleton,
};

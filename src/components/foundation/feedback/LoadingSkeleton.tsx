import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface LoadingSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * - "text": stacked text lines
   * - "card": a card-shaped block (image + lines)
   * - "avatar": circular avatar + two lines
   * - "table-row": a single table row placeholder
   */
  variant?: "text" | "card" | "avatar" | "table-row";
  /** Number of lines/rows to render for "text" and "table-row" variants. */
  lines?: number;
}

/**
 * Reusable loading placeholder built on top of the base ui Skeleton.
 * Use to indicate content is loading without shifting layout.
 */
function LoadingSkeleton({ className, variant = "text", lines = 3, ...props }: LoadingSkeletonProps) {
  if (variant === "card") {
    return (
      <div className={cn("flex flex-col gap-4 rounded-2xl border border-border p-6", className)} {...props}>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (variant === "avatar") {
    return (
      <div className={cn("flex items-center gap-3", className)} {...props}>
        <Skeleton className="size-10 rounded-full shrink-0" />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  }

  if (variant === "table-row") {
    return (
      <div className={cn("flex items-center gap-4 py-3", className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

export { LoadingSkeleton };

import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Placeholder shown when a list/table/section has no data yet.
 * Purely presentational — pass an action (e.g. a PrimaryButton) via `action`.
 */
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center px-6 py-12 sm:py-16",
        className,
      )}
      {...props}
    >
      {icon && (
        <span className="flex items-center justify-center size-14 rounded-full bg-muted text-muted-foreground mb-1">
          {icon}
        </span>
      )}
      <h3 className="font-display font-semibold text-lg text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";

export { EmptyState };

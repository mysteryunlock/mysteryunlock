/**
 * Design System — EmptyState
 *
 * Single implementation replacing three divergent ones:
 *   • src/components/dashboard/ui.tsx → EmptyState (icon: LucideIcon, inline hex)
 *   • src/components/customer/EmptyState.tsx → EmptyState (icon: string emoji)
 *   • src/components/foundation/feedback/EmptyState.tsx → EmptyState (icon: ReactNode)
 *
 * Accepts both LucideIcon (as component) and arbitrary ReactNode (as node).
 * Size variants: sm | md (default) | lg
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  /** Lucide icon component (preferred) or any ReactNode */
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional action slot for custom button rendering */
  actionNode?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  description,
  action,
  actionNode,
  size = "md",
  className,
}: EmptyStateProps) {
  // Determine if `icon` is a renderable React component (function or forwardRef
  // object) vs a ReactNode (string, element, etc.).
  // Lucide icons in modern versions are React.forwardRef() objects — their
  // typeof is "object", not "function" — so we must check both.
  const isLucideIcon =
    typeof icon === "function" ||
    (typeof icon === "object" &&
      icon !== null &&
      "$$typeof" in (icon as object));

  const iconSizeMap = { sm: "w-5 h-5", md: "w-6 h-6", lg: "w-7 h-7" } as const;
  const containerSizeMap = { sm: "w-12 h-12 rounded-2xl", md: "w-14 h-14 rounded-2xl", lg: "w-16 h-16 rounded-2xl" } as const;
  const paddingMap = { sm: "py-8", md: "py-12", lg: "py-16" } as const;
  const titleMap = { sm: "text-sm", md: "text-base", lg: "text-lg" } as const;

  const IconComp = isLucideIcon ? (icon as LucideIcon) : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 animate-fade-in",
        paddingMap[size],
        className,
      )}
    >
      {/* Icon container */}
      {icon && (
        <div
          className={cn(
            "grid place-items-center mb-4 bg-[#FF6B1A]/8 text-[#FF6B1A] shrink-0",
            containerSizeMap[size],
          )}
          aria-hidden="true"
        >
          {IconComp ? (
            <IconComp className={iconSizeMap[size]} strokeWidth={1.75} />
          ) : (
            <span className="text-2xl leading-none">{icon as React.ReactNode}</span>
          )}
        </div>
      )}

      {/* Text */}
      <p className={cn("font-display font-bold text-[#0C2340]", titleMap[size])}>
        {title}
      </p>
      {description && (
        <p className="text-sm text-[#4a5b78] mt-1.5 max-w-xs leading-relaxed">
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || actionNode) && (
        <div className="mt-5">
          {actionNode ?? (
            action && (
              <button
                type="button"
                onClick={action.onClick}
                className="px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-bold shadow-sm hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer"
              >
                {action.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export { EmptyState };

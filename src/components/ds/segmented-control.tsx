/**
 * Design System — SegmentedControl
 *
 * Replaces the three separate custom toggle-pill implementations:
 *   • StatsTab time-range switcher (7d / 30d / All)
 *   • Any other tab-switching pill groups in the app
 *
 * Single-select only. For multi-select, use checkboxes.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SegmentOption<T extends string = string> {
  label: string;
  value: T;
  /** Optional icon before label */
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Overall size of the control */
  size?: "sm" | "md";
  className?: string;
  /** Accessible label for the group */
  "aria-label"?: string;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  className,
  "aria-label": ariaLabel = "Select option",
}: SegmentedControlProps<T>) {
  const paddingMap = { sm: "p-0.5", md: "p-1" } as const;
  const itemMap = {
    sm: "px-3 py-1 text-xs rounded-lg min-h-[28px]",
    md: "px-4 py-1.5 text-sm rounded-xl min-h-[34px]",
  } as const;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center bg-[#F7F8FA] rounded-xl border border-[#0C2340]/8",
        paddingMap[size],
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={opt.disabled}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 font-semibold transition-all duration-150 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B1A]/40",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              itemMap[size],
              isActive
                ? "bg-white text-[#0C2340] shadow-[0_1px_4px_-1px_rgba(12,35,64,0.15)] border border-[#0C2340]/8"
                : "text-[#4a5b78] hover:text-[#0C2340]",
            )}
          >
            {opt.icon && (
              <span className="shrink-0" aria-hidden="true">
                {opt.icon}
              </span>
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export { SegmentedControl };

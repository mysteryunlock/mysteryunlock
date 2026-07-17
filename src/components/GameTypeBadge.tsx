/**
 * GameTypeBadge — reusable pill that indicates whether a campaign is a
 * Spin Wheel or Scratch Card. Drop it wherever a game-type indicator is needed.
 */

import { RotateCcw, CreditCard } from "lucide-react";

interface GameTypeBadgeProps {
  gameType?: string | null;
  /** "sm" (default) = small pill, "md" = slightly larger */
  size?: "sm" | "md";
  className?: string;
}

export function GameTypeBadge({ gameType, size = "sm", className = "" }: GameTypeBadgeProps) {
  const isScratch = gameType === "scratch";

  const sizeClass = size === "md"
    ? "px-3 py-1 text-[12px] gap-1.5"
    : "px-2 py-0.5 text-[11px] gap-1";

  const colorClass = isScratch
    ? "bg-purple-50 text-purple-700 border border-purple-200/60"
    : "bg-sky-50 text-sky-700 border border-sky-200/60";

  const iconClass = size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${sizeClass} ${colorClass} ${className}`}
      aria-label={isScratch ? "Scratch Card campaign" : "Spin Wheel campaign"}
    >
      {isScratch
        ? <CreditCard className={iconClass} strokeWidth={2} />
        : <RotateCcw  className={iconClass} strokeWidth={2} />
      }
      <span>{isScratch ? "Scratch" : "Spin"}</span>
    </span>
  );
}

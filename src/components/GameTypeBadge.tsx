/**
 * GameTypeBadge — reusable pill that indicates whether a campaign is a
 * Spin Wheel or Scratch Card.  Drop it wherever a game-type indicator is needed.
 */

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
    ? "bg-purple-50 text-purple-700 border border-purple-200"
    : "bg-sky-50 text-sky-700 border border-sky-200";

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${sizeClass} ${colorClass} ${className}`}
      aria-label={isScratch ? "Scratch Card campaign" : "Spin Wheel campaign"}
    >
      {isScratch ? "🎟" : "🎡"}
      <span>{isScratch ? "Scratch" : "Spin"}</span>
    </span>
  );
}

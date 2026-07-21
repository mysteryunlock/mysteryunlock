/**
 * ShuffleCard — a single card in the Shuffle & Choose experience.
 *
 * Emotional reveal edition:
 *   - "selected" state: scale 1.12, lift y -16, warm orange halo div,
 *     spotlight-glow ring (stronger + slower than shuffle glow).
 *   - "disabled" state: 35% opacity + no interaction.
 *   - "revealed" win state: orange burst bloom behind the prize face.
 *   - Real 3-D flip, hover micro-interactions, reduced-motion compliance.
 *
 * Layout & shuffle transforms are owned by the wrapper in ShuffleChooseDeck.
 */

import { motion } from "framer-motion";
import { Trophy, RotateCcw, Sparkles } from "lucide-react";
import type { Prize } from "@/lib/spin-store";

// ─── Card back configuration ──────────────────────────────────────────────────

export interface CardBackConfig {
  /** Visual style of the card back. Defaults to "metallic" (silver foil). */
  style?:  "metallic" | "solid" | "gradient";
  /** Primary colour hex (used as fill for "solid", start colour for "gradient"). */
  color?:  string;
  /** Secondary colour hex (end colour for "gradient"). */
  color2?: string;
}

/** Returns the CSS `background` value for a given card back config. */
export function cardBackCss(cfg?: CardBackConfig): string {
  const style = cfg?.style ?? "metallic";
  if (style === "solid") {
    return cfg?.color ?? "#1a2744";
  }
  if (style === "gradient") {
    const c1 = cfg?.color  ?? "#1a2744";
    const c2 = cfg?.color2 ?? "#2d4a8a";
    return `linear-gradient(135deg, ${c1} 0%, ${c2} 55%, ${c1} 100%)`;
  }
  // "metallic" (default) — silver foil
  return "linear-gradient(135deg,#7A8FA8 0%,#B8C8DC 16%,#4A6080 30%,#C8DCF0 44%,#7A8FA8 58%,#E8F0FA 72%,#7A8FA8 100%)";
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardState =
  | "face-up"    // preview — prize visible
  | "face-down"  // shuffle — mystery back shown, no interaction
  | "choosing"   // shuffle ended — mystery back, tap enabled
  | "selected"   // chosen — mystery back, lifted + spotlight glow
  | "disabled"   // unchosen — dimmed + blurred, no interaction
  | "revealed";  // post-scratch reveal — prize visible, face-up with bounce

// ─── Prize face (front) ───────────────────────────────────────────────────────

function PrizeFace({ prize, isRevealed }: { prize: Prize; isRevealed?: boolean }) {
  return (
    <div
      className={`absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-2 p-2 overflow-hidden bg-gradient-to-b from-[#f0f5ff] to-[#e4edf8]${isRevealed ? " animate-card-reveal" : ""}`}
    >
      {/* Accent stripe */}
      <div className="absolute top-0 inset-x-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-[#FF6B1A] to-[#0c2340]" />

      {/* Win: warm orange burst bloom on reveal */}
      {prize.isWin && isRevealed && (
        <div
          className="absolute pointer-events-none animate-win-burst"
          style={{
            inset: "-25%",
            background:
              "radial-gradient(ellipse at center, rgba(255,107,26,0.52) 0%, rgba(255,107,26,0.18) 40%, transparent 70%)",
            borderRadius: "inherit",
          }}
        />
      )}

      {/* Win: foil shimmer on face-up preview */}
      {prize.isWin && !isRevealed && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none animate-foil-shimmer opacity-60"
          style={{
            background:
              "linear-gradient(105deg,transparent 38%,rgba(255,107,26,0.18) 50%,transparent 62%)",
            backgroundSize: "250% 100%",
          }}
        />
      )}

      {/* Image or icon */}
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-white border border-[#0c2340]/10 flex items-center justify-center shadow-sm flex-shrink-0">
        {prize.image ? (
          <img src={prize.image} alt={prize.name} className="w-full h-full object-cover" loading="lazy" />
        ) : prize.isWin ? (
          <Trophy className="w-7 h-7 text-[#FF6B1A]" strokeWidth={1.5} />
        ) : (
          <RotateCcw className="w-6 h-6 text-[#4a5b78]" strokeWidth={1.5} />
        )}
      </div>

      {/* Name */}
      <p className="text-[#0c2340] font-black text-center leading-tight text-[10px] sm:text-[11px] max-w-full px-1 line-clamp-2">
        {prize.name}
      </p>

      {/* Badge */}
      {prize.isWin ? (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#FF6B1A] bg-orange-50 border border-orange-200/80 px-1.5 py-0.5 rounded-full">
          <Sparkles className="w-2.5 h-2.5" strokeWidth={2.5} />
          Prize
        </span>
      ) : (
        <span className="text-[9px] font-semibold text-[#4a5b78] bg-[#F5F7FA] border border-[#0c2340]/10 px-1.5 py-0.5 rounded-full">
          Try Again
        </span>
      )}
    </div>
  );
}

// ─── Mystery back face ────────────────────────────────────────────────────────

function MysteryFace({
  isSelected,
  cardBack,
}: {
  isSelected?: boolean;
  cardBack?:   CardBackConfig;
}) {
  return (
    <div
      className="absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center"
      style={{ background: cardBackCss(cardBack) }}
    >
      {/* Horizontal sheen lines */}
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-x-0 h-px"
          style={{ top: `${(i + 1) * 6}%`, background: "rgba(255,255,255,0.12)" }}
        />
      ))}

      {/* Sweep shimmer */}
      <div className="absolute inset-0 pointer-events-none animate-foil-shimmer" />

      {/* Centre icon */}
      <div className="relative z-10 flex flex-col items-center gap-1.5">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" strokeWidth={1.75} />
        </div>
        {isSelected && (
          <p className="text-white font-black text-[10px] tracking-widest mt-0.5">CHECKING…</p>
        )}
      </div>

      {/* Spotlight glow ring — suspense selection state */}
      {isSelected && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none animate-spotlight-glow" />
      )}
    </div>
  );
}

// ─── ShuffleCard ──────────────────────────────────────────────────────────────

interface ShuffleCardProps {
  prize: Prize;
  state: CardState;
  onClick?: () => void;
  /** Tilt angle during shuffle (wrapper handles this now, kept for API compat) */
  rotation?: number;
  /** Skip animations for prefers-reduced-motion */
  reducedMotion?: boolean;
  /** Optional card back styling set by the shop owner */
  cardBack?: CardBackConfig;
}

export function ShuffleCard({
  prize,
  state,
  onClick,
  rotation = 0,
  reducedMotion = false,
  cardBack,
}: ShuffleCardProps) {
  const faceDown =
    state === "face-down" ||
    state === "choosing" ||
    state === "selected" ||
    state === "disabled";

  const isSelected  = state === "selected";
  const isChoosing  = state === "choosing";
  const isDisabled  = state === "disabled";
  const isRevealed  = state === "revealed";
  const isClickable = (isChoosing || isSelected) && !!onClick;

  // ── Outer wrapper: scale / y-lift / rotate / opacity ─────────────────────
  const outerAnimate = {
    scale:   isSelected ? 1.12 : isDisabled ? 0.95 : 1,
    y:       isSelected ? -16  : 0,
    opacity: isDisabled ? 0.35 : 1,
    rotate:  reducedMotion ? 0 : rotation,
  };

  const outerTransition = reducedMotion
    ? { duration: 0.01 }
    : {
        scale:   { duration: 0.42, ease: [0.34, 1.56, 0.64, 1] as [number,number,number,number] },
        y:       { duration: 0.42, ease: [0.34, 1.56, 0.64, 1] as [number,number,number,number] },
        opacity: { duration: 0.32, ease: "easeOut" },
        rotate:  { duration: 0.32, ease: "easeOut" },
      };

  // ── Inner flip ────────────────────────────────────────────────────────────
  const flipTransition = reducedMotion
    ? { duration: 0.01 }
    : {
        duration: 0.58,
        ease: [0.4, 0.0, 0.2, 1] as [number,number,number,number],
      };

  return (
    <motion.div
      className="relative"
      style={{ perspective: "1200px" }}
      animate={outerAnimate}
      transition={outerTransition}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable && onClick
          ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); }
          : undefined
      }
      aria-label={
        faceDown
          ? isChoosing ? "Mystery card — tap to choose" : "Mystery card"
          : prize.name
      }
      whileHover={
        !reducedMotion && isChoosing ? { y: -5, scale: 1.04, rotate: 0 } : undefined
      }
      whileTap={
        !reducedMotion && isChoosing ? { scale: 0.93, y: 0 } : undefined
      }
    >
      {/* ── Warm orange halo — appears only on selected state ── */}
      {isSelected && !reducedMotion && (
        <motion.div
          className="absolute pointer-events-none"
          style={{
            inset: "-18px",
            borderRadius: "28px",
            background:
              "radial-gradient(ellipse at center, rgba(255,107,26,0.38) 0%, rgba(255,107,26,0.10) 55%, transparent 75%)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      )}

      {/* ── Drop shadow — lifts with the card ── */}
      {isSelected && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            boxShadow:
              "0 22px 52px rgba(255,107,26,0.42), 0 10px 28px rgba(12,35,64,0.28)",
          }}
        />
      )}

      <div className="aspect-square w-full">
        {/* preserve-3d inner wrapper — rotates to flip faces */}
        <motion.div
          className="relative w-full h-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: faceDown ? 180 : 0 }}
          transition={flipTransition}
        >
          {/* Front: prize visible */}
          <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
            <PrizeFace prize={prize} isRevealed={isRevealed} />
          </div>

          {/* Back: mystery foil */}
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <MysteryFace isSelected={isSelected} cardBack={cardBack} />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

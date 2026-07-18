/**
 * ShuffleCard — a single card in the Shuffle & Choose experience.
 *
 * Two faces:
 *   Front (face-up)  — prize name, image/icon, win/try-again badge
 *   Back  (face-down) — identical mystery foil for all cards during shuffle
 *
 * 3-D flip: Framer Motion animates rotateY on a preserve-3d wrapper.
 * backfaceVisibility: "hidden" ensures only one face is visible at a time.
 */

import { motion } from "framer-motion";
import { Trophy, RotateCcw, Sparkles } from "lucide-react";
import type { Prize } from "@/lib/spin-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardState =
  | "face-up"    // preview — prize visible
  | "face-down"  // shuffle — mystery back shown, no interaction
  | "choosing"   // shuffle ended — mystery back, tap enabled
  | "selected"   // chosen — mystery back, orange glow, scale-up
  | "disabled"   // unchosen — dimmed, no interaction
  | "revealed";  // post-scratch reveal — prize visible, face-up

// ─── Prize face (front) ───────────────────────────────────────────────────────

function PrizeFace({ prize }: { prize: Prize }) {
  return (
    <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-2 p-2 overflow-hidden bg-gradient-to-b from-[#f0f5ff] to-[#e4edf8]">
      {/* Accent stripe */}
      <div className="absolute top-0 inset-x-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-[#FF6B1A] to-[#0c2340]" />

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

function MysteryFace({ isSelected }: { isSelected?: boolean }) {
  return (
    <div
      className="absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center"
      style={{
        background:
          "linear-gradient(135deg,#8A9BB0 0%,#C8D4E0 18%,#5A6D84 32%,#DCE8F4 46%,#8A9BB0 60%,#F0F5FA 73%,#8A9BB0 100%)",
      }}
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
          <p className="text-white font-black text-[10px] tracking-widest mt-0.5">TAP TO SCRATCH</p>
        )}
      </div>

      {/* Orange selection ring */}
      {isSelected && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none animate-card-glow" />
      )}
    </div>
  );
}

// ─── ShuffleCard ──────────────────────────────────────────────────────────────

interface ShuffleCardProps {
  prize: Prize;
  state: CardState;
  onClick?: () => void;
  /** Slight random rotation applied during shuffle for natural feel */
  rotation?: number;
}

export function ShuffleCard({ prize, state, onClick, rotation = 0 }: ShuffleCardProps) {
  const faceDown =
    state === "face-down" ||
    state === "choosing" ||
    state === "selected" ||
    state === "disabled";

  const isSelected = state === "selected";
  const isChoosing = state === "choosing";
  const isDisabled = state === "disabled";
  const isClickable = (isChoosing || isSelected) && !!onClick;

  return (
    <motion.div
      layout
      className="relative"
      style={{ perspective: "900px" }}
      animate={{
        scale: isSelected ? 1.07 : isDisabled ? 0.91 : 1,
        opacity: isDisabled ? 0.42 : 1,
        rotate: rotation,
      }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable && onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      aria-label={faceDown ? (isChoosing ? "Mystery card — tap to choose" : "Mystery card") : prize.name}
      whileHover={isChoosing ? { scale: 1.05, rotate: 0 } : undefined}
      whileTap={isChoosing ? { scale: 0.97 } : undefined}
    >
      <div className="aspect-square w-full">
        {/* preserve-3d inner — rotates to flip between faces */}
        <motion.div
          className="relative w-full h-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: faceDown ? 180 : 0 }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Front: prize visible */}
          <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
            <PrizeFace prize={prize} />
          </div>

          {/* Back: mystery foil (pre-rotated so it's correct when parent flips) */}
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <MysteryFace isSelected={isSelected} />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

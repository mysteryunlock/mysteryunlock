/**
 * ShuffleChooseDeck — manages the full Shuffle & Choose card game.
 *
 * Phase progression (driven by parent route):
 *   preview   → face-up cards + "START SHUFFLE" button visible
 *   flipping  → all cards animate to face-down (staggered, ~0.8 s)
 *   shuffling → cards physically shuffle positions every ~380 ms (3–5 s total)
 *   choosing  → shuffle stops; "Choose ONE card" prompt; user taps one card
 *   chosen    → selected card glows/scales; rest dim; brief pause before scratch
 *   revealing → post-scratch; remaining cards flip up sequentially
 *
 * The parent route owns:
 *   - spinAndRecord call (prize determined before shuffle starts)
 *   - the ScratchCard overlay (shown when phase = 'scratching' in the route)
 *   - navigation after the reveal
 *
 * This component is purely presentational/animated.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, ChevronDown } from "lucide-react";
import { ShuffleCard } from "@/components/ShuffleCard";
import type { CardState } from "@/components/ShuffleCard";
import type { Prize } from "@/lib/spin-store";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeckPhase =
  | "preview"    // face-up, start button
  | "flipping"   // animating to face-down
  | "shuffling"  // cards moving around
  | "choosing"   // pick a card
  | "chosen"     // card selected, pausing
  | "revealing"; // post-scratch reveal

interface ShuffleChooseDeckProps {
  prizes: Prize[];
  phase: DeckPhase;
  /** Index into prizes[] for the selected card (set by parent after pick) */
  selectedPrizeIdx: number | null;
  /** Prize to show at selected position during reveal (the actual backend result) */
  resolvedPrize: Prize | null;
  /** Called after flip animation finishes — parent advances to 'shuffling' */
  onFlipComplete: () => void;
  /** Called after shuffle animation finishes — parent advances to 'choosing' */
  onShuffleComplete: () => void;
  /** Called when user taps a card during 'choosing' phase */
  onCardPick: (prizeIdx: number) => void;
  /** START SHUFFLE pressed */
  onStartShuffle: () => void;
  /** True when the START SHUFFLE button should show a loading spinner */
  shuffleLoading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (returns a new array) */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Columns count for a given card total */
function gridCols(n: number): string {
  if (n <= 3) return "grid-cols-3";
  if (n === 4) return "grid-cols-2 sm:grid-cols-4";
  return "grid-cols-2 sm:grid-cols-3";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShuffleChooseDeck({
  prizes,
  phase,
  selectedPrizeIdx,
  resolvedPrize,
  onFlipComplete,
  onShuffleComplete,
  onCardPick,
  onStartShuffle,
  shuffleLoading = false,
}: ShuffleChooseDeckProps) {
  // cardOrder[displayPosition] = prizeIndex
  const [cardOrder, setCardOrder] = useState<number[]>(() => prizes.map((_, i) => i));
  // Small random rotations applied during shuffle for natural feel
  const [cardRotations, setCardRotations] = useState<number[]>(() => prizes.map(() => 0));
  // Which display positions have flipped face-up during the reveal phase
  const [revealedPositions, setRevealedPositions] = useState<Set<number>>(new Set());

  const shuffleCountRef = useRef(0);
  const shuffleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset card order when prizes change ──────────────────────────────────
  useEffect(() => {
    setCardOrder(prizes.map((_, i) => i));
    setCardRotations(prizes.map(() => 0));
    setRevealedPositions(new Set());
    shuffleCountRef.current = 0;
  }, [prizes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flip complete → signal parent after delay ────────────────────────────
  useEffect(() => {
    if (phase !== "flipping") return;
    // Allow time for the staggered flip animations to finish (last card ~0.8 s)
    const flipDelay = 200 + prizes.length * 90 + 600;
    const t = setTimeout(onFlipComplete, flipDelay);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shuffle loop ─────────────────────────────────────────────────────────
  const doShuffle = useCallback(() => {
    const TOTAL_SHUFFLES = 9 + Math.floor(Math.random() * 4); // 9–12
    const INTERVAL_MS    = 380;

    function step() {
      if (shuffleCountRef.current >= TOTAL_SHUFFLES) {
        // Settle rotations back to zero before choosing phase
        setCardRotations((r) => r.map(() => 0));
        onShuffleComplete();
        return;
      }
      shuffleCountRef.current += 1;
      setCardOrder((prev) => shuffleArray(prev));
      setCardRotations((prev) => prev.map(() => (Math.random() - 0.5) * 10));
      shuffleTimerRef.current = setTimeout(step, INTERVAL_MS);
    }
    shuffleCountRef.current = 0;
    step();
  }, [onShuffleComplete]);

  useEffect(() => {
    if (phase !== "shuffling") return;
    doShuffle();
    return () => {
      if (shuffleTimerRef.current) clearTimeout(shuffleTimerRef.current);
    };
  }, [phase, doShuffle]);

  // ── Sequential reveal after scratch ─────────────────────────────────────
  useEffect(() => {
    if (phase !== "revealing") return;
    setRevealedPositions(new Set()); // reset

    // Find the display position of the selected card
    const selectedDisplayPos = selectedPrizeIdx !== null
      ? cardOrder.indexOf(selectedPrizeIdx)
      : -1;

    // Positions to reveal in order (skip the selected card — already scratched)
    const positions = cardOrder
      .map((_, pos) => pos)
      .filter((pos) => pos !== selectedDisplayPos);

    let idx = 0;
    function revealNext() {
      if (idx >= positions.length) return;
      const pos = positions[idx++];
      setRevealedPositions((prev) => new Set([...prev, pos]));
      revealTimerRef.current = setTimeout(revealNext, 280);
    }
    // Start after a brief pause (let scratch overlay fade first)
    revealTimerRef.current = setTimeout(revealNext, 350);

    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Card state resolver ─────────────────────────────────────────────────

  const cardState = useCallback(
    (prizeIdx: number, displayPos: number): CardState => {
      const selectedDisplayPos =
        selectedPrizeIdx !== null ? cardOrder.indexOf(selectedPrizeIdx) : -1;

      if (phase === "preview" || phase === "revealing") {
        if (phase === "revealing") {
          // Reveal phase: selected card face-up (resolved prize shown in route overlay)
          // Other cards face-up sequentially
          if (displayPos === selectedDisplayPos) return "revealed";
          if (revealedPositions.has(displayPos)) return "revealed";
          return "face-down";
        }
        return "face-up";
      }

      if (phase === "flipping" || phase === "shuffling") return "face-down";

      if (phase === "choosing") return "choosing";

      if (phase === "chosen") {
        if (prizeIdx === selectedPrizeIdx) return "selected";
        return "disabled";
      }

      return "face-down";
    },
    [phase, selectedPrizeIdx, cardOrder, revealedPositions],
  );

  // ─── Prize to show per display position ─────────────────────────────────

  const prizeAt = useCallback(
    (displayPos: number): Prize => {
      const prizeIdx = cardOrder[displayPos];
      // During reveal: show resolved prize at the selected position
      if (
        phase === "revealing" &&
        resolvedPrize &&
        prizeIdx === selectedPrizeIdx
      ) {
        return resolvedPrize;
      }
      return prizes[prizeIdx];
    },
    [cardOrder, prizes, phase, resolvedPrize, selectedPrizeIdx],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  const isShuffleActive = phase === "shuffling" || phase === "flipping";
  const showStartBtn    = phase === "preview";
  const showChooseHint  = phase === "choosing";
  const showChosenHint  = phase === "chosen";
  const showRevealHint  = phase === "revealing";

  return (
    <div className="flex flex-col items-center gap-5 w-full">

      {/* ── Card grid ──────────────────────────────────────────────────────── */}
      <div className={`grid ${gridCols(prizes.length)} gap-3 w-full`}>
        {cardOrder.map((prizeIdx, displayPos) => (
          <ShuffleCard
            key={prizes[prizeIdx].id}
            prize={prizeAt(displayPos)}
            state={cardState(prizeIdx, displayPos)}
            rotation={isShuffleActive ? cardRotations[displayPos] : 0}
            onClick={
              phase === "choosing"
                ? () => onCardPick(prizeIdx)
                : undefined
            }
          />
        ))}
      </div>

      {/* ── Status / prompt area ───────────────────────────────────────────── */}
      <div className="min-h-[4rem] flex flex-col items-center justify-center gap-2">
        <AnimatePresence mode="wait">

          {/* Preview: START SHUFFLE button */}
          {showStartBtn && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-2"
            >
              <button
                onClick={onStartShuffle}
                disabled={shuffleLoading}
                className="flex items-center gap-2.5 px-8 py-4 rounded-2xl gradient-primary text-[#0F1115] font-black text-base tracking-widest transition-all duration-150 hover:brightness-110 hover:shadow-xl hover:shadow-orange-500/30 active:scale-[0.96] disabled:opacity-70 disabled:pointer-events-none min-w-[200px] justify-center"
              >
                {shuffleLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-[#0F1115]/30 border-t-[#0F1115] animate-spin" />
                    PREPARING…
                  </>
                ) : (
                  <>
                    <Shuffle className="w-4 h-4" strokeWidth={2.5} />
                    START SHUFFLE
                  </>
                )}
              </button>
              <p className="text-xs text-muted-foreground text-center">
                See all available prizes above
              </p>
            </motion.div>
          )}

          {/* Flipping / shuffling: status text */}
          {isShuffleActive && (
            <motion.p
              key="shuffling"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-sm font-bold text-muted-foreground tracking-widest animate-pulse uppercase"
            >
              Shuffling…
            </motion.p>
          )}

          {/* Choosing: prompt */}
          {showChooseHint && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
              className="flex flex-col items-center gap-1"
            >
              <p className="text-lg font-black text-[#0c2340] tracking-wide">Choose ONE card</p>
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronDown className="w-5 h-5 text-[#FF6B1A]" strokeWidth={2.5} />
              </motion.div>
            </motion.div>
          )}

          {/* Chosen: scratch hint */}
          {showChosenHint && (
            <motion.p
              key="chosen"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-sm font-semibold text-[#4a5b78] text-center animate-pulse"
            >
              Getting your card ready…
            </motion.p>
          )}

          {/* Revealing: hint */}
          {showRevealHint && (
            <motion.p
              key="reveal"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-sm font-semibold text-[#4a5b78] text-center"
            >
              Revealing remaining cards…
            </motion.p>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * ShuffleChooseDeck — manages the full Shuffle & Choose card game.
 *
 * Premium edition:
 *   - Organic shuffle: every card moves independently with its own speed,
 *     path offset, and rotation. Cards cross over each other naturally.
 *   - Real 3-D flip via ShuffleCard (preserve-3d / rotateY).
 *   - Win celebration: confetti burst + deck shake + winning-card pulse.
 *   - Try Again: soft fade-in, "Better luck next time" message.
 *   - Micro-interactions: START SHUFFLE lifts 2 px on hover, depresses on tap.
 *   - Haptics & sounds at every key moment.
 *   - Fully respects prefers-reduced-motion.
 */

import {
  useEffect, useRef, useState, useCallback,
  useMemo, useLayoutEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, ChevronDown, Smile } from "lucide-react";
import { ShuffleCard } from "@/components/ShuffleCard";
import type { CardState } from "@/components/ShuffleCard";
import type { Prize } from "@/lib/spin-store";
import { playCardShuffle, playCardPick, playWin, playLose } from "@/lib/sounds";
import { haptic } from "@/lib/haptics";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeckPhase =
  | "preview"    // face-up, start button
  | "flipping"   // animating to face-down
  | "shuffling"  // cards moving around
  | "choosing"   // pick a card
  | "chosen"     // card selected, pausing
  | "revealing"; // post-scratch reveal

interface CardOffset {
  x: number;
  y: number;
  duration: number;
  delay: number;
  zIndex: number;
}

interface ShuffleChooseDeckProps {
  prizes: Prize[];
  phase: DeckPhase;
  selectedPrizeIdx: number | null;
  resolvedPrize: Prize | null;
  onFlipComplete: () => void;
  onShuffleComplete: () => void;
  onCardPick: (prizeIdx: number) => void;
  onStartShuffle: () => void;
  shuffleLoading?: boolean;
  /** Set after scratchComplete — drives win/lose celebration */
  isWin?: boolean | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function gridCols(n: number): string {
  if (n <= 3) return "grid-cols-3";
  if (n === 4) return "grid-cols-2 sm:grid-cols-4";
  return "grid-cols-2 sm:grid-cols-3";
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// ─── Reduced-motion hook ─────────────────────────────────────────────────────

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// ─── Confetti particles ───────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  "#FF6B1A", "#FFB347", "#FFFFFF", "#0c2340",
  "#FFA07A", "#FF8C42", "#FFD700", "#C8D8F0",
];

interface ConfettiParticle {
  id: number;
  x: number;          // % from left of container
  color: string;
  width: number;      // px
  height: number;     // px
  duration: number;   // seconds
  delay: number;      // seconds
  initialRotate: number;
}

function buildConfetti(n: number): ConfettiParticle[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    x: rand(5, 95),
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    width: rand(5, 11),
    height: rand(9, 18),
    duration: rand(1.1, 2.0),
    delay: rand(0, 0.35),
    initialRotate: rand(-60, 60),
  }));
}

function ConfettiBurst({ active }: { active: boolean }) {
  const [particles] = useState<ConfettiParticle[]>(() => buildConfetti(28));
  if (!active) return null;
  return (
    <div className="absolute inset-x-0 top-0 overflow-visible pointer-events-none" style={{ height: 0 }}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti rounded-sm"
          style={{
            left: `${p.x}%`,
            top: 0,
            width: p.width,
            height: p.height,
            background: p.color,
            transform: `rotate(${p.initialRotate}deg)`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
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
  isWin = null,
}: ShuffleChooseDeckProps) {
  const reducedMotion = useReducedMotion();

  // cardOrder[displayPosition] = prizeIndex
  const [cardOrder, setCardOrder] = useState<number[]>(() => prizes.map((_, i) => i));
  // Per-prize-index position offsets during shuffle (indexed by prizeIdx)
  const [cardOffsets, setCardOffsets] = useState<CardOffset[]>(() =>
    prizes.map(() => ({ x: 0, y: 0, duration: 0.32, delay: 0, zIndex: 0 })),
  );
  // Small random rotations per card during shuffle
  const [cardRotations, setCardRotations] = useState<number[]>(() => prizes.map(() => 0));
  // Which display positions have flipped face-up during the reveal phase
  const [revealedPositions, setRevealedPositions] = useState<Set<number>>(new Set());
  // Win celebration state
  const [showConfetti, setShowConfetti] = useState(false);
  const [deckShake, setDeckShake] = useState(false);
  // Which prizeIdx is the winning card (for win-card-pulse CSS class)
  const [winPrizeIdx, setWinPrizeIdx] = useState<number | null>(null);
  // Step counter for periodic shuffle sounds
  const shuffleSoundStepRef = useRef(0);

  const shuffleCountRef = useRef(0);
  const shuffleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset when prizes change ─────────────────────────────────────────────
  useEffect(() => {
    setCardOrder(prizes.map((_, i) => i));
    setCardOffsets(prizes.map(() => ({ x: 0, y: 0, duration: 0.32, delay: 0, zIndex: 0 })));
    setCardRotations(prizes.map(() => 0));
    setRevealedPositions(new Set());
    shuffleCountRef.current = 0;
    shuffleSoundStepRef.current = 0;
    setShowConfetti(false);
    setDeckShake(false);
    setWinPrizeIdx(null);
  }, [prizes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flip complete ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "flipping") return;
    const flipDelay = 200 + prizes.length * 90 + 600;
    const t = setTimeout(onFlipComplete, flipDelay);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shuffle loop — organic independent paths ─────────────────────────────
  const doShuffle = useCallback(() => {
    const TOTAL_SHUFFLES = 10 + Math.floor(Math.random() * 4); // 10–13 steps

    function step() {
      if (shuffleCountRef.current >= TOTAL_SHUFFLES) {
        // Settle: clear offsets and rotations before choosing
        setCardOffsets((prev) => prev.map(() => ({ x: 0, y: 0, duration: 0.35, delay: 0, zIndex: 0 })));
        setCardRotations((prev) => prev.map(() => 0));
        onShuffleComplete();
        return;
      }
      shuffleCountRef.current += 1;

      // Fisher-Yates swap of display positions
      setCardOrder((prev) => shuffleArray(prev));

      // Each card gets its OWN independent offset and timing (indexed by prizeIdx)
      setCardOffsets((prev) =>
        prev.map(() => ({
          x:        reducedMotion ? 0 : rand(-52, 52),
          y:        reducedMotion ? 0 : rand(-28, 28),
          duration: reducedMotion ? 0.01 : rand(0.22, 0.46),
          delay:    reducedMotion ? 0 : rand(0, 0.10),
          zIndex:   Math.floor(Math.random() * 20),
        })),
      );

      // Rotation per card
      setCardRotations((prev) =>
        prev.map(() => (reducedMotion ? 0 : (Math.random() - 0.5) * 18)),
      );

      // Play shuffle sound every 3 steps
      shuffleSoundStepRef.current += 1;
      if (shuffleSoundStepRef.current % 3 === 0) playCardShuffle();

      // Variable interval keeps it feeling alive
      const interval = reducedMotion ? 60 : rand(300, 460);
      shuffleTimerRef.current = setTimeout(step, interval);
    }

    shuffleCountRef.current = 0;
    shuffleSoundStepRef.current = 0;
    step();
  }, [onShuffleComplete, reducedMotion]);

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
    setRevealedPositions(new Set());

    const selectedDisplayPos =
      selectedPrizeIdx !== null ? cardOrder.indexOf(selectedPrizeIdx) : -1;

    const positions = cardOrder
      .map((_, pos) => pos)
      .filter((pos) => pos !== selectedDisplayPos);

    // Win/lose effects when reveal starts
    if (isWin === true) {
      // Find which prizeIdx is the resolved prize (selected card)
      setWinPrizeIdx(selectedPrizeIdx);
      setTimeout(() => {
        setShowConfetti(true);
        setDeckShake(true);
        playWin();
        haptic("success");
        setTimeout(() => setDeckShake(false), 800);
        setTimeout(() => setShowConfetti(false), 2500);
      }, 250);
    } else if (isWin === false) {
      setTimeout(() => {
        playLose();
        haptic("soft");
      }, 350);
    }

    let idx = 0;
    function revealNext() {
      if (idx >= positions.length) return;
      const pos = positions[idx++];
      setRevealedPositions((prev) => new Set([...prev, pos]));
      revealTimerRef.current = setTimeout(revealNext, 260);
    }
    revealTimerRef.current = setTimeout(revealNext, 380);

    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Card state resolver ─────────────────────────────────────────────────

  const cardState = useCallback(
    (prizeIdx: number, displayPos: number): CardState => {
      const selectedDisplayPos =
        selectedPrizeIdx !== null ? cardOrder.indexOf(selectedPrizeIdx) : -1;

      if (phase === "preview") return "face-up";

      if (phase === "revealing") {
        if (displayPos === selectedDisplayPos) return "revealed";
        if (revealedPositions.has(displayPos)) return "revealed";
        return "face-down";
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

  // ─── Prize to display ────────────────────────────────────────────────────

  const prizeAt = useCallback(
    (displayPos: number): Prize => {
      const prizeIdx = cardOrder[displayPos];
      if (phase === "revealing" && resolvedPrize && prizeIdx === selectedPrizeIdx) {
        return resolvedPrize;
      }
      return prizes[prizeIdx];
    },
    [cardOrder, prizes, phase, resolvedPrize, selectedPrizeIdx],
  );

  // ─── Memoized card list ──────────────────────────────────────────────────

  const isShuffleActive = phase === "shuffling" || phase === "flipping";
  const showStartBtn    = phase === "preview";
  const showChooseHint  = phase === "choosing";
  const showChosenHint  = phase === "chosen";
  const showRevealHint  = phase === "revealing";

  const cards = useMemo(
    () =>
      cardOrder.map((prizeIdx, displayPos) => {
        const offset  = cardOffsets[prizeIdx] ?? { x: 0, y: 0, duration: 0.32, delay: 0, zIndex: 0 };
        const cState  = cardState(prizeIdx, displayPos);
        const prize   = prizeAt(displayPos);
        const isWinCard = winPrizeIdx === prizeIdx && phase === "revealing";

        return (
          <motion.div
            key={prizes[prizeIdx].id}
            layout
            layoutId={`card-${prizes[prizeIdx].id}`}
            className={`relative${isWinCard ? " animate-win-card-pulse" : ""}`}
            animate={
              isShuffleActive
                ? {
                    x:      offset.x,
                    y:      offset.y,
                    zIndex: offset.zIndex,
                  }
                : { x: 0, y: 0, zIndex: 0 }
            }
            transition={
              isShuffleActive
                ? {
                    layout: {
                      duration: offset.duration,
                      delay:    offset.delay,
                      ease:     "easeInOut",
                    },
                    x: { duration: offset.duration, delay: offset.delay, ease: "easeInOut" },
                    y: { duration: offset.duration, delay: offset.delay, ease: "easeInOut" },
                  }
                : {
                    layout: { duration: 0.3, ease: "easeOut" },
                    x: { duration: 0.3 },
                    y: { duration: 0.3 },
                  }
            }
            style={{ willChange: "transform" }}
          >
            <ShuffleCard
              prize={prize}
              state={cState}
              rotation={isShuffleActive ? cardRotations[prizeIdx] ?? 0 : 0}
              reducedMotion={reducedMotion}
              onClick={
                phase === "choosing"
                  ? () => {
                      playCardPick();
                      haptic("medium");
                      onCardPick(prizeIdx);
                    }
                  : undefined
              }
            />
          </motion.div>
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cardOrder, cardOffsets, cardRotations, phase, selectedPrizeIdx, revealedPositions, winPrizeIdx, reducedMotion],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-5 w-full">

      {/* ── Card grid with confetti overlay ────────────────────────────────── */}
      <div className="relative w-full">
        <ConfettiBurst active={showConfetti && !reducedMotion} />

        <motion.div
          className={`grid ${gridCols(prizes.length)} gap-3 w-full${deckShake && !reducedMotion ? " animate-deck-shake" : ""}`}
        >
          {cards}
        </motion.div>
      </div>

      {/* ── Status / prompt area ───────────────────────────────────────────── */}
      <div className="min-h-[4.5rem] flex flex-col items-center justify-center gap-2">
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
              <motion.button
                onClick={() => {
                  haptic("light");
                  onStartShuffle();
                }}
                disabled={shuffleLoading}
                className="flex items-center gap-2.5 px-8 py-4 rounded-2xl gradient-primary text-[#0F1115] font-black text-base tracking-widest transition-colors duration-150 hover:brightness-110 hover:shadow-xl hover:shadow-orange-500/30 disabled:opacity-70 disabled:pointer-events-none min-w-[200px] justify-center"
                whileHover={reducedMotion ? undefined : { y: -2 }}
                whileTap={reducedMotion ? undefined : { scale: 0.97, y: 0 }}
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
              </motion.button>
              <p className="text-xs text-muted-foreground text-center">
                See all available prizes above
              </p>
            </motion.div>
          )}

          {/* Flipping / shuffling: animated status */}
          {isShuffleActive && (
            <motion.div
              key="shuffling"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-1"
            >
              <motion.p
                className="text-sm font-bold text-muted-foreground tracking-widest uppercase"
                animate={reducedMotion ? {} : { opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              >
                Shuffling…
              </motion.p>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#FF6B1A]"
                    animate={reducedMotion ? {} : { y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{
                      duration: 0.7,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Choosing: "Choose ONE card" with animated chevron */}
          {showChooseHint && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }}
              className="flex flex-col items-center gap-1"
            >
              <p className="text-lg font-black text-[#0c2340] tracking-wide">Choose ONE card</p>
              <motion.div
                animate={reducedMotion ? {} : { y: [0, 5, 0] }}
                transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronDown className="w-5 h-5 text-[#FF6B1A]" strokeWidth={2.5} />
              </motion.div>
            </motion.div>
          )}

          {/* Chosen: getting card ready */}
          {showChosenHint && (
            <motion.div
              key="chosen"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2"
            >
              <motion.div
                className="w-3.5 h-3.5 rounded-full border-2 border-[#FF6B1A]/40 border-t-[#FF6B1A] animate-spin"
              />
              <p className="text-sm font-semibold text-[#4a5b78]">Getting your card ready…</p>
            </motion.div>
          )}

          {/* Revealing: win or lose message */}
          {showRevealHint && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-1 text-center"
            >
              {isWin === true && (
                <motion.p
                  className="text-base font-black text-[#FF6B1A] tracking-wide"
                  animate={reducedMotion ? {} : { scale: [1, 1.06, 1] }}
                  transition={{ duration: 0.6, repeat: 2 }}
                >
                  You won! 🎉
                </motion.p>
              )}
              {isWin === false && (
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <Smile className="w-4 h-4 text-[#4a5b78]" strokeWidth={1.75} />
                    <p className="text-sm font-bold text-[#4a5b78]">Better luck next time!</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Revealing remaining cards…</p>
                </div>
              )}
              {isWin === null && (
                <p className="text-sm font-semibold text-[#4a5b78]">Revealing remaining cards…</p>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

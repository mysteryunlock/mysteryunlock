/**
 * ShuffleChooseDeck — Casino Shuffle edition.
 *
 * The shuffle runs as three distinct sub-phases inside the parent "shuffling" phase:
 *
 *   GATHER  (500–660 ms)
 *     All cards converge toward the deck center with staggered timing,
 *     random rotation (±12°), and slight scale variation. Cards overlap.
 *
 *   MIX  (8–12 cycles × 260–380 ms = ~2.5–4 s)
 *     Every card moves independently: random ±115 px x, ±75 px y,
 *     ±18° rotation, 0.91–1.09 scale, dynamic z-index, subtle blur.
 *     Fisher-Yates position swap happens on every cycle.
 *     No two cards share the same timing — tracking is impossible.
 *
 *   DEAL  (staggered, ~65 ms per card)
 *     Cards fly back to their new grid positions with a spring bounce.
 *     Top-left card lands first; bottom-right last.
 *     "Choose ONE card" prompt appears only after the last card settles.
 *
 * Everything else (flip, reveal, win/lose celebration, haptics) is unchanged.
 * Fully respects prefers-reduced-motion — sub-phases are skipped, only
 * an instant position randomise occurs.
 */

import {
  useEffect, useRef, useState, useCallback,
  useMemo, useLayoutEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, ChevronDown, Smile } from "lucide-react";
import { ShuffleCard } from "@/components/ShuffleCard";
import type { CardState, CardBackConfig } from "@/components/ShuffleCard";
import type { Prize } from "@/lib/spin-store";
import {
  playCardGather, playCardShuffle, playCardRiffle,
  playCardDeal, playCardPick,
} from "@/lib/sounds";
import { haptic } from "@/lib/haptics";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeckPhase =
  | "preview"
  | "flipping"
  | "shuffling"
  | "choosing"
  | "chosen"
  | "revealing";

/** Internal casino-shuffle sub-phases (invisible to parent route). */
type ShuffleSubPhase = "idle" | "gathering" | "mixing" | "dealing";

/** Full per-card transform applied by the wrapper motion.div during shuffle. */
interface CardTransform {
  x:        number;
  y:        number;
  rotate:   number;
  scale:    number;
  duration: number;   // seconds
  delay:    number;   // seconds
  zIndex:   number;
  blur:     number;   // px
}

interface ShuffleChooseDeckProps {
  prizes:           Prize[];
  phase:            DeckPhase;
  selectedPrizeIdx: number | null;
  resolvedPrize:    Prize | null;
  onFlipComplete:   () => void;
  onShuffleComplete: () => void;
  onCardPick:       (prizeIdx: number) => void;
  onStartShuffle:   () => void;
  shuffleLoading?:  boolean;
  isWin?:           boolean | null;
  /** Shop-owner's card back style — passed through to every ShuffleCard */
  cardBack?:        CardBackConfig;
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

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function gridColsCss(n: number): string {
  if (n <= 3) return "grid-cols-3";
  if (n === 4) return "grid-cols-2 sm:grid-cols-4";
  return "grid-cols-2 sm:grid-cols-3";
}

/** Number of visual columns (mobile-first). */
function getNumCols(n: number): number {
  if (n <= 3) return 3;
  return 2; // mobile default; sm breakpoint shows more but we use this for gather math
}

function identityTransform(): CardTransform {
  return { x: 0, y: 0, rotate: 0, scale: 1, duration: 0.32, delay: 0, zIndex: 0, blur: 0 };
}

// ─── Transform builders ───────────────────────────────────────────────────────

/**
 * GATHER — pull each card toward the deck center.
 * Offset is proportional to distance from center col/row,
 * so edge cards travel further and cards visually compress into a pile.
 */
function computeGatherTransforms(n: number, currentOrder: number[]): CardTransform[] {
  const numCols = getNumCols(n);
  const numRows = Math.ceil(n / numCols);
  const centerCol = (numCols - 1) / 2;
  const centerRow = (numRows - 1) / 2;
  const normX = numCols > 1 ? numCols - 1 : 1;
  const normY = numRows > 1 ? numRows - 1 : 1;
  const MAX_X = 88; // px — horizontal pull distance
  const MAX_Y = 82; // px — vertical pull distance

  return Array.from({ length: n }, (_, prizeIdx) => {
    const displayPos = currentOrder.indexOf(prizeIdx);
    const col = displayPos % numCols;
    const row = Math.floor(displayPos / numCols);

    const pull = rand(0.62, 0.80);
    const x = ((centerCol - col) / normX) * MAX_X * pull + rand(-9, 9);
    const y = ((centerRow - row) / normY) * MAX_Y * pull + rand(-7, 7);

    return {
      x,
      y,
      rotate:   rand(-12, 12),
      scale:    rand(0.96, 1.05),
      duration: rand(0.40, 0.56),
      delay:    displayPos * rand(0.022, 0.052), // stagger: outer cards start later
      zIndex:   n - displayPos,                   // inner cards visually on top
      blur:     0,
    };
  });
}

/**
 * MIX — fully chaotic per-card transforms.
 * Each card gets its own independent x/y/rotate/scale/timing/blur.
 * Combined with Fisher-Yates layout swap, tracking becomes impossible.
 */
function computeMixTransforms(n: number): CardTransform[] {
  return Array.from({ length: n }, () => ({
    x:        rand(-118, 118),
    y:        rand(-78, 78),
    rotate:   rand(-18, 18),
    scale:    rand(0.91, 1.10),
    duration: rand(0.20, 0.37),
    delay:    rand(0, 0.082),
    zIndex:   Math.floor(Math.random() * 30),
    blur:     rand(0.4, 2.4),
  }));
}

/**
 * DEAL — staggered return to grid positions with spring bounce.
 * Top-left card arrives first (delay = 0), bottom-right last.
 */
function computeDealTransforms(n: number, finalOrder: number[]): CardTransform[] {
  return Array.from({ length: n }, (_, prizeIdx) => {
    const displayPos = finalOrder.indexOf(prizeIdx);
    return {
      x:        0,
      y:        0,
      rotate:   0,
      scale:    1,
      duration: rand(0.44, 0.56),
      delay:    displayPos * 0.066, // 66 ms stagger per card position
      zIndex:   0,
      blur:     0,
    };
  });
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

// ─── Confetti ────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  "#FF6B1A", "#FFB347", "#FFFFFF", "#0c2340",
  "#FFA07A", "#FF8C42", "#FFD700", "#C8D8F0",
];

function ConfettiBurst({ active }: { active: boolean }) {
  const [particles] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: rand(5, 95),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      w: rand(5, 11),
      h: rand(9, 18),
      dur: rand(1.1, 2.0),
      delay: rand(0, 0.35),
      rot: rand(-60, 60),
    })),
  );
  if (!active) return null;
  return (
    <div className="absolute inset-x-0 top-0 overflow-visible pointer-events-none" style={{ height: 0 }}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti rounded-sm"
          style={{
            left: `${p.x}%`, top: 0,
            width: p.w, height: p.h,
            background: p.color,
            transform: `rotate(${p.rot}deg)`,
            animationDuration: `${p.dur}s`,
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
  cardBack,
}: ShuffleChooseDeckProps) {
  const reducedMotion = useReducedMotion();
  const n = prizes.length;

  // ── Core card state ──────────────────────────────────────────────────────
  const [cardOrder, setCardOrder] = useState<number[]>(() => prizes.map((_, i) => i));
  const [cardTransforms, setCardTransforms] = useState<CardTransform[]>(() =>
    prizes.map(() => identityTransform()),
  );
  const [shuffleSubPhase, setShuffleSubPhase] = useState<ShuffleSubPhase>("idle");
  const [revealedPositions, setRevealedPositions] = useState<Set<number>>(new Set());

  // ── Suspense phrase cycling (used during "chosen" phase) ─────────────────
  // Phrase 0: shown immediately when card is tapped.
  // Phrase 1: fades in ~900 ms later to build anticipation.
  const SUSPENSE_PHRASES = ["Let's see what you've won…", "Good luck! 🤞"] as const;
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    if (phase !== "chosen") { setPhraseIdx(0); return; }
    const t = setTimeout(() => setPhraseIdx(1), 900);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Celebration state ────────────────────────────────────────────────────
  const [showConfetti, setShowConfetti] = useState(false);
  const [deckShake, setDeckShake]       = useState(false);
  const [winPrizeIdx, setWinPrizeIdx]   = useState<number | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const cardOrderRef   = useRef(cardOrder);
  const shuffleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync so doShuffle can read latest order without stale closures
  useEffect(() => { cardOrderRef.current = cardOrder; }, [cardOrder]);

  // ── Reset when prize list changes ────────────────────────────────────────
  useEffect(() => {
    const order = prizes.map((_, i) => i);
    setCardOrder(order);
    cardOrderRef.current = order;
    setCardTransforms(prizes.map(() => identityTransform()));
    setShuffleSubPhase("idle");
    setRevealedPositions(new Set());
    setShowConfetti(false);
    setDeckShake(false);
    setWinPrizeIdx(null);
  }, [prizes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── FLIP COMPLETE signal ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "flipping") return;
    const delay = 200 + prizes.length * 90 + 600;
    const t = setTimeout(onFlipComplete, delay);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CASINO SHUFFLE ────────────────────────────────────────────────────────
  const doShuffle = useCallback(() => {
    // ── Reduced-motion fast path ──
    if (reducedMotion) {
      setCardOrder((prev) => shuffleArray(prev));
      setCardTransforms(prizes.map(() => identityTransform()));
      setTimeout(onShuffleComplete, 80);
      return;
    }

    // ═══════════════════════════════════════
    //  PHASE 1 — GATHER  (~600 ms)
    // ═══════════════════════════════════════
    haptic("light");
    playCardGather();
    setShuffleSubPhase("gathering");
    setCardTransforms(computeGatherTransforms(n, cardOrderRef.current));

    // After gather settles, start mix
    shuffleTimerRef.current = setTimeout(() => {

      // ═══════════════════════════════════════
      //  PHASE 2 — MIX  (8–12 cycles)
      // ═══════════════════════════════════════
      haptic("medium");
      setShuffleSubPhase("mixing");

      const TOTAL_MIXES = 8 + Math.floor(Math.random() * 5); // 8–12
      let mixCount = 0;

      function mixStep() {
        if (mixCount >= TOTAL_MIXES) {
          // ═══════════════════════════════════════
          //  PHASE 3 — DEAL  (staggered spring)
          // ═══════════════════════════════════════
          haptic("light");
          setShuffleSubPhase("dealing");

          const finalOrder = cardOrderRef.current;
          setCardTransforms(computeDealTransforms(n, finalOrder));

          // Staggered deal taps (one per card, synced to visual stagger)
          playCardDeal(n, 0.066);

          // After last card lands, signal parent
          const lastCardDelay = (n - 1) * 0.066 + 0.56 + 0.20; // duration + buffer
          shuffleTimerRef.current = setTimeout(() => {
            setShuffleSubPhase("idle");
            onShuffleComplete();
          }, lastCardDelay * 1000);
          return;
        }

        mixCount++;

        // Fisher-Yates position swap
        setCardOrder((prev) => {
          const next = shuffleArray(prev);
          cardOrderRef.current = next;
          return next;
        });

        // Every card gets its own chaotic transform
        setCardTransforms(computeMixTransforms(n));

        // Layered sounds — alternating lighter and heavier
        if (mixCount % 3 === 0) playCardRiffle();
        else if (mixCount % 2 === 0) playCardShuffle();

        shuffleTimerRef.current = setTimeout(mixStep, rand(265, 385));
      }

      mixStep();

    }, 660); // gather settle time

  }, [n, reducedMotion, onShuffleComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "shuffling") return;
    doShuffle();
    return () => {
      if (shuffleTimerRef.current) clearTimeout(shuffleTimerRef.current);
    };
  }, [phase, doShuffle]);

  // ── SEQUENTIAL REVEAL ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "revealing") return;
    setRevealedPositions(new Set());

    const selectedDisplayPos =
      selectedPrizeIdx !== null ? cardOrderRef.current.indexOf(selectedPrizeIdx) : -1;

    const positions = cardOrderRef.current
      .map((_, pos) => pos)
      .filter((pos) => pos !== selectedDisplayPos);

    // Win / lose celebration
    // NOTE: playWin / playLose are intentionally NOT called here.
    // ScratchCard.triggerReveal already calls them (220 ms after threshold).
    // Calling them again here would make the sounds play twice.
    if (isWin === true) {
      setWinPrizeIdx(selectedPrizeIdx);
      setTimeout(() => {
        setShowConfetti(true);
        setDeckShake(true);
        haptic("success");
        setTimeout(() => setDeckShake(false), 800);
        setTimeout(() => setShowConfetti(false), 2500);
      }, 250);
    } else if (isWin === false) {
      setTimeout(() => { haptic("soft"); }, 350);
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
        return prizeIdx === selectedPrizeIdx ? "selected" : "disabled";
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

  // ─── Derived flags ────────────────────────────────────────────────────────

  const isCasinoShuffle = shuffleSubPhase !== "idle" || phase === "shuffling";
  const isShuffleActive  = phase === "shuffling" || phase === "flipping";
  const showStartBtn     = phase === "preview";
  const showChooseHint   = phase === "choosing";
  const showChosenHint   = phase === "chosen";
  const showRevealHint   = phase === "revealing";

  // Easing for each sub-phase
  const layoutEase = shuffleSubPhase === "dealing"
    ? [0.34, 1.56, 0.64, 1] as [number,number,number,number] // spring bounce on deal
    : "easeInOut";

  // ─── Memoized cards ──────────────────────────────────────────────────────

  const cards = useMemo(
    () =>
      cardOrder.map((prizeIdx, displayPos) => {
        const tf       = cardTransforms[prizeIdx] ?? identityTransform();
        const cState   = cardState(prizeIdx, displayPos);
        const prize    = prizeAt(displayPos);
        const isWinCard = winPrizeIdx === prizeIdx && phase === "revealing";

        // During casino shuffle sub-phases, the wrapper drives all transforms.
        // During other phases (choosing, chosen, etc.) wrapper is identity.
        const applyTransform = isCasinoShuffle;

        // During the "chosen" suspense phase:
        //   • selected card → elevated z-index (appears above spotlight overlay)
        //   • non-selected cards → subtle blur filter (dimmed by ShuffleCard opacity + blur here)
        const isSelectedCard = prizeIdx === selectedPrizeIdx;
        const inSuspense     = phase === "chosen";
        const suspenseZ      = inSuspense ? (isSelectedCard ? 15 : 0) : 0;
        const suspenseFilter = inSuspense && !isSelectedCard && !reducedMotion
          ? "blur(1.8px)"
          : "blur(0px)";

        return (
          <motion.div
            key={prizes[prizeIdx].id}
            layout
            layoutId={`card-${prizes[prizeIdx].id}`}
            className={`relative${isWinCard ? " animate-win-card-pulse" : ""}`}
            animate={{
              x:      applyTransform ? tf.x : 0,
              y:      applyTransform ? tf.y : 0,
              rotate: applyTransform ? tf.rotate : 0,
              scale:  applyTransform ? tf.scale  : 1,
              zIndex: applyTransform ? tf.zIndex : suspenseZ,
              filter: applyTransform && tf.blur > 0
                ? `blur(${tf.blur.toFixed(1)}px)`
                : suspenseFilter,
            }}
            transition={{
              layout: {
                duration: applyTransform ? tf.duration : 0.3,
                delay:    applyTransform ? tf.delay    : 0,
                ease:     layoutEase,
              },
              x:      { duration: applyTransform ? tf.duration : 0.3, delay: applyTransform ? tf.delay : 0, ease: layoutEase },
              y:      { duration: applyTransform ? tf.duration : 0.3, delay: applyTransform ? tf.delay : 0, ease: layoutEase },
              rotate: { duration: applyTransform ? tf.duration : 0.25, delay: applyTransform ? tf.delay : 0 },
              scale:  { duration: applyTransform ? tf.duration : 0.25, delay: applyTransform ? tf.delay : 0 },
              filter: { duration: inSuspense ? 0.5 : (shuffleSubPhase === "dealing" ? 0.28 : (applyTransform ? tf.duration : 0.15)) },
              zIndex: { duration: 0 }, // instant depth changes
            }}
            style={{ willChange: "transform, filter" }}
          >
            <ShuffleCard
              prize={prize}
              state={cState}
              rotation={0} // wrapper handles all shuffle rotation
              reducedMotion={reducedMotion}
              cardBack={cardBack}
              onClick={
                phase === "choosing"
                  ? () => { playCardPick(); haptic("medium"); onCardPick(prizeIdx); }
                  : undefined
              }
            />
          </motion.div>
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cardOrder, cardTransforms, prizes, phase, shuffleSubPhase, selectedPrizeIdx, revealedPositions, winPrizeIdx, reducedMotion, prizeAt],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-5 w-full">

      {/* ── Card area — overflow:visible so cards extend beyond grid bounds ── */}
      <div className="relative w-full" style={{ overflowX: "visible", overflowY: "visible" }}>
        <ConfettiBurst active={showConfetti && !reducedMotion} />

        {/* ── Spotlight overlay — darkens edges during suspense so selected
              card reads as the visual centre. z-4 sits above non-selected
              cards (z-0) but below the selected card (z-15).             ── */}
        <AnimatePresence>
          {phase === "chosen" && !reducedMotion && (
            <motion.div
              key="spotlight-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute pointer-events-none"
              style={{
                inset: "-20px",
                borderRadius: "24px",
                background:
                  "radial-gradient(ellipse 58% 62% at 50% 44%, transparent 0%, rgba(12,35,64,0.52) 100%)",
                zIndex: 4,
              }}
            />
          )}
        </AnimatePresence>

        <div
          className={`grid ${gridColsCss(prizes.length)} gap-3 w-full${deckShake && !reducedMotion ? " animate-deck-shake" : ""}`}
        >
          {cards}
        </div>
      </div>

      {/* ── Status / prompt area ───────────────────────────────────────────── */}
      <div className="min-h-[4.5rem] flex flex-col items-center justify-center gap-2">
        <AnimatePresence mode="wait">

          {/* Preview: START SHUFFLE */}
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
                onClick={() => { haptic("light"); onStartShuffle(); }}
                disabled={shuffleLoading}
                className="flex items-center gap-2.5 px-8 py-4 rounded-2xl gradient-primary text-[#0F1115] font-black text-base tracking-widest transition-colors duration-150 hover:brightness-110 hover:shadow-xl hover:shadow-orange-500/30 disabled:opacity-70 disabled:pointer-events-none min-w-[200px] justify-center"
                whileHover={reducedMotion ? undefined : { y: -2 }}
                whileTap={reducedMotion  ? undefined : { scale: 0.97, y: 0 }}
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

          {/* Flipping — "Preparing…" */}
          {phase === "flipping" && (
            <motion.p
              key="flipping"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-bold text-muted-foreground tracking-widest uppercase"
            >
              Preparing…
            </motion.p>
          )}

          {/* Shuffling — shows different label per sub-phase */}
          {phase === "shuffling" && shuffleSubPhase !== "idle" && (
            <motion.div
              key={`shuffle-${shuffleSubPhase}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22 }}
              className="flex flex-col items-center gap-1.5"
            >
              <motion.p
                className="text-sm font-bold text-muted-foreground tracking-widest uppercase"
                animate={reducedMotion ? {} : { opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              >
                {shuffleSubPhase === "gathering" && "Gathering…"}
                {shuffleSubPhase === "mixing"    && "Shuffling…"}
                {shuffleSubPhase === "dealing"   && "Dealing…"}
              </motion.p>

              {/* Animated dots — only during mix */}
              {shuffleSubPhase === "mixing" && (
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-[#FF6B1A]"
                      animate={reducedMotion ? {} : { y: [0, -6, 0], opacity: [0.35, 1, 0.35] }}
                      transition={{ duration: 0.65, repeat: Infinity, delay: i * 0.14, ease: "easeInOut" }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Choosing: "Choose ONE card" */}
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

          {/* Chosen: dramatic suspense phrases that cycle */}
          {showChosenHint && (
            <motion.div
              key="chosen"
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
              className="flex flex-col items-center gap-2"
            >
              <AnimatePresence mode="wait">
                {phraseIdx === 0 ? (
                  <motion.div
                    key="phrase-0"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-2.5"
                  >
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-[#FF6B1A]/40 border-t-[#FF6B1A] animate-spin flex-shrink-0" />
                    <p className="text-sm font-bold text-[#0c2340]">{SUSPENSE_PHRASES[0]}</p>
                  </motion.div>
                ) : (
                  <motion.p
                    key="phrase-1"
                    initial={{ opacity: 0, scale: 0.88, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.38, ease: [0.34, 1.56, 0.64, 1] }}
                    className="text-base font-black text-[#FF6B1A] tracking-wide"
                    style={{ willChange: "transform, opacity" }}
                  >
                    {SUSPENSE_PHRASES[1]}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Subtle heartbeat dots */}
              {!reducedMotion && (
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1 h-1 rounded-full bg-[#FF6B1A]/60"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        duration: 1.4,
                        repeat: Infinity,
                        delay: i * 0.22,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Revealing: win or lose */}
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

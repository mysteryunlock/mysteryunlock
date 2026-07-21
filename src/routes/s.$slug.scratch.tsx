/**
 * /s/$slug/scratch — Scratch Card 3.0 "Shuffle & Choose" experience.
 *
 * Flow:
 *   1. Page loads — prizes shown face-up in a grid
 *   2. Customer taps START SHUFFLE → spinAndRecord fires immediately
 *      (prize determined & reserved BEFORE any animation)
 *   3. All cards flip face-down, then shuffle for 3–5 s
 *   4. Customer picks one mystery card
 *   5. ScratchCard overlay reveals the pre-determined prize
 *   6. Remaining cards flip face-up sequentially
 *   7. Navigate to /result (existing claim flow)
 *
 * The shuffle is purely cosmetic. Customer choice never affects the prize.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Search as SearchIcon,
  AlertTriangle,
  RefreshCw,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Btn } from "@/components/ds";
import { motion, AnimatePresence } from "framer-motion";

import { ShuffleChooseDeck } from "@/components/ShuffleChooseDeck";
import type { DeckPhase } from "@/components/ShuffleChooseDeck";
import { cardBackCss } from "@/components/ShuffleCard";
import type { CardBackConfig } from "@/components/ShuffleCard";
import { ScratchCard } from "@/components/ScratchCard";
import type { Prize } from "@/lib/spin-store";
import { usePrizesBySlug } from "@/lib/prizes-hook";
import { spinAndRecord } from "@/lib/access-codes.functions";
import { listPublicCampaigns } from "@/lib/campaigns.functions";
import { playClick, isSoundEnabled, setSoundEnabled } from "@/lib/sounds";
import { haptic } from "@/lib/haptics";
import { trackGameStarted, trackGameCompleted } from "@/lib/analytics";
import { parseServerValidationError } from "@/lib/utils";
import { codeChars, slugSchema } from "@/lib/validation";

// ─── Route ────────────────────────────────────────────────────────────────────

const search = z.object({
  code:    codeChars,
  c:       slugSchema.optional(),
  name:    z.string().min(1).max(40).optional(),
  contact: z.string().min(1).max(30).optional(),
  email:   z.string().min(1).max(255).optional(),
  portal:  z.string().optional(),
});

export const Route = createFileRoute("/s/$slug/scratch")({
  validateSearch: search,
  head: ({ params }) => ({ meta: [{ title: `Scratch — ${params.slug}` }] }),
  component: ScratchPage,
});

// ─── Phase ────────────────────────────────────────────────────────────────────

/**
 * Route-level phase machine:
 *
 *   idle        — prizes loading or waiting for user
 *   flipping    — cards animating to face-down
 *   shuffling   — cards physically moving
 *   choosing    — shuffle stopped; user picks a card
 *   chosen      — card selected; spinAndRecord in-flight (glow shown)
 *   waitingRetry — spinAndRecord failed; card stays selected, retry panel shown
 *   scratching  — ScratchCard overlay visible
 *   revealing   — scratch done; remaining cards flipping up
 *   done        — navigating to result
 */
type RoutePhase =
  | "idle"
  | "flipping"
  | "shuffling"
  | "choosing"
  | "chosen"
  | "waitingRetry"
  | "scratching"
  | "revealing"
  | "done";

const ROUTE_TO_DECK: Record<RoutePhase, DeckPhase | null> = {
  idle:         "preview",
  flipping:     "flipping",
  shuffling:    "shuffling",
  choosing:     "choosing",
  chosen:       "chosen",
  waitingRetry: "chosen",    // card stays glowing, retry panel overlays
  scratching:   "chosen",    // deck frozen while scratch overlay shown
  revealing:    "revealing",
  done:         "revealing",
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────
// Mirrors the real card back style so the transition from loading → cards
// feels seamless. When no cardBack is provided falls back to the metallic look.

function LoadingSkeleton({ n = 6, cardBack }: { n?: number; cardBack?: CardBackConfig }) {
  const bg = cardBackCss(cardBack);
  // Derive a contrasting sparkle colour: light on dark, dark on light.
  // Simple heuristic: if no custom colour or metallic, use white; otherwise orange.
  const sparkleColor =
    !cardBack || cardBack.style === "metallic"
      ? "rgba(255,255,255,0.65)"
      : "rgba(255,107,26,0.70)";
  const dotColor =
    !cardBack || cardBack.style === "metallic"
      ? "rgba(255,255,255,0.55)"
      : "rgba(255,107,26,0.55)";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
      {Array.from({ length: n }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.88, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.38, ease: "easeOut" }}
          className="aspect-square rounded-2xl overflow-hidden relative"
          style={{ background: bg }}
        >
          {/* Shimmer sweep */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-y-0 w-2/3 animate-skeleton-shimmer bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
          </div>

          {/* Horizontal sheen lines (match real MysteryFace) */}
          {Array.from({ length: 8 }).map((_, j) => (
            <div
              key={j}
              className="absolute inset-x-0 h-px pointer-events-none"
              style={{ top: `${(j + 1) * 12}%`, background: "rgba(255,255,255,0.10)" }}
            />
          ))}

          {/* Subtle inner rim */}
          <div
            className="absolute inset-0 rounded-2xl"
            style={{ boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.12)" }}
          />

          {/* Pulsing sparkle icon (matches real card Sparkles icon) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.85, 0.4] }}
              transition={{ repeat: Infinity, duration: 2.2, delay: i * 0.18, ease: "easeInOut" }}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              {/* SVG sparkle star (avoids importing lucide here) */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={sparkleColor} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                <path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/>
              </svg>
            </motion.div>
          </div>

          {/* Offset sparkle dots */}
          <motion.div
            animate={{ opacity: [0, 1, 0], scale: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 2.6, delay: i * 0.22 + 0.4, ease: "easeInOut" }}
            className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full"
            style={{ background: dotColor }}
          />
          <motion.div
            animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2.6, delay: i * 0.22 + 1.5, ease: "easeInOut" }}
            className="absolute bottom-2.5 left-2.5 w-1 h-1 rounded-full"
            style={{ background: dotColor }}
          />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Mute toggle ─────────────────────────────────────────────────────────────

function MuteToggle() {
  // Initialise from localStorage so the preference persists across page loads.
  // The useState lazy-initializer is safe here (sync read, no side-effects).
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("sc_muted");
      if (stored !== null) return stored === "true";
    } catch {}
    return !isSoundEnabled();
  });

  // Sync the sound engine with the persisted preference on first mount.
  useEffect(() => { setSoundEnabled(!muted); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(() => {
    const next = !muted;
    setMuted(next);
    setSoundEnabled(!next);
    try {
      localStorage.setItem("sc_muted", String(next));
    } catch {}
  }, [muted]);

  return (
    <motion.button
      onClick={toggle}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      className="flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors duration-150"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.93 }}
      title={muted ? "Unmute" : "Mute"}
    >
      {muted
        ? <VolumeX className="w-4 h-4" strokeWidth={2} />
        : <Volume2 className="w-4 h-4" strokeWidth={2} />
      }
    </motion.button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ScratchPage() {
  const { slug } = Route.useParams();
  const { code, c: campaignSlug, name, contact, email, portal } = Route.useSearch();
  const navigate = useNavigate();

  const { prizes, isLoading, campaignNotFound } = usePrizesBySlug(slug, campaignSlug);

  // Keep campaign data warm and read card-back theme from it.
  const fetchCampaigns = useServerFn(listPublicCampaigns);
  const { data: campaignList } = useQuery({
    queryKey:           ["public-campaigns", slug],
    queryFn:            async () => ((await fetchCampaigns({ data: { slug } })) as { campaigns: unknown[] }).campaigns,
    staleTime:          5 * 60_000,
    gcTime:             10 * 60_000,
    refetchOnMount:     false,
    refetchOnWindowFocus: false,
  });

  // Resolve the active campaign and extract card back theme.
  const campaigns = (campaignList as any[] | undefined) ?? [];
  const activeCampaign = campaignSlug
    ? campaigns.find((c: any) => c.slug === campaignSlug)
    : (campaigns.find((c: any) => c.is_default) ?? campaigns[0]);
  const scratchTheme: any = activeCampaign?.theme ?? {};
  const cardBack: CardBackConfig = {
    style:  scratchTheme.card_back_style ?? "metallic",
    color:  scratchTheme.card_back_color,
    color2: scratchTheme.card_back_color2,
  };

  const doSpin = useServerFn(spinAndRecord);

  // ── Suspense timing ───────────────────────────────────────────────────────
  // Records the moment the customer picks a card so we can guarantee at least
  // MIN_SUSPENSE_MS of the "chosen" visual state before the scratch overlay
  // appears. Purely cosmetic — spinAndRecord has already resolved by then.
  const suspenseStartRef = useRef<number>(0);
  const MIN_SUSPENSE_MS  = 700;

  // ── Route state ──────────────────────────────────────────────────────────
  const [phase, setPhase]                           = useState<RoutePhase>("idle");
  const [resolvedPrize, setResolvedPrize]           = useState<Prize | null>(null);
  const [selectedPrizeIdx, setSelectedPrizeIdx]     = useState<number | null>(null);
  const [error, setError]                           = useState("");
  // isWin is null until scratch completes, then true/false — drives celebration
  const [isWin, setIsWin]                           = useState<boolean | null>(null);

  // ── START SHUFFLE ────────────────────────────────────────────────────────

  const handleStartShuffle = useCallback(() => {
    if (phase !== "idle" || prizes.length === 0) return;
    playClick();
    haptic("light");
    setError("");
    trackGameStarted("scratch", slug, code);
    setPhase("flipping");
  }, [phase, prizes.length, slug, code]);

  // ── Deck callbacks ───────────────────────────────────────────────────────

  const handleFlipComplete    = useCallback(() => setPhase("shuffling"),  []);
  const handleShuffleComplete = useCallback(() => setPhase("choosing"),   []);

  /**
   * Shared spin logic — called by handleCardPick and handleRetry.
   * spinAndRecord fires AFTER the customer picks a card, not before.
   * The card choice is only a UI trigger; it has no effect on prize selection.
   *
   * On any failure: moves to "waitingRetry" so the selected card stays locked
   * and the customer can retry or cancel without reshuffling.
   */
  const attemptSpin = useCallback(async (): Promise<boolean> => {
    try {
      const res = await doSpin({
        data: {
          slug,
          code,
          ...(campaignSlug ? { campaignSlug } : {}),
          ...(name?.trim()    ? { name:    name.trim()    } : {}),
          ...(contact?.trim() ? { contact: contact.trim() } : {}),
          ...(email?.trim()   ? { email:   email.trim()   } : {}),
        },
      }) as { ok: boolean; prize: { id: string } };

      if (!res.ok) {
        setError("This code is invalid or has already been used.");
        setPhase("waitingRetry");
        return false;
      }

      const matched = prizes.find((p) => p.id === res.prize.id);
      if (!matched) {
        setError("Could not load prize data. Please refresh and try again.");
        setPhase("waitingRetry");
        return false;
      }

      // ── Suspense pause ────────────────────────────────────────────────────
      // Ensure at least MIN_SUSPENSE_MS of the "chosen" moment before the
      // scratch overlay appears. The prize is already determined; this is
      // purely a visual beat. Only applies on first pick, not retries.
      if (suspenseStartRef.current > 0) {
        const elapsed = Date.now() - suspenseStartRef.current;
        if (elapsed < MIN_SUSPENSE_MS) {
          await new Promise<void>((r) => setTimeout(r, MIN_SUSPENSE_MS - elapsed));
        }
      }

      // Prize reserved — open the scratch overlay.
      setResolvedPrize(matched);
      setPhase("scratching");
      return true;
    } catch (err) {
      setError(
        parseServerValidationError(err) ??
        "Couldn't reach the server. Your selected card is waiting.",
      );
      setPhase("waitingRetry");
      return false;
    }
  }, [prizes, slug, code, campaignSlug, name, contact, email, doSpin]);

  const handleCardPick = useCallback(async (prizeIdx: number) => {
    if (phase !== "choosing") return;
    setError("");
    setSelectedPrizeIdx(prizeIdx);
    suspenseStartRef.current = Date.now(); // start the suspense clock
    setPhase("chosen"); // card glows while we await the backend
    await attemptSpin();
  }, [phase, attemptSpin]);

  /** Retry after a waitingRetry failure — same card, same code, no reshuffle. */
  const handleRetry = useCallback(async () => {
    if (phase !== "waitingRetry") return;
    setError("");
    suspenseStartRef.current = 0; // no extra suspense delay on retry
    setPhase("chosen");
    await attemptSpin();
  }, [phase, attemptSpin]);

  /**
   * Cancel after failure — clears the selected card and returns to the
   * "choosing" phase so every card is tappable again. No reshuffle.
   */
  const handleCancelRetry = useCallback(() => {
    setSelectedPrizeIdx(null);
    setError("");
    setPhase("choosing");
  }, []);

  // ── ScratchCard complete → celebration, reveal remaining, navigate ────────

  const handleScratchComplete = useCallback((prize: Prize) => {
    trackGameCompleted("scratch", slug, code, prize.isWin);
    setIsWin(prize.isWin ?? false);
    setPhase("revealing");

    const revealDuration = prizes.length * 300 + 900;
    setTimeout(() => {
      setPhase("done");
      navigate({
        to:     "/s/$slug/result",
        params: { slug },
        search: {
          code,
          pid: prize.id,
          ...(campaignSlug ? { c:       campaignSlug } : {}),
          ...(contact      ? { contact               } : {}),
          ...(name         ? { name                  } : {}),
          ...(portal       ? { portal                } : {}),
        },
      });
    }, revealDuration);
  }, [slug, code, campaignSlug, contact, name, portal, prizes.length, navigate]);

  // ── Derived deck phase ───────────────────────────────────────────────────

  const deckPhase: DeckPhase = ROUTE_TO_DECK[phase] ?? "preview";

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col items-center px-4 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      style={{ minHeight: "100dvh" }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="w-full flex items-center justify-between mb-3">
        <button
          onClick={() => {
            playClick();
            navigate({
              to:     "/s/$slug",
              params: { slug },
              search: campaignSlug ? { c: campaignSlug } : {},
            });
          }}
          disabled={phase !== "idle" && phase !== "waitingRetry"}
          className="flex items-center gap-1 text-sm text-muted-foreground px-2 py-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/5 active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Back"
        >
          ← Back
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF6B1A]/10 border border-[#FF6B1A]/25">
          <span className="text-xs font-bold text-[#FF6B1A] tracking-wide uppercase">Shuffle &amp; Choose</span>
        </div>

        <MuteToggle />
      </div>

      {/* ── Code / name subtitle ──────────────────────────────────────────── */}
      <p className="text-center text-muted-foreground text-sm mb-5">
        {name ? <><span className="text-foreground font-semibold">{name}</span> · </> : null}
        Code <span className="text-foreground font-mono font-semibold tracking-widest">{code}</span>
      </p>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="w-full max-w-[520px]">
        {/* Campaign not found */}
        {campaignNotFound && (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-16 px-6">
            <SearchIcon className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
            <p className="font-bold text-foreground">Campaign not found</p>
            <p className="text-sm text-muted-foreground">
              The campaign link you used is no longer active or doesn&apos;t exist.{" "}
              <button
                onClick={() => navigate({ to: "/s/$slug", params: { slug }, search: {} })}
                className="underline text-foreground"
              >
                Try the main shop page
              </button>
            </p>
          </div>
        )}

        {/* Loading */}
        {!campaignNotFound && isLoading && <LoadingSkeleton cardBack={cardBack} />}

        {/* Validation: need at least 3 prizes for this game */}
        {!campaignNotFound && !isLoading && prizes.length > 0 && prizes.length < 3 && (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-16 px-6">
            <p className="font-bold text-foreground">Not enough cards configured</p>
            <p className="text-sm text-muted-foreground">
              This campaign needs at least 3 prize cards. Please contact the merchant.
            </p>
          </div>
        )}

        {/* Main game: shuffle deck */}
        {!campaignNotFound && !isLoading && prizes.length >= 3 && (
          <ShuffleChooseDeck
            prizes={prizes}
            phase={deckPhase}
            selectedPrizeIdx={selectedPrizeIdx}
            resolvedPrize={resolvedPrize}
            onFlipComplete={handleFlipComplete}
            onShuffleComplete={handleShuffleComplete}
            onCardPick={handleCardPick}
            onStartShuffle={handleStartShuffle}
            isWin={isWin}
            cardBack={cardBack}
          />
        )}

        {/* ── Retry panel ────────────────────────────────────────────────────
            Shown only when spinAndRecord failed after card selection.
            The selected card stays glowing in the deck above.
            Retry re-calls the same request; Cancel returns to "choosing".
        ─────────────────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {phase === "waitingRetry" && (
            <motion.div
              key="retry-panel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
              className="mt-5"
              role="alertdialog"
              aria-live="assertive"
              aria-label="Connection problem — retry or cancel"
            >
              <div className="rounded-2xl border border-amber-200 bg-amber-50 shadow-lg shadow-amber-100/60 px-5 py-5">
                {/* Icon + heading */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 mt-0.5 w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center">
                    <AlertTriangle className="w-4.5 h-4.5 text-amber-600" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="font-black text-amber-900 text-sm leading-tight">
                      Connection Problem
                    </p>
                    <p className="text-amber-800 text-xs mt-1 leading-snug">
                      {error || "Couldn't reach the server. Your selected card is waiting."}
                    </p>
                    <p className="text-amber-700 text-xs mt-0.5 font-medium">
                      Your selected card is still reserved.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Btn
                    variant="primary"
                    className="flex-1 rounded-xl py-3 flex items-center justify-center gap-2 text-sm"
                    onClick={handleRetry}
                  >
                    <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Retry
                  </Btn>
                  <Btn
                    variant="outline"
                    className="flex-1 rounded-xl py-3 flex items-center justify-center gap-2 text-sm text-amber-800 border-amber-300 hover:bg-amber-100"
                    onClick={handleCancelRetry}
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                    Cancel Game
                  </Btn>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Inline error (non-retry phases only) ──────────────────────────── */}
      {error && phase !== "waitingRetry" && (
        <p className="mt-4 text-destructive text-sm text-center max-w-sm">{error}</p>
      )}

      {/* ── ScratchCard overlay ───────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "scratching" && resolvedPrize && (
          <motion.div
            key="scratch-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0c2340]/92 backdrop-blur-md px-6 py-8"
          >
            {/* Subtle warm vignette — gives the overlay depth */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 70% 65% at 50% 48%, rgba(255,107,26,0.07) 0%, transparent 70%)",
              }}
            />

            {/* Overlay header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.30, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
              className="mb-7 text-center relative"
            >
              <p className="text-white/60 text-xs font-semibold tracking-[0.18em] uppercase mb-2">
                Your card is ready
              </p>
              <p className="text-white font-black text-xl tracking-wide leading-tight">
                Scratch to reveal your prize
              </p>
            </motion.div>

            {/* ScratchCard — fades + scales in from slightly below */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 18 }}
              animate={{ scale: 1,    opacity: 1, y: 0  }}
              transition={{
                delay:    0.22,
                duration: 0.60,
                ease:     [0.34, 1.56, 0.64, 1],
              }}
              className="w-[min(88vw,380px)] relative"
            >
              {/* Soft orange glow ring around the scratch card */}
              <div
                className="absolute pointer-events-none"
                style={{
                  inset: "-20px",
                  borderRadius: "32px",
                  background:
                    "radial-gradient(ellipse at center, rgba(255,107,26,0.22) 0%, transparent 70%)",
                }}
              />
              <ScratchCard
                prize={resolvedPrize}
                onComplete={handleScratchComplete}
                disabled={false}
              />
            </motion.div>

            {/* Scratch hint — fades in last */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75, duration: 0.5 }}
              className="mt-6 text-white/50 text-sm text-center animate-pulse relative"
            >
              Use your finger to scratch the card
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

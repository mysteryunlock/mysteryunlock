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
import { useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Search as SearchIcon, AlertTriangle, RefreshCw, X } from "lucide-react";
import { Btn } from "@/components/ds";
import { motion, AnimatePresence } from "framer-motion";

import { ShuffleChooseDeck } from "@/components/ShuffleChooseDeck";
import type { DeckPhase } from "@/components/ShuffleChooseDeck";
import { ScratchCard } from "@/components/ScratchCard";
import type { Prize } from "@/lib/spin-store";
import { usePrizesBySlug } from "@/lib/prizes-hook";
import { spinAndRecord } from "@/lib/access-codes.functions";
import { listPublicCampaigns } from "@/lib/campaigns.functions";
import { playClick } from "@/lib/sounds";
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
 *   chosen      — card selected; spinAndRecord in-flight (glow shown)
 *   flipping    — cards animating to face-down
 *   shuffling   — cards physically moving
 *   choosing    — shuffle stopped; user picks a card
 *   chosen      — card selected; brief pause before overlay
 *   scratching  — ScratchCard overlay visible
 *   revealing   — scratch done; remaining cards flipping up
 *   done        — navigating to result
 */
type RoutePhase =
  | "idle"
  | "flipping"
  | "shuffling"
  | "choosing"
  | "chosen"        // card selected; spinAndRecord in-flight
  | "waitingRetry"  // spinAndRecord failed; card stays selected, retry panel shown
  | "scratching"
  | "revealing"
  | "done";

const ROUTE_TO_DECK: Record<RoutePhase, DeckPhase | null> = {
  idle:         "preview",
  flipping:     "flipping",
  shuffling:    "shuffling",
  choosing:     "choosing",
  chosen:       "chosen",    // card glows while backend resolves
  waitingRetry: "chosen",    // card stays glowing, others dimmed; retry panel overlays
  scratching:   "chosen",    // deck stays frozen while scratch overlay is shown
  revealing:    "revealing",
  done:         "revealing",
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="aspect-square rounded-2xl overflow-hidden relative bg-[#1a2744]"
        >
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-y-0 w-1/2 animate-skeleton-shimmer bg-gradient-to-r from-transparent via-white/7 to-transparent" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ScratchPage() {
  const { slug } = Route.useParams();
  const { code, c: campaignSlug, name, contact, email, portal } = Route.useSearch();
  const navigate = useNavigate();

  const { prizes, isLoading, campaignNotFound } = usePrizesBySlug(slug, campaignSlug);

  // Keep campaign data warm (same as spin route)
  const fetchCampaigns = useServerFn(listPublicCampaigns);
  useQuery({
    queryKey:           ["public-campaigns", slug],
    queryFn:            async () => ((await fetchCampaigns({ data: { slug } })) as { campaigns: unknown[] }).campaigns,
    staleTime:          5 * 60_000,
    gcTime:             10 * 60_000,
    refetchOnMount:     false,
    refetchOnWindowFocus: false,
  });

  const doSpin = useServerFn(spinAndRecord);

  // ── Route state ──────────────────────────────────────────────────────────
  const [phase, setPhase]               = useState<RoutePhase>("idle");
  const [resolvedPrize, setResolvedPrize] = useState<Prize | null>(null);
  const [selectedPrizeIdx, setSelectedPrizeIdx] = useState<number | null>(null);
  const [error, setError]               = useState("");

  // ── START SHUFFLE: validate code is present, then begin animation ──────
  // spinAndRecord is NOT called here — it fires after the customer picks a card.

  const handleStartShuffle = useCallback(() => {
    if (phase !== "idle" || prizes.length === 0) return;
    playClick();
    setError("");
    trackGameStarted("scratch", slug, code);
    setPhase("flipping");
  }, [phase, prizes.length, slug, code]);

  // ── Deck callbacks ───────────────────────────────────────────────────────

  const handleFlipComplete    = useCallback(() => setPhase("shuffling"),  []);
  const handleShuffleComplete = useCallback(() => setPhase("choosing"),   []);

  /**
   * Called when the customer taps a card during the "choosing" phase.
   *
   * This is the moment spinAndRecord fires — AFTER the customer has committed
   * to a card but BEFORE scratching begins. The prize is determined and stored
   * in local state; the scratch animation then reveals the already-known result.
   *
   * The card choice is only a UI trigger — it has no effect on the probability
   * engine or which prize is selected by the backend.
   *
   * On ANY failure the selected card is preserved and the phase moves to
   * "waitingRetry" so the customer can retry without reshuffling or reselecting.
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
    playClick();
    setError("");
    setSelectedPrizeIdx(prizeIdx);
    setPhase("chosen"); // card glows while we await the backend
    await attemptSpin();
  }, [phase, attemptSpin]);

  /** Retry after a waitingRetry failure — same card, same code, no reshuffle. */
  const handleRetry = useCallback(async () => {
    if (phase !== "waitingRetry") return;
    setError("");
    setPhase("chosen"); // restore glow / "working…" state while retrying
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

  // ── ScratchCard complete → reveal remaining, then navigate ───────────────

  const handleScratchComplete = useCallback((prize: Prize) => {
    trackGameCompleted("scratch", slug, code, prize.isWin);
    setPhase("revealing");

    // After sequential reveal (~prizes.length × 280 ms + buffer), navigate
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

        <span className="w-[68px]" />
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
        {!campaignNotFound && isLoading && <LoadingSkeleton />}

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
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0c2340]/90 backdrop-blur-md px-6 py-8"
          >
            {/* Overlay header */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="mb-6 text-center"
            >
              <p className="text-white/70 text-sm font-semibold tracking-wide mb-1">You chose your card!</p>
              <p className="text-white font-black text-lg tracking-wide">Scratch to reveal your prize</p>
            </motion.div>

            {/* ScratchCard — unchanged component */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
              className="w-[min(88vw,380px)]"
            >
              <ScratchCard
                prize={resolvedPrize}
                onComplete={handleScratchComplete}
                disabled={false}
              />
            </motion.div>

            {/* Scratch hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="mt-5 text-white/55 text-sm text-center animate-pulse"
            >
              Scratch the card above to reveal your prize
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

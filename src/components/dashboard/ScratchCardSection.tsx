/**
 * ScratchCardSection — merchant-facing preview for Scratch Card campaigns.
 *
 * Shows a responsive visual grid of all configured prize cards
 * (mirroring what customers will see in the Shuffle & Choose game),
 * with a card-count badge, validation state, and a "Manage Prizes" action.
 *
 * Does NOT duplicate prize editing — all probability/name/image controls
 * remain in the existing PrizesTab.
 */

import { useState, useEffect } from "react";
import { Trophy, RotateCcw, Sparkles, AlertTriangle, CheckCircle2, Shuffle } from "lucide-react";
import { Btn } from "@/components/ds";
import type { Shop, Prize } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_CARDS = 3;
const MAX_CARDS = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gridCols(n: number): string {
  if (n <= 3) return "grid-cols-3";
  if (n === 4) return "grid-cols-2 sm:grid-cols-4";
  return "grid-cols-2 sm:grid-cols-3";
}

// ─── Mini card preview (face-up) ─────────────────────────────────────────────

function MiniCard({ prize, faceDown }: { prize: Prize; faceDown?: boolean }) {
  return (
    <div
      className="aspect-square rounded-xl overflow-hidden flex flex-col items-center justify-center gap-1 p-1.5 relative"
      style={
        faceDown
          ? {
              background:
                "linear-gradient(135deg,#8A9BB0 0%,#C8D4E0 18%,#5A6D84 32%,#DCE8F4 46%,#8A9BB0 60%,#F0F5FA 73%,#8A9BB0 100%)",
            }
          : { background: "linear-gradient(160deg,#f0f5ff 0%,#e4edf8 100%)" }
      }
    >
      {faceDown ? (
        <Sparkles className="w-4 h-4 text-white/80" strokeWidth={1.75} />
      ) : (
        <>
          {/* Accent stripe */}
          <div className="absolute top-0 inset-x-0 h-[2px] rounded-t-xl bg-gradient-to-r from-[#FF6B1A] to-[#0c2340]" />

          <div className="w-7 h-7 rounded-lg overflow-hidden bg-white border border-[#0c2340]/10 flex items-center justify-center flex-shrink-0">
            {prize.image_url ? (
              <img src={prize.image_url} alt={prize.name} className="w-full h-full object-cover" />
            ) : prize.is_win ? (
              <Trophy className="w-3.5 h-3.5 text-[#FF6B1A]" strokeWidth={1.5} />
            ) : (
              <RotateCcw className="w-3.5 h-3.5 text-[#4a5b78]" strokeWidth={1.5} />
            )}
          </div>

          <p className="text-[#0c2340] font-black text-center leading-tight text-[9px] line-clamp-1 px-0.5 w-full">
            {prize.short || prize.name}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScratchCardSectionProps {
  shop: Shop;
  prizes: Prize[];
  onAssign: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScratchCardSection({ prizes, onAssign }: ScratchCardSectionProps) {
  // Mini shuffle preview animation — cycles through face-down/face-up
  const [previewFlipped, setPreviewFlipped] = useState(false);

  useEffect(() => {
    if (prizes.length === 0) return;
    const t = setInterval(() => setPreviewFlipped((f) => !f), 2200);
    return () => clearInterval(t);
  }, [prizes.length]);

  const prizeCount   = prizes.length;
  const winCount     = prizes.filter((p) => p.is_win).length;
  const tooFew       = prizeCount > 0 && prizeCount < MIN_CARDS;
  const tooMany      = prizeCount > MAX_CARDS;
  const noWinner     = prizeCount > 0 && winCount === 0;
  const hasIssue     = tooFew || tooMany || noWinner;
  const isValid      = prizeCount >= MIN_CARDS && prizeCount <= MAX_CARDS && winCount >= 1;

  return (
    <div className="space-y-4">

      {/* ── Card preview panel ──────────────────────────────────────────────── */}
      <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-5">

        {prizes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F7FA] border border-[#0c2340]/8 flex items-center justify-center">
              <Shuffle className="w-7 h-7 text-[#4a5b78]" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-[#0c2340]">No cards configured yet</p>
            <p className="text-xs text-[#4a5b78] max-w-[240px]">
              Add at least {MIN_CARDS} prize cards to enable the Shuffle &amp; Choose game.
            </p>
          </div>
        ) : (
          <>
            {/* Card grid preview */}
            <div className={`grid ${gridCols(prizeCount)} gap-2 mb-4`}>
              {prizes.map((p) => (
                <MiniCard key={p.id} prize={p} faceDown={previewFlipped} />
              ))}
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between text-xs text-[#4a5b78] pt-3 border-t border-[#0c2340]/6">
              <span>
                <span className="font-bold text-[#0c2340]">{prizeCount}</span>{" "}
                card{prizeCount !== 1 ? "s" : ""}
              </span>
              <span>
                <span className="font-bold text-[#FF6B1A]">{winCount}</span>{" "}
                prize{winCount !== 1 ? "s" : ""}
              </span>
              <span>
                <span className="font-bold text-[#0c2340]">{prizeCount - winCount}</span>{" "}
                try again
              </span>
              {previewFlipped ? (
                <span className="inline-flex items-center gap-1 text-[#4a5b78]/70">
                  <Sparkles className="w-3 h-3" strokeWidth={2} />
                  Shuffle preview
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[#FF6B1A]">
                  <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
                  Face-up view
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Validation messages ─────────────────────────────────────────────── */}
      {hasIssue && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
          {tooFew && (
            <p className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Add at least {MIN_CARDS} cards (currently {prizeCount})
            </p>
          )}
          {tooMany && (
            <p className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Maximum {MAX_CARDS} cards allowed (currently {prizeCount})
            </p>
          )}
          {noWinner && (
            <p className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              At least one Prize card is required
            </p>
          )}
        </div>
      )}

      {isValid && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            {prizeCount} cards ready · Shuffle &amp; Choose game is active
          </p>
        </div>
      )}

      {/* ── How it works callout ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#0c2340]/8 bg-[#F5F7FA] px-4 py-3 space-y-1.5 text-[11px] text-[#4a5b78]">
        <p className="font-bold text-[#0c2340] text-xs flex items-center gap-1.5">
          <Shuffle className="w-3.5 h-3.5 text-[#FF6B1A]" strokeWidth={2} />
          How Shuffle &amp; Choose works
        </p>
        <p>1. Customer sees all cards face-up (prizes visible)</p>
        <p>2. Taps START SHUFFLE — prize is locked in by the server</p>
        <p>3. Cards flip &amp; shuffle for 3–5 seconds</p>
        <p>4. Customer picks one mystery card &amp; scratches to reveal</p>
        <p>5. Remaining cards flip over to show other prizes</p>
        <p className="text-[#0c2340] font-semibold pt-0.5">
          Customer choice never affects the result — fairness is guaranteed.
        </p>
      </div>

      {/* ── Action ─────────────────────────────────────────────────────────── */}
      <Btn variant="primary" className="w-full rounded-2xl py-3" onClick={onAssign}>
        Manage prizes &amp; probabilities
      </Btn>
    </div>
  );
}

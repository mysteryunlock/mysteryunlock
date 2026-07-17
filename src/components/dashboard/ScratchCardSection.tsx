/**
 * ScratchCardSection — merchant-facing preview/test section for Scratch Card
 * campaigns. Mirrors the structure of WheelSection so the two can be swapped
 * based on a campaign's game_type.
 *
 * Shows a static preview card (no interaction) plus action buttons to assign
 * prizes and edit card color — the same actions available for a spin wheel.
 */

import { useState } from "react";
import type { Shop, Prize } from "./types";

interface ScratchCardSectionProps {
  shop: Shop;
  prizes: Prize[];
  onEditColors: () => void;
  onAssign: () => void;
}

export function ScratchCardSection({ prizes, onEditColors, onAssign }: ScratchCardSectionProps) {
  const [flipped, setFlipped] = useState(false);

  const previewPrize = prizes[0];

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-5">
        {prizes.length === 0 ? (
          <p className="text-sm text-[#4a5b78] text-center py-10">
            Add prizes first to preview the scratch card.
          </p>
        ) : (
          <div className="flex flex-col items-center">
            {/* Static card preview */}
            <div
              className="relative w-full max-w-[300px] aspect-square rounded-2xl overflow-hidden cursor-pointer select-none border border-[#0c2340]/10 shadow-md"
              onClick={() => setFlipped((f) => !f)}
              title="Click to preview both sides"
            >
              {/* Foil side */}
              <div
                className={`absolute inset-0 transition-opacity duration-500 ${flipped ? "opacity-0" : "opacity-100"}`}
                style={{
                  background: "linear-gradient(135deg,#94A3B8 0%,#CBD5E1 18%,#64748B 32%,#E2E8F0 46%,#94A3B8 60%,#F8FAFC 73%,#94A3B8 86%,#CBD5E1 100%)",
                }}
              >
                {/* Horizontal sheen lines */}
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 h-px"
                    style={{ top: `${(i + 1) * 5}%`, background: "rgba(255,255,255,0.13)" }}
                  />
                ))}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <p className="text-4xl">🪙</p>
                  <p className="text-white font-bold text-lg tracking-wide drop-shadow">SCRATCH HERE</p>
                  <p className="text-white/60 text-xs">Click to flip preview</p>
                </div>
              </div>

              {/* Prize side */}
              <div
                className={`absolute inset-0 transition-opacity duration-500 flex flex-col items-center justify-center gap-3 p-4 ${flipped ? "opacity-100" : "opacity-0"}`}
                style={{ background: "linear-gradient(180deg,#FBF7EE 0%,#EAF1FB 100%)" }}
              >
                <div className="w-28 h-28 rounded-xl overflow-hidden border border-[#0c2340]/10 bg-[#f5f7fa] flex items-center justify-center">
                  {previewPrize?.image_url ? (
                    <img src={previewPrize.image_url} alt={previewPrize.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-5xl">{previewPrize?.is_win ? "🏆" : "🎱"}</span>
                  )}
                </div>
                <p className="font-black text-[#0c2340] text-center text-base leading-tight">
                  {previewPrize?.name}
                </p>
                <p className="text-xs text-[#4a5b78]">
                  {previewPrize?.is_win ? "🎉 Winner!" : "Try again"}
                </p>
                <p className="text-[10px] text-[#4a5b78]/60">Click to flip back</p>
              </div>
            </div>

            <p className="mt-3 text-xs text-[#4a5b78] text-center">
              {prizes.length} prize{prizes.length !== 1 ? "s" : ""} configured ·{" "}
              {prizes.filter((p) => p.is_win).length} winner{prizes.filter((p) => p.is_win).length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setFlipped((f) => !f)}
          disabled={prizes.length === 0}
          className="rounded-2xl bg-[#FF6B00] hover:bg-[#e85f00] text-white font-bold py-3 disabled:opacity-60"
        >
          Flip preview
        </button>
        <button onClick={onAssign} className="rounded-2xl bg-white border border-[#0c2340]/10 hover:bg-[#F5F7FA] text-[#0c2340] font-bold py-3">
          Assign prizes
        </button>
        <button onClick={onEditColors} className="rounded-2xl bg-white border border-[#0c2340]/10 hover:bg-[#F5F7FA] text-[#0c2340] font-bold py-3">
          Edit card color
        </button>
      </div>
    </div>
  );
}

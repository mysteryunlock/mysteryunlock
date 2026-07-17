/**
 * ScratchCard — canvas-based prize reveal mechanic.
 *
 * Two stacked canvases:
 *   1. prize canvas  (behind)  — renders the pre-determined prize; always visible
 *   2. overlay canvas (in front) — silver foil; erased via destination-out
 *      composite mode as the user drags a pointer / finger across it
 *
 * The prize is already known before this component mounts (spinAndRecord ran
 * server-side). Scratching is purely cosmetic; it auto-completes at ≥60% revealed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Prize } from "@/lib/spin-store";
import { playWin, playLose } from "@/lib/sounds";

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_SIZE      = 360;   // logical canvas resolution (px)
const SCRATCH_RADIUS   = 34;    // erase-circle radius at canvas resolution
const REVEAL_THRESHOLD = 0.60;  // auto-complete when ≥60% of pixels are transparent

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScratchCardProps {
  /** Pre-determined prize returned by spinAndRecord. */
  prize: Prize;
  /** Called once when the reveal threshold is crossed. */
  onComplete: (prize: Prize) => void;
  /** Disable pointer events (e.g. while navigating away after completion). */
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScratchCard({ prize, onComplete, disabled = false }: ScratchCardProps) {
  const prizeRef   = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const isDown       = useRef(false);
  const completedRef = useRef(false);

  const [started, setStarted] = useState(false);
  const [pct,     setPct]     = useState(0);

  // ── Prize layer: draw once on mount ──────────────────────────────────────

  useEffect(() => {
    const canvas = prizeRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = CANVAS_SIZE;
    const H = CANVAS_SIZE;

    // Gradient background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#FBF7EE");
    bg.addColorStop(1, "#EAF1FB");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = "#1f3460";
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.roundRect(10, 10, W - 20, H - 20, 22);
    ctx.stroke();

    const drawText = () => {
      ctx.textAlign    = "center";
      ctx.textBaseline = "alphabetic";

      // Prize name
      ctx.fillStyle = prize.isWin ? "#C9892B" : "#1f3460";
      ctx.font      = "900 26px system-ui, -apple-system, sans-serif";
      ctx.fillText(prize.name, W / 2, H - 52, W - 60);

      // Sub-label
      ctx.fillStyle = "rgba(31,52,96,0.55)";
      ctx.font      = "600 14px system-ui, -apple-system, sans-serif";
      ctx.fillText(
        prize.isWin ? "🎉 Congratulations!" : "Better luck next time",
        W / 2,
        H - 24,
      );
    };

    if (prize.image) {
      const img       = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const size = Math.round(W * 0.52);
        const x    = (W - size) / 2;
        const y    = Math.round(H * 0.12);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 14);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, x, y, size, size);
        ctx.restore();
        drawText();
      };
      img.onerror = drawText;
      img.src     = prize.image;
    } else {
      // Emoji placeholder when there's no image
      ctx.font         = `${Math.round(W * 0.28)}px system-ui`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(prize.isWin ? "🏆" : "🎱", W / 2, Math.round(H * 0.40));
      drawText();
    }
  }, [prize]);

  // ── Foil overlay: draw once on mount ─────────────────────────────────────

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = CANVAS_SIZE;
    const H = CANVAS_SIZE;

    // Silver foil gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0.00, "#B8B8B8");
    grad.addColorStop(0.20, "#E2E2E2");
    grad.addColorStop(0.40, "#A4A4A4");
    grad.addColorStop(0.55, "#D8D8D8");
    grad.addColorStop(0.75, "#C0C0C0");
    grad.addColorStop(1.00, "#AEAEAE");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle sheen lines
    ctx.strokeStyle = "rgba(255,255,255,0.20)";
    ctx.lineWidth   = 1;
    for (let y = 16; y < H; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Scratch-here label
    ctx.textAlign    = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle    = "rgba(255,255,255,0.85)";
    ctx.font         = "bold 20px system-ui, -apple-system, sans-serif";
    ctx.fillText("SCRATCH HERE", W / 2, H / 2 - 6);

    ctx.fillStyle = "rgba(255,255,255,0.60)";
    ctx.font      = "14px system-ui, -apple-system, sans-serif";
    ctx.fillText("Use your finger or mouse", W / 2, H / 2 + 18);
    ctx.fillText("🪙  🪙  🪙", W / 2, H / 2 + 46);
  }, []);

  // ── Core scratch logic ────────────────────────────────────────────────────

  const doScratch = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = overlayRef.current;
      if (!canvas || completedRef.current || disabled) return;

      const rect   = canvas.getBoundingClientRect();
      const scaleX = CANVAS_SIZE / rect.width;
      const scaleY = CANVAS_SIZE / rect.height;
      const x      = (clientX - rect.left)  * scaleX;
      const y      = (clientY - rect.top)   * scaleY;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Erase a circle from the foil layer
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, SCRATCH_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      if (!started) setStarted(true);

      // Sample pixel alpha to compute reveal percentage
      const data        = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
      let   transparent = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 64) transparent++;
      }
      const ratio = transparent / (data.length / 4);
      setPct(Math.round(ratio * 100));

      if (ratio >= REVEAL_THRESHOLD && !completedRef.current) {
        completedRef.current = true;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE); // wipe remaining foil
        if (prize.isWin) playWin();
        else             playLose();
        setTimeout(() => onComplete(prize), 400);
      }
    },
    [disabled, started, prize, onComplete],
  );

  // ── Pointer event handlers ────────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || completedRef.current) return;
    isDown.current = true;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    doScratch(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDown.current || disabled || completedRef.current) return;
    doScratch(e.clientX, e.clientY);
  };

  const handlePointerUp = () => { isDown.current = false; };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full max-w-[360px] mx-auto select-none touch-none">

      {/* Prize image layer (always behind) */}
      <canvas
        ref={prizeRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="block w-full rounded-2xl shadow-lg"
        aria-hidden
      />

      {/* Foil scratch layer (on top) */}
      <canvas
        ref={overlayRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className={[
          "absolute inset-0 w-full h-full rounded-2xl",
          disabled ? "cursor-not-allowed" : "cursor-crosshair",
        ].join(" ")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="Scratch card — drag to reveal your prize"
        role="img"
      />

      {/* Reveal progress pill */}
      {started && pct < 100 && !completedRef.current && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-black/50 backdrop-blur-sm text-white text-[11px] font-bold tracking-wider px-3 py-1 rounded-full">
            {pct}% revealed
          </div>
        </div>
      )}
    </div>
  );
}

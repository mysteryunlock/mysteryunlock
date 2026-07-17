/**
 * ScratchCard — production-quality canvas scratch mechanic.
 *
 * Architecture:
 * ─ Two stacked <canvas> elements (prize behind, metallic foil in front)
 * ─ Pointer events queue scratch points; a single rAF loop drains the queue
 *   → erase ops batched at true 60fps regardless of pointer event frequency
 * ─ Reveal % sampled at most once per 150ms (not per pointer event)
 *   → eliminates the O(n) getImageData bottleneck on every move
 * ─ HiDPI: internal canvas scaled by devicePixelRatio — sharp on retina
 * ─ Coordinate mapping via getBoundingClientRect (cached, invalidated on resize)
 * ─ Completion: CSS opacity fade on overlay → reveal chime → win/lose fanfare
 * ─ roundRect polyfill — works on Android WebView < Chrome 99
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Prize } from "@/lib/spin-store";
import { playScratching, playScratchReveal, playWin, playLose } from "@/lib/sounds";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Logical canvas resolution in CSS px (internal pixels = this × dpr). */
const LOGICAL_SIZE      = 360;
/** Brush radius in logical px. */
const SCRATCH_RADIUS    = 26;
/** Auto-complete when this fraction of pixels is transparent. */
const REVEAL_THRESHOLD  = 0.60;
/** Minimum ms between pixel-transparency checks (throttles getImageData). */
const SAMPLE_INTERVAL   = 150;
/** Minimum ms between scratch-sound bursts. */
const SCRATCH_SOUND_MS  = 80;

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Cross-browser rounded-rectangle path.
 * Replaces ctx.roundRect() which is absent in older Android WebViews.
 */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const cr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + cr, y);
  ctx.lineTo(x + w - cr, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + cr);
  ctx.lineTo(x + w, y + h - cr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - cr, y + h);
  ctx.lineTo(x + cr, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - cr);
  ctx.lineTo(x, y + cr);
  ctx.quadraticCurveTo(x, y,         x + cr, y);
  ctx.closePath();
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScratchCardProps {
  prize: Prize;
  /** Called once when the reveal threshold is crossed and the fade-out ends. */
  onComplete: (prize: Prize) => void;
  /** Disables pointer interaction (e.g. navigating away). */
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScratchCard({ prize, onComplete, disabled = false }: ScratchCardProps) {
  const prizeCanvasRef   = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Hot-path refs — never trigger re-renders
  const overlayCtxRef       = useRef<CanvasRenderingContext2D | null>(null);
  const dprRef              = useRef(1);
  const isDownRef           = useRef(false);
  const startedRef          = useRef(false);
  const completedRef        = useRef(false);
  const pendingPtsRef       = useRef<Array<{ x: number; y: number }>>([]);
  const rafIdRef            = useRef(0);
  const lastSampleTimeRef   = useRef(0);
  const lastScratchSoundRef = useRef(0);
  const rectCacheRef        = useRef<DOMRect | null>(null);
  const prizeRef            = useRef(prize);
  const onCompleteRef       = useRef(onComplete);

  useEffect(() => { prizeRef.current     = prize;     }, [prize]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Minimal state — only what the UI actually needs
  const [started,   setStarted]   = useState(false);
  const [completed, setCompleted] = useState(false);

  // ── Setup canvases at mount ───────────────────────────────────────────────

  useEffect(() => {
    const prizeCanvas   = prizeCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!prizeCanvas || !overlayCanvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    dprRef.current = dpr;

    const S = LOGICAL_SIZE * dpr;

    // Size both canvases identically
    for (const canvas of [prizeCanvas, overlayCanvas]) {
      canvas.width  = S;
      canvas.height = S;
    }

    // ── Prize layer ─────────────────────────────────────────────────────────

    const pCtx = prizeCanvas.getContext("2d");
    if (pCtx) {
      pCtx.scale(dpr, dpr);
      const W = LOGICAL_SIZE, H = LOGICAL_SIZE;

      // Warm background
      const bg = pCtx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#FBF7EE");
      bg.addColorStop(1, "#EAF1FB");
      pCtx.fillStyle = bg;
      pCtx.fillRect(0, 0, W, H);

      // Border
      pCtx.strokeStyle = "rgba(31,52,96,0.7)";
      pCtx.lineWidth   = 2;
      pCtx.beginPath();
      roundRectPath(pCtx, 8, 8, W - 16, H - 16, 18);
      pCtx.stroke();

      // Accent bar at top
      const accent = pCtx.createLinearGradient(0, 0, W, 0);
      if (prize.isWin) {
        accent.addColorStop(0,   "#FF6B00");
        accent.addColorStop(0.5, "#F5C542");
        accent.addColorStop(1,   "#FF6B00");
      } else {
        accent.addColorStop(0, "#334155");
        accent.addColorStop(1, "#475569");
      }
      pCtx.fillStyle = accent;
      pCtx.beginPath();
      roundRectPath(pCtx, 8, 8, W - 16, 5, 3);
      pCtx.fill();

      const drawText = () => {
        pCtx.textAlign    = "center";
        pCtx.textBaseline = "alphabetic";
        pCtx.fillStyle    = prize.isWin ? "#C9892B" : "#1f3460";
        pCtx.font         = "900 23px system-ui, -apple-system, sans-serif";
        pCtx.fillText(prize.name, W / 2, H - 50, W - 56);
        pCtx.fillStyle = "rgba(31,52,96,0.55)";
        pCtx.font      = "600 13px system-ui, -apple-system, sans-serif";
        pCtx.fillText(
          prize.isWin ? "🎉 Congratulations!" : "Better luck next time",
          W / 2, H - 24,
        );
      };

      if (prize.image) {
        const img       = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const size = Math.round(W * 0.50);
          const x    = (W - size) / 2;
          const y    = Math.round(H * 0.13);
          pCtx.save();
          pCtx.beginPath();
          roundRectPath(pCtx, x, y, size, size, 14);
          pCtx.clip();
          pCtx.drawImage(img, x, y, size, size);
          pCtx.restore();
          drawText();
        };
        img.onerror = drawText;
        img.src     = prize.image;
      } else {
        pCtx.font         = `${Math.round(W * 0.25)}px system-ui`;
        pCtx.textAlign    = "center";
        pCtx.textBaseline = "middle";
        pCtx.fillText(prize.isWin ? "🏆" : "🎱", W / 2, Math.round(H * 0.40));
        drawText();
      }
    }

    // ── Foil overlay ────────────────────────────────────────────────────────

    const oCtx = overlayCanvas.getContext("2d");
    if (oCtx) {
      overlayCtxRef.current = oCtx;
      oCtx.scale(dpr, dpr);
      const W = LOGICAL_SIZE, H = LOGICAL_SIZE;

      // Premium metallic foil gradient
      const g = oCtx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0.00, "#94A3B8");
      g.addColorStop(0.08, "#CBD5E1");
      g.addColorStop(0.20, "#64748B");
      g.addColorStop(0.32, "#E2E8F0");
      g.addColorStop(0.45, "#94A3B8");
      g.addColorStop(0.58, "#F8FAFC");
      g.addColorStop(0.70, "#94A3B8");
      g.addColorStop(0.82, "#CBD5E1");
      g.addColorStop(0.94, "#64748B");
      g.addColorStop(1.00, "#94A3B8");
      oCtx.fillStyle = g;
      oCtx.fillRect(0, 0, W, H);

      // Fine horizontal sheen lines — rolled foil texture
      oCtx.strokeStyle = "rgba(255,255,255,0.14)";
      oCtx.lineWidth   = 0.75;
      for (let y = 7; y < H; y += 7) {
        oCtx.beginPath();
        oCtx.moveTo(0, y);
        oCtx.lineTo(W, y);
        oCtx.stroke();
      }

      // Diagonal highlight — gives a 3D metallic sheen
      const hl = oCtx.createLinearGradient(0, 0, W * 0.55, H * 0.55);
      hl.addColorStop(0,    "rgba(255,255,255,0)");
      hl.addColorStop(0.45, "rgba(255,255,255,0.20)");
      hl.addColorStop(0.55, "rgba(255,255,255,0.20)");
      hl.addColorStop(1,    "rgba(255,255,255,0)");
      oCtx.fillStyle = hl;
      oCtx.fillRect(0, 0, W, H);

      // Coin row
      oCtx.textAlign    = "center";
      oCtx.textBaseline = "middle";
      oCtx.fillStyle    = "rgba(255,255,255,0.65)";
      oCtx.font         = `${Math.round(W * 0.09)}px system-ui`;
      oCtx.fillText("🪙  🪙  🪙", W / 2, H / 2 - 30);

      oCtx.textBaseline = "alphabetic";
      oCtx.fillStyle    = "rgba(255,255,255,0.92)";
      oCtx.font         = "bold 19px system-ui, -apple-system, sans-serif";
      oCtx.fillText("SCRATCH HERE", W / 2, H / 2 + 14);

      oCtx.fillStyle = "rgba(255,255,255,0.58)";
      oCtx.font      = "13px system-ui, -apple-system, sans-serif";
      oCtx.fillText("Use your finger or mouse", W / 2, H / 2 + 36);
    }
  }, [prize]); // eslint-disable-line react-hooks/exhaustive-deps — intentional: re-mount on prize change resets everything

  // Invalidate cached bounding rect on container resize
  useEffect(() => {
    const el = overlayCanvasRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => { rectCacheRef.current = null; });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Completion animation ─────────────────────────────────────────────────

  const triggerReveal = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setCompleted(true);

    playScratchReveal(prizeRef.current.isWin);
    setTimeout(() => {
      if (prizeRef.current.isWin) playWin();
      else                         playLose();
    }, 200);

    // Fade out the overlay canvas via CSS transition (GPU-composited)
    const overlay = overlayCanvasRef.current;
    if (overlay) {
      overlay.style.transition = "opacity 0.45s ease-out";
      overlay.style.opacity    = "0";
    }

    // Win glow on prize canvas
    if (prizeRef.current.isWin) {
      const pc = prizeCanvasRef.current;
      if (pc) {
        pc.style.transition = "filter 0.45s ease-out";
        pc.style.filter     =
          "drop-shadow(0 0 18px rgba(255,140,0,0.85)) drop-shadow(0 0 36px rgba(255,80,0,0.40))";
      }
    }

    setTimeout(() => onCompleteRef.current(prizeRef.current), 500);
  }, []);

  // ── rAF draw loop ────────────────────────────────────────────────────────

  const scheduleFrame = useCallback(() => {
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0;
      const ctx = overlayCtxRef.current;
      const pts = pendingPtsRef.current;
      if (!ctx || pts.length === 0) return;

      const dpr    = dprRef.current;
      const radius = SCRATCH_RADIUS * dpr;

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      for (const { x, y } of pts) {
        ctx.beginPath();
        ctx.arc(x * dpr, y * dpr, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      pendingPtsRef.current = [];

      // Throttled pixel check — skip if too soon
      const now = performance.now();
      if (now - lastSampleTimeRef.current < SAMPLE_INTERVAL) return;
      lastSampleTimeRef.current = now;
      if (completedRef.current) return;

      const S    = LOGICAL_SIZE * dpr;
      const data = ctx.getImageData(0, 0, S, S).data;
      let transparent = 0;
      const total = (data.length >> 2); // same as data.length / 4
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 64) transparent++;
      }

      if (transparent / total >= REVEAL_THRESHOLD) {
        triggerReveal();
      }
    });
  }, [triggerReveal]);

  // ── Pointer event handlers ────────────────────────────────────────────────

  const getLogicalXY = useCallback((clientX: number, clientY: number) => {
    if (!rectCacheRef.current) {
      const el = overlayCanvasRef.current;
      if (!el) return null;
      rectCacheRef.current = el.getBoundingClientRect();
    }
    const r = rectCacheRef.current;
    return {
      x: (clientX - r.left) * (LOGICAL_SIZE / r.width),
      y: (clientY - r.top)  * (LOGICAL_SIZE / r.height),
    };
  }, []);

  const enqueueScratch = useCallback((clientX: number, clientY: number) => {
    if (completedRef.current || disabled) return;
    const pt = getLogicalXY(clientX, clientY);
    if (!pt) return;
    pendingPtsRef.current.push(pt);
    scheduleFrame();

    if (!startedRef.current) {
      startedRef.current = true;
      setStarted(true);
    }

    const now = performance.now();
    if (now - lastScratchSoundRef.current > SCRATCH_SOUND_MS) {
      lastScratchSoundRef.current = now;
      playScratching();
    }
  }, [disabled, getLogicalXY, scheduleFrame]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || completedRef.current) return;
    isDownRef.current = true;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    enqueueScratch(e.clientX, e.clientY);
  }, [disabled, enqueueScratch]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDownRef.current || disabled || completedRef.current) return;
    // Use coalesced events for sub-frame accuracy on 120 Hz ProMotion displays
    const evts = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of evts) enqueueScratch(ev.clientX, ev.clientY);
  }, [disabled, enqueueScratch]);

  const handlePointerUp = useCallback(() => { isDownRef.current = false; }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative w-full aspect-square select-none"
      aria-label={completed ? `Prize revealed: ${prize.name}` : "Scratch card"}
    >
      {/* Prize layer — always visible, behind the foil */}
      <canvas
        ref={prizeCanvasRef}
        className="absolute inset-0 w-full h-full rounded-2xl shadow-lg"
        aria-hidden
      />

      {/* Foil overlay — erased as the user scratches */}
      {!completed && (
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full rounded-2xl"
          style={{ touchAction: "none", cursor: disabled ? "not-allowed" : "crosshair", willChange: "opacity" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="Scratch to reveal your prize"
          role="img"
        />
      )}

      {/* Completion glow ring */}
      {completed && prize.isWin && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none animate-pulse"
          style={{ boxShadow: "0 0 0 3px rgba(255,140,0,0.6), 0 0 32px rgba(255,100,0,0.35)" }} />
      )}

      {/* Scratch hint */}
      {started && !completed && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-black/55 backdrop-blur-sm text-white text-[11px] font-bold tracking-wider px-3 py-1.5 rounded-full">
            Keep scratching!
          </div>
        </div>
      )}
    </div>
  );
}

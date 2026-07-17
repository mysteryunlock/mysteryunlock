/**
 * ScratchCard — production-quality canvas scratch mechanic.
 *
 * Architecture:
 * ─ Two stacked <canvas> elements: prize layer (back) + metallic foil (front)
 * ─ CSS shimmer div between prize and foil — GPU-composited moving highlight
 *   that fades when the user begins scratching (no canvas involvement)
 * ─ Pointer events queue scratch points; a single rAF loop drains the queue
 *   → all erase ops batched at true 60 fps regardless of pointer frequency
 * ─ Reveal % sampled at most once per 150 ms (throttled getImageData)
 *   → eliminates the O(n) pixel-scan bottleneck on every pointer event
 * ─ HiDPI: internal canvas scaled by devicePixelRatio — sharp on retina
 * ─ Coordinate mapping via getBoundingClientRect (cached, ResizeObserver invalidation)
 * ─ Completion: CSS spring easing on foil (scale + opacity) + prize filter glow
 *   All driven by React state → inline styles (no imperative style mutations)
 * ─ DOM particles: 10 divs radially burst from card center on win
 * ─ Haptic: navigator.vibrate on completion (ignored on unsupported devices)
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
/** Number of win particles. */
const PARTICLE_COUNT    = 10;

/** Win particle color palette */
const PARTICLE_COLORS = [
  "#FF6B1A", "#F5C542", "#FF8C42",
  "#FFD700", "#FF3D00", "#FFF4E0",
  "#FF6B1A", "#F5C542", "#FF8C42", "#FFD700",
];

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
  /** Called once when the reveal animation finishes (~700 ms after threshold). */
  onComplete: (prize: Prize) => void;
  /** Disables pointer interaction (e.g. during navigation). */
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScratchCard({ prize, onComplete, disabled = false }: ScratchCardProps) {
  const prizeCanvasRef   = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Hot-path refs — no re-renders
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

  useEffect(() => { prizeRef.current      = prize;     }, [prize]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // React state — minimal surface, only what the DOM render needs
  const [started,       setStarted]       = useState(false);
  const [completed,     setCompleted]     = useState(false);
  const [showParticles, setShowParticles] = useState(false);

  // ── Setup canvases ────────────────────────────────────────────────────────

  useEffect(() => {
    const prizeCanvas   = prizeCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!prizeCanvas || !overlayCanvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    dprRef.current = dpr;
    const S = LOGICAL_SIZE * dpr;

    for (const canvas of [prizeCanvas, overlayCanvas]) {
      canvas.width  = S;
      canvas.height = S;
    }

    // ── Prize layer ─────────────────────────────────────────────────────────

    const pCtx = prizeCanvas.getContext("2d");
    if (pCtx) {
      pCtx.scale(dpr, dpr);
      const W = LOGICAL_SIZE, H = LOGICAL_SIZE;

      // Warm gradient background
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
        accent.addColorStop(0,   "#FF6B1A");
        accent.addColorStop(0.5, "#F5C542");
        accent.addColorStop(1,   "#FF6B1A");
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

    // ── Metallic foil overlay ────────────────────────────────────────────────

    const oCtx = overlayCanvas.getContext("2d");
    if (oCtx) {
      overlayCtxRef.current = oCtx;
      oCtx.scale(dpr, dpr);
      const W = LOGICAL_SIZE, H = LOGICAL_SIZE;

      // Premium multi-stop silver gradient (richer than a 2-stop gradient)
      const g = oCtx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0.00, "#8A9BB0");
      g.addColorStop(0.07, "#C8D4E0");
      g.addColorStop(0.18, "#5A6D84");
      g.addColorStop(0.30, "#DCE8F4");
      g.addColorStop(0.42, "#8A9BB0");
      g.addColorStop(0.54, "#F0F5FA");
      g.addColorStop(0.66, "#8A9BB0");
      g.addColorStop(0.78, "#C2CDD8");
      g.addColorStop(0.90, "#5A6D84");
      g.addColorStop(1.00, "#8A9BB0");
      oCtx.fillStyle = g;
      oCtx.fillRect(0, 0, W, H);

      // Fine horizontal sheen lines — pressed-foil texture
      oCtx.strokeStyle = "rgba(255,255,255,0.13)";
      oCtx.lineWidth   = 0.75;
      for (let y = 5; y < H; y += 5) {
        oCtx.beginPath();
        oCtx.moveTo(0, y);
        oCtx.lineTo(W, y);
        oCtx.stroke();
      }

      // Diagonal specular highlight — 3-D metallic depth
      const hl = oCtx.createLinearGradient(0, 0, W * 0.65, H * 0.65);
      hl.addColorStop(0,    "rgba(255,255,255,0)");
      hl.addColorStop(0.40, "rgba(255,255,255,0.20)");
      hl.addColorStop(0.60, "rgba(255,255,255,0.20)");
      hl.addColorStop(1,    "rgba(255,255,255,0)");
      oCtx.fillStyle = hl;
      oCtx.fillRect(0, 0, W, H);

      // Coin row + instruction text
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
  }, [prize]); // eslint-disable-line react-hooks/exhaustive-deps — intentional

  // Invalidate cached DOMRect on container resize
  useEffect(() => {
    const el = overlayCanvasRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => { rectCacheRef.current = null; });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Completion handler ────────────────────────────────────────────────────

  const triggerReveal = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    const p = prizeRef.current;

    // React state drives all CSS transitions (no imperative style mutations)
    setCompleted(true);
    if (p.isWin) setShowParticles(true);

    // Haptic feedback — double-tap for win, single for lose
    try { if (navigator.vibrate) navigator.vibrate(p.isWin ? [60, 30, 60] : [40]); } catch {}

    // Audio — reveal chime fires immediately; win/lose fanfare after a beat
    playScratchReveal(p.isWin);
    setTimeout(() => { if (p.isWin) playWin(); else playLose(); }, 220);

    // Navigate after the spring animation finishes (~550 ms + safety)
    setTimeout(() => onCompleteRef.current(p), 700);
  }, []);

  // ── rAF draw loop ─────────────────────────────────────────────────────────

  const scheduleFrame = useCallback(() => {
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0;
      const ctx = overlayCtxRef.current;
      const pts = pendingPtsRef.current;
      if (!ctx || pts.length === 0) return;

      const dpr    = dprRef.current;
      const radius = SCRATCH_RADIUS * dpr;

      // Erase all queued points in one composite pass
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      for (const { x, y } of pts) {
        ctx.beginPath();
        ctx.arc(x * dpr, y * dpr, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      pendingPtsRef.current = [];

      // Throttled transparency check — at most once per SAMPLE_INTERVAL ms
      const now = performance.now();
      if (now - lastSampleTimeRef.current < SAMPLE_INTERVAL) return;
      lastSampleTimeRef.current = now;
      if (completedRef.current) return;

      const S    = LOGICAL_SIZE * dpr;
      const data = ctx.getImageData(0, 0, S, S).data;
      let transparent = 0;
      const total = data.length >> 2; // ÷ 4 without division
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 64) transparent++;
      }

      if (transparent / total >= REVEAL_THRESHOLD) {
        triggerReveal();
      }
    });
  }, [triggerReveal]);

  // ── Coordinate helpers ────────────────────────────────────────────────────

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

    // Throttled scratch sound
    const now = performance.now();
    if (now - lastScratchSoundRef.current > SCRATCH_SOUND_MS) {
      lastScratchSoundRef.current = now;
      playScratching();
    }
  }, [disabled, getLogicalXY, scheduleFrame]);

  // ── Pointer event handlers ────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || completedRef.current) return;
    isDownRef.current = true;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    enqueueScratch(e.clientX, e.clientY);
  }, [disabled, enqueueScratch]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDownRef.current || disabled || completedRef.current) return;
    // Use coalesced events for sub-frame accuracy on ProMotion (120 Hz) displays
    const evts = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of evts) enqueueScratch(ev.clientX, ev.clientY);
  }, [disabled, enqueueScratch]);

  const handlePointerUp = useCallback(() => { isDownRef.current = false; }, []);

  // Cleanup rAF on unmount
  useEffect(() => () => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative w-full aspect-square select-none"
      aria-label={completed ? `Prize revealed: ${prize.name}` : "Scratch card"}
    >
      {/* 1 — Prize canvas (always visible, behind foil) */}
      <canvas
        ref={prizeCanvasRef}
        className="absolute inset-0 w-full h-full rounded-2xl shadow-lg"
        style={{
          filter: (completed && prize.isWin)
            ? "drop-shadow(0 0 20px rgba(255,140,0,0.90)) drop-shadow(0 0 40px rgba(255,80,0,0.45))"
            : "none",
          transition: "filter 0.5s ease-out",
          willChange: "filter",
        }}
        aria-hidden
      />

      {/* 2 — CSS shimmer band — sits between prize and foil.
              GPU-composited moving gradient; fades out when scratching starts.
              Zero canvas involvement — no interference with erase composite ops. */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none animate-foil-shimmer"
        style={{
          opacity:    started ? 0 : 1,
          transition: "opacity 0.40s ease",
        }}
      />

      {/* 3 — Foil overlay canvas — spring-eases out on completion.
              NOT conditionally rendered so the CSS transition can play.
              Pointer events disabled once completed (no interaction needed). */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full rounded-2xl"
        style={{
          touchAction:   "none",
          cursor:        (disabled || completed) ? "default" : "crosshair",
          willChange:    "opacity, transform",
          pointerEvents: completed ? "none" : "auto",
          // Spring easing: foil scales up slightly while fading out
          opacity:    completed ? 0 : 1,
          transform:  completed ? "scale(1.07)" : "scale(1)",
          transition: completed
            ? "opacity 0.55s cubic-bezier(0.34,1.56,0.64,1), transform 0.55s cubic-bezier(0.34,1.56,0.64,1)"
            : "none",
        }}
        onPointerDown={completed ? undefined : handlePointerDown}
        onPointerMove={completed ? undefined : handlePointerMove}
        onPointerUp={completed ? undefined : handlePointerUp}
        onPointerCancel={completed ? undefined : handlePointerUp}
        aria-label={completed ? undefined : "Scratch to reveal your prize"}
        role={completed ? undefined : "img"}
      />

      {/* 4 — Win glow ring (pulsing after reveal) */}
      {completed && prize.isWin && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none animate-pulse"
          style={{ boxShadow: "0 0 0 3px rgba(255,140,0,0.65), 0 0 36px rgba(255,100,0,0.38)" }}
        />
      )}

      {/* 5 — DOM particle burst — 10 divs in rotated parents for radial spread.
              Each child translates -110 px along the parent's rotated Y axis,
              creating a starburst without any canvas or SVG involvement. */}
      {showParticles && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden"
          aria-hidden
        >
          {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `rotate(${i * (360 / PARTICLE_COUNT)}deg)` }}
            >
              <div
                className="animate-particle-burst rounded-full"
                style={{
                  width:           10,
                  height:          10,
                  background:      PARTICLE_COLORS[i],
                  animationDelay:  `${i * 28}ms`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* 6 — Scratch progress hint */}
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

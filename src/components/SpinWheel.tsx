/**
 * SpinWheel — Premium casino-quality edition.
 *
 * Visual: rich gradient rim, counter-rotating shimmer, floating particle halo,
 *   jeweled pointer, branded orange win glow, confetti celebration.
 *
 * Animation engine (rAF, unchanged logic from original):
 *   idle → windup → cruise → decel → settle
 *   NEW: idle slow-drift, settle bounce (damped cosine), per-segment tick sync.
 *
 * spinAndRecord(), prize selection, and all business logic are untouched.
 * The wheel only ever spins toward the already-determined targetIndex.
 */

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LOGO, type Prize } from "@/lib/spin-store";
import { playWheelTick, playSpinStart, playWin, playLose } from "@/lib/sounds";
import { haptic } from "@/lib/haptics";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  prizes:         Prize[];
  spinning:       boolean;
  targetIndex:    number | null;
  onComplete:     (prize: Prize) => void;
  onLogoLongPress?: () => void;
  centerLogo?:    string;
  centerLabel?:   string;
  accent?:        string;
}

type Phase = "idle" | "windup" | "cruise" | "decel" | "settle";

interface Anim {
  phase:        Phase;
  phaseStart:   number;
  phaseAngle:   number;
  decelTarget:  number; // overshooting stop (true + OVERSHOOT_DEG)
  finalTarget:  number; // true segment centre
  rafId:        number;
  lastTick:     number; // used for idle delta-time
}

// ─── Animation constants ──────────────────────────────────────────────────────

const IDLE_DPM         = 12 / 1000;                     // 12 deg/s idle drift
const WINDUP_MS        = 900;                            // 0.9 s wind-up
const CRUISE_DPM       = (360 * 4.5) / 1000;            // 4.5 rot/s cruise
const WINDUP_DIST      = (CRUISE_DPM * WINDUP_MS) / 3;  // ≈ 486°
const DECEL_MS         = 4200;                           // 4.2 s decel
const DECEL_NATURAL    = (CRUISE_DPM * DECEL_MS) / 3;   // ≈ 2268°
const OVERSHOOT_DEG    = 8;                              // degrees past target
const SETTLE_MS        = 540;                            // damped-bounce duration
const MIN_CRUISE_TURNS = 5;                              // visual minimum

// ─── Easing ──────────────────────────────────────────────────────────────────

function easeInCubic(t: number)  { return t * t * t; }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

/** Damped cosine settle: starts at finalTarget + OVERSHOOT, ends at finalTarget. */
function settleOffset(t: number) {
  return OVERSHOOT_DEG * Math.exp(-5 * t) * Math.cos(3 * Math.PI * t);
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function lighten(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(mix(r))}${h(mix(g))}${h(mix(b))}`;
}
function darken(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const mix = (c: number) => Math.round(c * (1 - amount));
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(mix(r))}${h(mix(g))}${h(mix(b))}`;
}

// ─── Reduced-motion hook ──────────────────────────────────────────────────────

function useReducedMotion(): boolean {
  const [v, setV] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const h = (e: MediaQueryListEvent) => setV(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return v;
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ["#FF6B1A", "#FFB347", "#FFFFFF", "#0c2340", "#FFD700", "#C8D8F0"];
function WheelConfetti({ active }: { active: boolean }) {
  const [pts] = useState(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      w: 4 + Math.random() * 8,
      h: 8 + Math.random() * 14,
      dur: 1.0 + Math.random() * 1.4,
      delay: Math.random() * 0.5,
      rot: -60 + Math.random() * 120,
    })),
  );
  if (!active) return null;
  return (
    <div className="absolute inset-x-0 top-0 overflow-visible pointer-events-none" style={{ height: 0, zIndex: 30 }}>
      {pts.map((p) => (
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

// ─── Particles ────────────────────────────────────────────────────────────────

const PARTICLE_COLORS = ["#FF6B1A", "#FF8C42", "#FFFFFF", "#FFD700", "#90b8e8"];
function WheelParticles() {
  const pts = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * 360;
      const rad   = (angle * Math.PI) / 180;
      const r     = 51 + (i % 3) * 2.5; // 51-56% from center
      return {
        id: i,
        left: `${50 + r * Math.cos(rad - Math.PI / 2)}%`,
        top:  `${50 + r * Math.sin(rad - Math.PI / 2)}%`,
        size: 2 + (i % 4),
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        dur: 2.5 + (i % 4) * 0.7,
        delay: (i * 0.22) % 3,
        opacity: 0.25 + (i % 3) * 0.12,
      };
    }), []);
  return (
    <>
      {pts.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none animate-particle-float"
          style={{
            left: p.left, top: p.top,
            width: p.size, height: p.size,
            background: p.color,
            transform: "translate(-50%,-50%)",
            "--p-op": p.opacity,
            "--p-dur": `${p.dur}s`,
            "--p-delay": `${p.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

// ─── SpinWheelBase ────────────────────────────────────────────────────────────

function SpinWheelBase({
  prizes, spinning, targetIndex, onComplete,
  onLogoLongPress, centerLogo, centerLabel, accent,
}: Props) {
  const reducedMotion = useReducedMotion();

  const SEG      = prizes.length > 0 ? 360 / prizes.length : 360;
  const SEG_SAFE = SEG || 360;
  const N        = Math.max(prizes.length, 1);

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const svgRef       = useRef<SVGSVGElement>(null);
  const pointerElRef = useRef<HTMLDivElement>(null);

  // ── Stable value refs ─────────────────────────────────────────────────────
  const rotationRef    = useRef(0);
  const onCompleteRef  = useRef(onComplete);
  const prizesRef      = useRef(prizes);
  const segSafeRef     = useRef(SEG_SAFE);
  const targetIndexRef = useRef<number | null>(null);
  const prevSegRef     = useRef(-1);      // for tick sync
  const reducedRef     = useRef(reducedMotion);
  const spinningRef    = useRef(spinning);

  useEffect(() => { onCompleteRef.current = onComplete; },  [onComplete]);
  useEffect(() => { prizesRef.current     = prizes; },      [prizes]);
  useEffect(() => { segSafeRef.current    = SEG_SAFE; },    [SEG_SAFE]);
  useEffect(() => { reducedRef.current    = reducedMotion; }, [reducedMotion]);
  useEffect(() => { spinningRef.current   = spinning; },    [spinning]);

  // ── Animation state ───────────────────────────────────────────────────────
  const animRef = useRef<Anim>({
    phase: "idle", phaseStart: 0, phaseAngle: 0,
    decelTarget: 0, finalTarget: 0, rafId: 0, lastTick: 0,
  });

  // ── Win/lose celebration state ────────────────────────────────────────────
  const [winSegIdx,    setWinSegIdx]    = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isWinResult,  setIsWinResult]  = useState(false);

  // ── Pointer flex helper ───────────────────────────────────────────────────
  const flexPointer = () => {
    if (reducedRef.current) return;
    const el = pointerElRef.current;
    if (!el) return;
    el.style.transform = "translate(-50%, 0) rotate(-6deg) scaleY(0.84) scaleX(1.06)";
    setTimeout(() => {
      if (el) el.style.transform = "translate(-50%, 0)";
    }, 60);
  };

  // ── Main rAF tick ─────────────────────────────────────────────────────────
  const tickRef = useRef<(now: DOMHighResTimeStamp) => void>(() => {});
  tickRef.current = (now: DOMHighResTimeStamp) => {
    const anim = animRef.current;
    const el   = svgRef.current;
    if (!el) return;

    let angle = rotationRef.current;

    // ── IDLE: gentle ambient drift ──
    if (anim.phase === "idle") {
      if (!spinningRef.current) {
        const dt  = anim.lastTick > 0 ? now - anim.lastTick : 16;
        anim.lastTick = now;
        angle = rotationRef.current + IDLE_DPM * dt;
        rotationRef.current = angle;
        el.style.transform = `rotate(${angle}deg)`;
      }
      anim.rafId = requestAnimationFrame((ts) => tickRef.current(ts));
      return;
    }

    // ── Tick sync — detect segment crossings under the pointer ──
    const newSeg = Math.floor(angle / SEG_SAFE);
    if (newSeg !== prevSegRef.current) {
      prevSegRef.current = newSeg;
      if (anim.phase !== "settle") {
        // Speed ratio 0→1 from idle to cruise
        const speed =
          anim.phase === "windup" ? Math.min(1, (now - anim.phaseStart) / WINDUP_MS)
          : anim.phase === "cruise" ? 1
          : Math.max(0, 1 - (now - anim.phaseStart) / DECEL_MS);
        playWheelTick(speed);
        if (!reducedRef.current) haptic("light");
        flexPointer();
      }
    }

    // ── WINDUP ──
    if (anim.phase === "windup") {
      const t  = Math.min((now - anim.phaseStart) / WINDUP_MS, 1);
      angle    = anim.phaseAngle + WINDUP_DIST * easeInCubic(t);
      rotationRef.current = angle;
      el.style.transform  = `rotate(${angle}deg)`;
      if (t >= 1) {
        anim.phase      = "cruise";
        anim.phaseStart = now;
        anim.phaseAngle = angle;
      }

    // ── CRUISE ──
    } else if (anim.phase === "cruise") {
      angle = anim.phaseAngle + CRUISE_DPM * (now - anim.phaseStart);
      rotationRef.current = angle;
      el.style.transform  = `rotate(${angle}deg)`;

      const ti = targetIndexRef.current;
      if (ti !== null) {
        const seg        = segSafeRef.current;
        const center     = ti * seg;
        const base       = ((360 - center) % 360 + 360) % 360;
        const currentMod = ((angle % 360) + 360) % 360;
        const delta      = ((base - currentMod) + 360) % 360;
        const minTurns   = Math.ceil((DECEL_NATURAL - delta) / 360);
        const turns      = Math.max(minTurns, MIN_CRUISE_TURNS);
        anim.finalTarget  = angle + turns * 360 + delta;
        anim.decelTarget  = anim.finalTarget + OVERSHOOT_DEG; // overshoot
        anim.phase        = "decel";
        anim.phaseStart   = now;
        anim.phaseAngle   = angle;
      }

    // ── DECEL (with overshoot baked into target) ──
    } else if (anim.phase === "decel") {
      const t  = Math.min((now - anim.phaseStart) / DECEL_MS, 1);
      angle    = anim.phaseAngle + (anim.decelTarget - anim.phaseAngle) * easeOutCubic(t);
      rotationRef.current = angle;
      el.style.transform  = `rotate(${angle}deg)`;
      if (t >= 1) {
        anim.phase      = "settle";
        anim.phaseStart = now;
        anim.phaseAngle = anim.decelTarget;
      }

    // ── SETTLE: damped-cosine bounce back to true target ──
    } else if (anim.phase === "settle") {
      const t  = Math.min((now - anim.phaseStart) / SETTLE_MS, 1);
      angle    = anim.finalTarget + settleOffset(t);
      rotationRef.current = angle;
      el.style.transform  = `rotate(${angle}deg)`;
      if (t >= 1) {
        rotationRef.current = anim.finalTarget;
        el.style.transform  = `rotate(${anim.finalTarget}deg)`;
        anim.phase   = "idle";
        anim.rafId   = 0;
        anim.lastTick = 0;
        const ti = targetIndexRef.current;
        if (ti !== null) {
          const prize = prizesRef.current[ti];
          if (prize) {
            if (prize.isWin) {
              playWin();
              if (!reducedRef.current) haptic("success");
              setWinSegIdx(ti);
              setIsWinResult(true);
              setTimeout(() => setShowConfetti(true), 120);
              setTimeout(() => setShowConfetti(false), 3200);
            } else {
              playLose();
              if (!reducedRef.current) haptic("soft");
              setIsWinResult(false);
            }
            onCompleteRef.current(prize);
          }
        }
        // Resume idle drift (but now from final position)
        anim.rafId = requestAnimationFrame((ts) => tickRef.current(ts));
        return;
      }
    }

    anim.rafId = requestAnimationFrame((ts) => tickRef.current(ts));
  };

  // ── React to spinning flag ────────────────────────────────────────────────
  useEffect(() => {
    const anim = animRef.current;

    if (!spinning) {
      // Reset on cancel (shouldn't happen mid-spin in normal flow)
      targetIndexRef.current = null;
      return;
    }

    // Start only from idle
    if (anim.phase === "idle") {
      setWinSegIdx(null);
      setIsWinResult(false);
      setShowConfetti(false);
      targetIndexRef.current = null;
      prevSegRef.current = -1;

      if (!reducedMotion) playSpinStart();

      anim.phase      = "windup";
      anim.phaseStart = performance.now();
      anim.phaseAngle = rotationRef.current;
      anim.lastTick   = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning]);

  // ── Deliver server result to rAF via ref ──────────────────────────────────
  useEffect(() => {
    if (targetIndex !== null) targetIndexRef.current = targetIndex;
  }, [targetIndex]);

  // ── Boot the rAF loop (idle drift) on mount ───────────────────────────────
  useEffect(() => {
    const anim = animRef.current;
    anim.lastTick = performance.now();
    anim.rafId    = requestAnimationFrame((ts) => tickRef.current(ts));
    return () => {
      if (anim.rafId) cancelAnimationFrame(anim.rafId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Long-press on logo ────────────────────────────────────────────────────
  const pressTimer = useRef<number | null>(null);
  const startPress = () => {
    if (!onLogoLongPress) return;
    pressTimer.current = window.setTimeout(() => onLogoLongPress(), 5000);
  };
  const endPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  // ── Theme ─────────────────────────────────────────────────────────────────
  const theme = useMemo(() => {
    const dark    = accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#1f3460";
    return {
      dark,
      light:      lighten(dark, 0.60),
      darkGrad:   darken(dark, 0.12),
      rimMid:     lighten(dark, 0.30),
      rimEdge:    lighten(dark, 0.18),
      bgInner:    lighten(dark, 0.92),
      bgOuter:    lighten(dark, 0.72),
      textDark:   "#FFFFFF",
      textLight:  dark,
      stroke:     lighten(dark, 0.85),
    };
  }, [accent]);

  // ── SVG geometry ──────────────────────────────────────────────────────────
  const size = 360;
  const r    = size / 2;
  const cx   = r, cy = r;
  const iconR = r * (N <= 6 ? 0.60 : N <= 8 ? 0.58 : N <= 10 ? 0.56 : 0.54);
  const chord = 2 * iconR * Math.sin(Math.PI / N);
  const iconRadius = Math.max(12, Math.min(42, (chord / 2) * 0.88, r - iconR - 6, iconR - r * 0.22 - 6));
  const textR      = r * 0.915;
  const fontSize   = Math.max(7, Math.min(12, Math.round(iconRadius * 0.3)));

  // Segments
  const segments = useMemo(() => {
    return prizes.map((prize, i) => {
      const center = i * SEG;
      const a1 = (center - SEG / 2 - 90) * Math.PI / 180;
      const a2 = (center + SEG / 2 - 90) * Math.PI / 180;
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const largeArc = SEG > 180 ? 1 : 0;
      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const ix   = cx + iconR * Math.cos((center - 90) * Math.PI / 180);
      const iy   = cy + iconR * Math.sin((center - 90) * Math.PI / 180);
      const tx   = cx + textR * Math.cos((center - 90) * Math.PI / 180);
      const ty   = cy + textR * Math.sin((center - 90) * Math.PI / 180);
      return { prize, i, center, path, ix, iy, tx, ty };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prizes, SEG, cx, cy, r, iconR, textR]);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className={`relative w-full aspect-square${isWinResult && !reducedMotion ? " animate-wheel-win-zoom" : ""}`}>

      {/* ── Floating particle halo ── */}
      {!reducedMotion && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
          <WheelParticles />
        </div>
      )}

      {/* ── Confetti burst on win ── */}
      {!reducedMotion && <WheelConfetti active={showConfetti} />}

      {/* ── Orange win glow ring — pulses behind the rim ── */}
      <div
        className={`absolute inset-0 rounded-full pointer-events-none transition-opacity duration-700 ${isWinResult ? "opacity-100" : "opacity-0"}`}
        style={{
          zIndex: 2,
          boxShadow: "0 0 80px 24px rgba(255,107,26,0.55), 0 0 140px 40px rgba(255,107,26,0.28)",
        }}
      />

      {/* ── Premium rim: multi-layer gradient ring ── */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          zIndex: 3,
          background: `conic-gradient(${theme.rimEdge} 0deg, ${theme.dark} 90deg, ${theme.rimMid} 180deg, ${theme.darkGrad} 270deg, ${theme.rimEdge} 360deg)`,
          boxShadow: `0 0 40px -8px ${theme.dark}cc, inset 0 2px 4px rgba(255,255,255,0.15)`,
          padding: "3.5%",
        }}
      >
        {/* ── White separator ring ── */}
        <div className="w-full h-full rounded-full bg-white/90 p-[2.5%]" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>

          {/* ── Wheel area ── */}
          <div
            className="w-full h-full rounded-full relative overflow-hidden"
            style={{ background: `radial-gradient(circle at 44% 38%, ${theme.bgInner} 0%, ${theme.bgOuter} 72%)` }}
          >
            {/* ── Spinning SVG ── */}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full"
              style={{ willChange: "transform", transformOrigin: "center" }}
            >
              <defs>
                {/* Win segment glow filter */}
                <filter id="seg-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feFlood floodColor="#FF6B1A" floodOpacity="0.7" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="glow" />
                  <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                {/* Image clip paths */}
                {segments.map(({ prize, ix, iy }) => (
                  <clipPath key={prize.id} id={`clip-${prize.id}`}>
                    <circle cx={ix} cy={iy} r={iconRadius} />
                  </clipPath>
                ))}
                {/* Subtle radial segment sheen */}
                <radialGradient id="seg-sheen" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="rgba(255,255,255,0.09)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
                {/* Diagonal hatch pattern for disabled segments */}
                <pattern id="disabled-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.6)" strokeWidth="3" />
                </pattern>
              </defs>

              {/* ── Segment fills ── */}
              {segments.map(({ prize, i, center, path, ix, iy, tx, ty }) => {
                const isDark      = i % 2 === 0;
                const isDisabled  = prize.probability === 0;
                const fill        = isDisabled
                  ? (isDark ? "#374151" : "#6B7280")
                  : (isDark ? theme.dark : theme.light);
                const segStroke   = isDisabled ? "#4B5563" : theme.stroke;
                const textFill    = isDisabled ? "rgba(255,255,255,0.45)" : (isDark ? theme.textDark : theme.textLight);
                const isWin       = winSegIdx === i;
                return (
                  <g key={prize.id} opacity={isDisabled ? 0.72 : 1}>
                    {/* Base segment */}
                    <path
                      d={path}
                      fill={fill}
                      stroke={segStroke}
                      strokeWidth="1.5"
                      filter={isWin ? "url(#seg-glow)" : undefined}
                    />
                    {/* Win overlay — extra warm tint */}
                    {isWin && (
                      <path d={path} fill="rgba(255,107,26,0.40)" />
                    )}
                    {/* Subtle radial sheen */}
                    {!isDisabled && <path d={path} fill="url(#seg-sheen)" />}
                    {/* Disabled diagonal stripe overlay */}
                    {isDisabled && (
                      <path d={path} fill="url(#disabled-hatch)" opacity="0.18" />
                    )}
                    {/* Icon circle */}
                    <circle
                      cx={ix} cy={iy} r={iconRadius}
                      fill={isDisabled ? "rgba(180,180,180,0.55)" : "rgba(245,247,251,0.95)"}
                      stroke={isWin ? "#FF6B1A" : (isDisabled ? "#6B7280" : theme.dark)}
                      strokeWidth={isWin ? "2.5" : "1.5"}
                    />
                    {/* Prize image */}
                    {prize.image && (
                      <image
                        href={prize.image}
                        x={ix - iconRadius} y={iy - iconRadius}
                        width={iconRadius * 2} height={iconRadius * 2}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#clip-${prize.id})`}
                        transform={`rotate(${center} ${ix} ${iy})`}
                        opacity={isDisabled ? 0.4 : 1}
                      />
                    )}
                    {/* Prize label */}
                    <text
                      x={tx} y={ty}
                      fill={textFill}
                      fontSize={fontSize}
                      fontWeight="800"
                      fontFamily="'DM Sans', system-ui, sans-serif"
                      textAnchor="middle"
                      transform={`rotate(${center} ${tx} ${ty})`}
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.25)" }}
                    >
                      {prize.short}
                    </text>
                  </g>
                );
              })}

              {/* Center cap base — the button renders on top */}
              <circle cx={cx} cy={cy} r={r * 0.22}
                fill="rgba(245,247,251,0.96)"
                stroke={theme.dark}
                strokeWidth="2"
                filter="drop-shadow(0 2px 6px rgba(0,0,0,0.20))"
              />
            </svg>

            {/* ── Counter-rotating shimmer overlay — ambient casino sheen ── */}
            {!reducedMotion && (
              <div
                className="absolute inset-0 rounded-full pointer-events-none animate-spin-slow-ccw overflow-hidden"
                style={{ zIndex: 5 }}
              >
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "conic-gradient(transparent 0deg, rgba(255,255,255,0.055) 35deg, transparent 70deg, transparent 360deg)",
                  }}
                />
              </div>
            )}

            {/* ── Center hub button ── */}
            <button
              onPointerDown={startPress}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onPointerCancel={endPress}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[22%] h-[22%] rounded-full overflow-hidden border-2 bg-[#f5f7fb] transition-all duration-500"
              style={{
                borderColor: isWinResult ? "#FF6B1A" : theme.dark,
                boxShadow:   isWinResult
                  ? `0 0 24px 6px rgba(255,107,26,0.6), 0 0 8px -2px ${theme.dark}88`
                  : `0 0 16px -4px ${theme.dark}88`,
                zIndex: 10,
              }}
              aria-label={centerLabel || "Mystery Unlock"}
            >
              <img
                src={centerLogo || DEFAULT_LOGO}
                alt={centerLabel || "Mystery Unlock"}
                className="w-full h-full object-cover"
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Pointer — fixed at top, flexes on segment crossings ── */}
      <div
        ref={pointerElRef}
        className="absolute left-1/2 -top-1 z-20"
        style={{
          transform: "translate(-50%, 0)",
          transformOrigin: "50% 0%",
          transition: "transform 55ms ease-out",
          filter: `drop-shadow(0 5px 12px ${theme.dark}90)`,
        }}
      >
        <svg width="46" height="58" viewBox="0 0 46 58" style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="ptr-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={lighten(theme.dark, 0.50)} />
              <stop offset="42%"  stopColor={theme.dark} />
              <stop offset="100%" stopColor={darken(theme.dark, 0.40)} />
            </linearGradient>
            <linearGradient id="ptr-sheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="rgba(255,255,255,0)" />
              <stop offset="40%"  stopColor="rgba(255,255,255,0.22)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          {/* Main pointer body */}
          <path d="M23 56 L4 13 Q23 1 42 13 Z" fill="url(#ptr-grad)" stroke={darken(theme.dark, 0.3)} strokeWidth="1.5" />
          {/* Shine highlight */}
          <path d="M23 56 L4 13 Q23 1 42 13 Z" fill="url(#ptr-sheen)" />
          {/* Orange tip gem */}
          <circle cx="23" cy="13" r="6" fill="#FF6B1A" stroke={darken(theme.dark, 0.2)} strokeWidth="1.5" />
          <circle cx="21" cy="11" r="1.8" fill="rgba(255,255,255,0.55)" />
        </svg>
      </div>
    </div>
  );
}

export const SpinWheel = memo(SpinWheelBase);

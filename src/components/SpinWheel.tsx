import { memo, useEffect, useMemo, useRef } from "react";
import { DEFAULT_LOGO, type Prize } from "@/lib/spin-store";
import { startSpinTicks, playWin, playLose } from "@/lib/sounds";

interface Props {
  prizes: Prize[];
  spinning: boolean;
  targetIndex: number | null;
  onComplete: (prize: Prize) => void;
  onLogoLongPress?: () => void;
  centerLogo?: string;
  centerLabel?: string;
  /** Optional accent hex (e.g. "#1f3460"). Used as the "dark slice" color and rim. */
  accent?: string;
}

// Lighten a hex color toward white by `amount` (0..1).
function lighten(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.replace("#", ""));
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

// Darken a hex color toward black by `amount` (0..1).
function darken(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.replace("#", ""));
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const mix = (c: number) => Math.round(c * (1 - amount));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

// Easing — both anchored at (0,0)→(1,1)
function easeInCubic(t: number) { return t * t * t; }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

// Animation constants
const WINDUP_MS = 1200;
// Cruise speed: 4 rotations per second (deg per ms)
const CRUISE_DPM = (360 * 4) / 1000;
// With easeInCubic, derivative at t=1 is 3, so total windup distance that
// ends at cruise speed: dist = CRUISE_DPM * WINDUP_MS / 3
const WINDUP_DIST = (CRUISE_DPM * WINDUP_MS) / 3; // ≈ 576°
const DECEL_MS = 5500;
// Matching natural decel distance (easeOutCubic, derivative at t=0 is 3)
const DECEL_NATURAL_DIST = (CRUISE_DPM * DECEL_MS) / 3; // ≈ 2640°

type Phase = "idle" | "windup" | "cruise" | "decel";

interface Anim {
  phase: Phase;
  phaseStart: number;   // timestamp from rAF when this phase began
  phaseAngle: number;   // wheel angle when this phase began
  decelTarget: number;  // target angle (decel phase only)
  rafId: number;
}

function SpinWheelBase({
  prizes, spinning, targetIndex, onComplete,
  onLogoLongPress, centerLogo, centerLabel, accent,
}: Props) {

  const SEG = prizes.length > 0 ? 360 / prizes.length : 360;
  const SEG_SAFE = SEG === 0 ? 360 : SEG;

  // DOM ref — we drive transform directly, zero React state during animation
  const svgRef = useRef<SVGSVGElement>(null);

  // Stable refs so rAF tick always sees latest values without re-closing
  const rotationRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  const prizesRef = useRef(prizes);
  const segSafeRef = useRef(SEG_SAFE);
  const targetIndexRef = useRef<number | null>(null);
  const ticksCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { prizesRef.current = prizes; }, [prizes]);
  useEffect(() => { segSafeRef.current = SEG_SAFE; }, [SEG_SAFE]);

  // All mutable animation state in one ref — avoids closure staleness
  const animRef = useRef<Anim>({
    phase: "idle", phaseStart: 0, phaseAngle: 0, decelTarget: 0, rafId: 0,
  });

  // Tick function held in a ref so rAF always calls the latest version
  // (captures fresh refs each render without needing to list them as deps).
  const tickRef = useRef<(now: DOMHighResTimeStamp) => void>(() => {});
  tickRef.current = (now: DOMHighResTimeStamp) => {
    const anim = animRef.current;
    const el = svgRef.current;
    if (!el || anim.phase === "idle") return;

    let angle: number;

    if (anim.phase === "windup") {
      const t = Math.min((now - anim.phaseStart) / WINDUP_MS, 1);
      angle = anim.phaseAngle + WINDUP_DIST * easeInCubic(t);
      rotationRef.current = angle;
      el.style.transform = `rotate(${angle}deg)`;

      if (t >= 1) {
        // Seamless hand-off to cruise — no snap, we're at exactly the right angle
        anim.phase = "cruise";
        anim.phaseStart = now;
        anim.phaseAngle = angle;
      }

    } else if (anim.phase === "cruise") {
      angle = anim.phaseAngle + CRUISE_DPM * (now - anim.phaseStart);
      rotationRef.current = angle;
      el.style.transform = `rotate(${angle}deg)`;

      // When the server responds, targetIndexRef is set; we pick it up here
      const ti = targetIndexRef.current;
      if (ti !== null) {
        const seg = segSafeRef.current;
        const center = ti * seg;
        const base = ((360 - center) % 360 + 360) % 360;
        const currentMod = ((angle % 360) + 360) % 360;
        const delta = ((base - currentMod) + 360) % 360;
        // Enough extra turns to ensure initial decel speed == cruise speed
        const minTurns = Math.ceil((DECEL_NATURAL_DIST - delta) / 360);
        const turns = Math.max(minTurns, 5); // minimum 5 full visual turns
        anim.decelTarget = angle + turns * 360 + delta;
        anim.phase = "decel";
        anim.phaseStart = now;
        anim.phaseAngle = angle;
      }

    } else if (anim.phase === "decel") {
      const t = Math.min((now - anim.phaseStart) / DECEL_MS, 1);
      angle = anim.phaseAngle + (anim.decelTarget - anim.phaseAngle) * easeOutCubic(t);
      rotationRef.current = angle;
      el.style.transform = `rotate(${angle}deg)`;

      if (t >= 1) {
        rotationRef.current = anim.decelTarget;
        anim.phase = "idle";
        anim.phaseAngle = anim.decelTarget;
        anim.rafId = 0;
        const ti = targetIndexRef.current;
        if (ti !== null) {
          const prize = prizesRef.current[ti];
          if (prize) {
            if (prize.isWin) playWin(); else playLose();
            onCompleteRef.current(prize);
          }
        }
        return; // done — do not schedule another frame
      }
    }

    anim.rafId = requestAnimationFrame((ts) => tickRef.current(ts));
  };

  // React to spinning flag changes
  useEffect(() => {
    const anim = animRef.current;

    if (!spinning) {
      if (anim.rafId) { cancelAnimationFrame(anim.rafId); anim.rafId = 0; }
      anim.phase = "idle";
      ticksCancelRef.current?.();
      ticksCancelRef.current = null;
      targetIndexRef.current = null;
      return;
    }

    // Start windup only if not already animating
    if (anim.phase === "idle") {
      anim.phase = "windup";
      anim.phaseStart = performance.now();
      anim.phaseAngle = rotationRef.current;
      // Budget ticks for windup + expected server time + decel
      ticksCancelRef.current = startSpinTicks(WINDUP_MS + DECEL_MS + 2000);
      anim.rafId = requestAnimationFrame((ts) => tickRef.current(ts));
    }
  }, [spinning]);

  // Deliver server result to the rAF loop via a ref (no state update needed)
  useEffect(() => {
    if (targetIndex !== null) {
      targetIndexRef.current = targetIndex;
    }
  }, [targetIndex]);

  // Cleanup on unmount
  useEffect(() => () => {
    const anim = animRef.current;
    if (anim.rafId) cancelAnimationFrame(anim.rafId);
    ticksCancelRef.current?.();
  }, []);

  const pressTimer = useRef<number | null>(null);
  const startPress = () => {
    if (!onLogoLongPress) return;
    pressTimer.current = window.setTimeout(() => onLogoLongPress(), 5000);
  };
  const endPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  const size = 360;
  const r = size / 2;
  const cx = r, cy = r;
  const N = Math.max(prizes.length, 1);
  const iconR = r * (N <= 6 ? 0.6 : N <= 8 ? 0.58 : N <= 10 ? 0.56 : 0.54);
  const chord = 2 * iconR * Math.sin(Math.PI / N);
  const radialOuter = r - iconR - 6;
  const radialInner = iconR - r * 0.22 - 6;
  const iconRadius = Math.max(14, Math.min(44, (chord / 2) * 0.88, radialOuter, radialInner));
  const textR = r * 0.92;
  const fontSize = Math.max(8, Math.min(12, Math.round(iconRadius * 0.3)));

  const theme = useMemo(() => {
    const dark = accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#1f3460";
    return {
      dark,
      light: lighten(dark, 0.6),
      rimEnd: lighten(dark, 0.25),
      pointerTop: lighten(dark, 0.25),
      pointerMid: dark,
      pointerBot: darken(dark, 0.35),
      bgInner: lighten(dark, 0.92),
      bgOuter: lighten(dark, 0.7),
    };
  }, [accent]);

  return (
    <div className="relative w-full aspect-square">
      <div className="absolute inset-0 rounded-full p-[3%]" style={{ background: `linear-gradient(135deg,${theme.dark},${theme.rimEnd})`, boxShadow: `0 0 40px -8px ${theme.dark}99` }}>
        <div className="w-full h-full rounded-full bg-[#f5f7fb] p-[2%]">
          <div className="w-full h-full rounded-full relative overflow-hidden"
               style={{ background: `radial-gradient(circle, ${theme.bgInner} 0%, ${theme.bgOuter} 70%)` }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full"
              style={{ willChange: "transform", transformOrigin: "center" }}
            >
              <defs>
                {prizes.map((prize, i) => {
                  const centerAngle = i * SEG;
                  const ix = cx + iconR * Math.cos((centerAngle - 90) * Math.PI / 180);
                  const iy = cy + iconR * Math.sin((centerAngle - 90) * Math.PI / 180);
                  return (
                    <clipPath key={prize.id} id={`clip-${prize.id}`}>
                      <circle cx={ix} cy={iy} r={iconRadius} />
                    </clipPath>
                  );
                })}
              </defs>
              {prizes.map((prize, i) => {
                const centerAngle = i * SEG;
                const a1 = (centerAngle - SEG / 2 - 90) * Math.PI / 180;
                const a2 = (centerAngle + SEG / 2 - 90) * Math.PI / 180;
                const x1 = cx + r * Math.cos(a1);
                const y1 = cy + r * Math.sin(a1);
                const x2 = cx + r * Math.cos(a2);
                const y2 = cy + r * Math.sin(a2);
                const isDark = i % 2 === 0;
                const fill = isDark ? theme.dark : theme.light;
                const largeArc = SEG > 180 ? 1 : 0;
                const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                const ix = cx + iconR * Math.cos((centerAngle - 90) * Math.PI / 180);
                const iy = cy + iconR * Math.sin((centerAngle - 90) * Math.PI / 180);
                const tx = cx + textR * Math.cos((centerAngle - 90) * Math.PI / 180);
                const ty = cy + textR * Math.sin((centerAngle - 90) * Math.PI / 180);
                return (
                  <g key={prize.id}>
                    <path d={path} fill={fill} stroke="#f5f7fb" strokeWidth="2" />
                    <circle cx={ix} cy={iy} r={iconRadius} fill="#f5f7fb" stroke={theme.dark} strokeWidth="2" />
                    <image
                      href={prize.image}
                      x={ix - iconRadius}
                      y={iy - iconRadius}
                      width={iconRadius * 2}
                      height={iconRadius * 2}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#clip-${prize.id})`}
                      transform={`rotate(${centerAngle} ${ix} ${iy})`}
                    />
                    <text
                      x={tx}
                      y={ty}
                      fill={isDark ? "#FFFFFF" : theme.dark}
                      fontSize={fontSize}
                      fontWeight="800"
                      textAnchor="middle"
                      transform={`rotate(${centerAngle} ${tx} ${ty})`}
                    >
                      {prize.short}
                    </text>
                  </g>
                );
              })}
              <circle cx={cx} cy={cy} r={r * 0.22} fill="#f5f7fb" stroke="#1f3460" strokeWidth="2" />
            </svg>

            <button
              onPointerDown={startPress}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onPointerCancel={endPress}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[22%] h-[22%] rounded-full overflow-hidden border-2 bg-[#f5f7fb]"
              style={{ borderColor: theme.dark, boxShadow: `0 0 24px -6px ${theme.dark}88` }}
              aria-label={centerLabel || "Mystery Unlock"}
            >
              <img src={centerLogo || DEFAULT_LOGO} alt={centerLabel || "Mystery Unlock"} className="w-full h-full object-cover" />
            </button>
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 -top-2 -translate-x-1/2 z-10" style={{ filter: `drop-shadow(0 4px 10px ${theme.dark}80)` }}>
        <svg width="44" height="56" viewBox="0 0 44 56">
          <defs>
            <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.pointerTop} />
              <stop offset="50%" stopColor={theme.pointerMid} />
              <stop offset="100%" stopColor={theme.pointerBot} />
            </linearGradient>
          </defs>
          <path d="M22 54 L4 12 Q22 0 40 12 Z" fill="url(#gp)" stroke={theme.pointerBot} strokeWidth="1.5" />
          <circle cx="22" cy="14" r="4" fill="#f5f7fb" />
        </svg>
      </div>
    </div>
  );
}

export const SpinWheel = memo(SpinWheelBase);

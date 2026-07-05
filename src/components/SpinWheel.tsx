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

function SpinWheelBase({ prizes, spinning, targetIndex, onComplete, onLogoLongPress, centerLogo, centerLabel, accent }: Props) {

  const SEG = prizes.length > 0 ? 360 / prizes.length : 360;
  const SEG_SAFE = SEG === 0 ? 360 : SEG;

  // Refs for animation — drive the SVG transform directly, bypassing React state
  // so the browser compositor owns the animation with zero re-renders mid-spin.
  const svgRef = useRef<SVGSVGElement>(null);
  const rotationRef = useRef(0);
  const pressTimer = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  const prizesRef = useRef(prizes);
  const segSafeRef = useRef(SEG_SAFE);
  const phaseRef = useRef<"idle" | "windup" | "final">("idle");
  const windupStartRef = useRef(0);
  const ticksCancelRef = useRef<(() => void) | null>(null);
  const doneTimerRef = useRef<number | null>(null);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { prizesRef.current = prizes; }, [prizes]);
  useEffect(() => { segSafeRef.current = SEG_SAFE; }, [SEG_SAFE]);

  const WINDUP_MS = 1400;
  const WINDUP_TURNS = 2;
  const DECEL_MS = 7000;

  // Helper: directly set the SVG's CSS transform without touching React state.
  const setTransform = (deg: number, transition: string) => {
    const el = svgRef.current;
    if (!el) return;
    el.style.transition = transition;
    el.style.transform = `rotate(${deg}deg)`;
  };

  useEffect(() => {
    if (!spinning) {
      if (phaseRef.current !== "idle") {
        const elapsed = Math.min(performance.now() - windupStartRef.current, WINDUP_MS);
        const visual = rotationRef.current + (elapsed / WINDUP_MS) * WINDUP_TURNS * 360;
        setTransform(visual, "none");
        rotationRef.current = visual;
      }
      phaseRef.current = "idle";
      if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null; }
      ticksCancelRef.current?.();
      ticksCancelRef.current = null;
      return;
    }

    // Phase 1: user pressed SPIN — start ramp-up immediately, no target yet
    if (spinning && phaseRef.current === "idle") {
      phaseRef.current = "windup";
      windupStartRef.current = performance.now();
      const from = rotationRef.current;
      const to = from + WINDUP_TURNS * 360;
      // Apply transition then set final position in the next two frames so the
      // browser paints the "transition set" frame before driving the transform.
      setTransform(from, `transform ${WINDUP_MS}ms linear`);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setTransform(to, `transform ${WINDUP_MS}ms linear`);
      }));
      ticksCancelRef.current = startSpinTicks(WINDUP_MS + DECEL_MS);
    }

    // Phase 2: server responded — smoothly hand off to final decel
    if (spinning && phaseRef.current === "windup" && targetIndex !== null && prizesRef.current.length > 0) {
      phaseRef.current = "final";
      const elapsed = Math.min(performance.now() - windupStartRef.current, WINDUP_MS);
      const visualNow = rotationRef.current + (elapsed / WINDUP_MS) * WINDUP_TURNS * 360;

      const center = targetIndex * segSafeRef.current;
      const base = ((360 - center) % 360 + 360) % 360;
      const visualMod = ((visualNow % 360) + 360) % 360;
      const delta = ((base - visualMod) + 360) % 360;
      const finalRotation = visualNow + 8 * 360 + delta;

      // Snap to current visual position (no transition), then in the next two
      // frames apply the deceleration curve toward the target angle.
      setTransform(visualNow, "none");
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setTransform(finalRotation, `transform ${DECEL_MS}ms cubic-bezier(0.12, 0.78, 0.22, 1)`);
        rotationRef.current = finalRotation;
      }));

      doneTimerRef.current = window.setTimeout(() => {
        const prize = prizesRef.current[targetIndex];
        if (prize) {
          if (prize.isWin) playWin(); else playLose();
          onCompleteRef.current(prize);
        }
      }, DECEL_MS + 100);
    }
  }, [spinning, targetIndex]);

  useEffect(() => () => {
    if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    ticksCancelRef.current?.();
  }, []);

  const startPress = () => {
    if (!onLogoLongPress) return;
    pressTimer.current = window.setTimeout(() => onLogoLongPress(), 5000);
  };
  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const size = 360;
  const r = size / 2;
  const cx = r, cy = r;
  const N = Math.max(prizes.length, 1);
  const iconR = r * (N <= 6 ? 0.6 : N <= 8 ? 0.58 : N <= 10 ? 0.56 : 0.54);
  const chord = 2 * iconR * Math.sin(Math.PI / N);
  const radialOuter = r - iconR - 6;
  const radialInner = iconR - r * 0.22 - 6;
  const iconRadius = Math.max(
    14,
    Math.min(44, (chord / 2) * 0.88, radialOuter, radialInner),
  );
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
              style={{
                willChange: "transform",
                transformOrigin: "center",
              }}
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

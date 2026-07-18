// Tiny synthesized sound utility using the Web Audio API.
// No external assets required.

let ctx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

export function isSoundEnabled() {
  return enabled;
}

function tone(opts: {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  startAt?: number;
  endFreq?: number;
}) {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac) return;
  const t0 = (opts.startAt ?? ac.currentTime);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(opts.endFreq, t0 + opts.duration);
  const peak = opts.gain ?? 0.18;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + opts.duration + 0.02);
}

export function playClick() {
  tone({ freq: 900, duration: 0.08, type: "triangle", gain: 0.12 });
}

export function playTick() {
  tone({ freq: 1400, duration: 0.04, type: "square", gain: 0.08 });
}

export function playWin() {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  // Cheerful arpeggio C5-E5-G5-C6
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone({ freq: f, duration: 0.35, type: "triangle", gain: 0.2, startAt: t + i * 0.12 }),
  );
  // little sparkle
  tone({ freq: 1568, duration: 0.5, type: "sine", gain: 0.12, startAt: t + 0.55 });
}

export function playLose() {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  tone({ freq: 392, duration: 0.25, type: "sine", gain: 0.18, startAt: t });
  tone({ freq: 261.6, duration: 0.45, type: "sine", gain: 0.18, startAt: t + 0.18 });
}

// Schedule deceleration-aware ticks across the spin duration.
// Returns a cancel function.
export function startSpinTicks(durationMs = 5200) {
  if (!enabled) return () => {};
  let cancelled = false;
  const start = performance.now();
  const tickAt = (elapsed: number) => {
    if (cancelled) return;
    playTick();
    const progress = elapsed / durationMs;
    if (progress >= 1) return;
    // ease-out: gap grows from ~50ms to ~280ms
    const gap = 50 + Math.pow(progress, 1.8) * 230;
    const next = elapsed + gap;
    setTimeout(() => tickAt(next), gap);
  };
  setTimeout(() => tickAt(0), 0);
  return () => {
    cancelled = true;
  };
}

// ─── Scratch-card sounds ───────────────────────────────────────────────────────

/** Short burst of white noise that sounds like scratching paper/foil.
 *  Call this on each pointermove while scratching (external throttle required). */
export function playScratching() {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac) return;

  // Short burst of filtered noise
  const bufSize = Math.ceil(ac.sampleRate * 0.055);
  const buffer  = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data    = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src    = ac.createBufferSource();
  src.buffer   = buffer;

  // Band-pass to give it a raspy metallic quality
  const bp         = ac.createBiquadFilter();
  bp.type          = "bandpass";
  bp.frequency.value = 3200;
  bp.Q.value       = 0.8;

  const g = ac.createGain();
  const t = ac.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

  src.connect(bp).connect(g).connect(ac.destination);
  src.start(t);
  src.stop(t + 0.06);
}

/** Short riffling burst — sounds like shuffling a deck of cards. */
export function playCardShuffle() {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac) return;

  // Two very short noise bursts in quick succession to mimic card riffle
  for (let burst = 0; burst < 2; burst++) {
    const bufSize = Math.ceil(ac.sampleRate * 0.035);
    const buffer  = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data    = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src    = ac.createBufferSource();
    src.buffer   = buffer;

    const hp      = ac.createBiquadFilter();
    hp.type       = "highpass";
    hp.frequency.value = 1800;

    const g = ac.createGain();
    const t0 = ac.currentTime + burst * 0.055;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.032);

    src.connect(hp).connect(g).connect(ac.destination);
    src.start(t0);
    src.stop(t0 + 0.04);
  }
}

/** Heavier thud — card being selected / tapped. */
export function playCardPick() {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  // Low thud
  tone({ freq: 140, duration: 0.12, type: "sine",     gain: 0.28, startAt: t, endFreq: 80 });
  // Thin click on top
  tone({ freq: 2200, duration: 0.04, type: "triangle", gain: 0.08, startAt: t });
}

/** Sparkle chime played when the scratch card fully reveals its prize. */
export function playScratchReveal(isWin: boolean) {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;

  if (isWin) {
    // Rising shimmer: quick upward sweep
    tone({ freq: 880,    duration: 0.18, type: "sine",     gain: 0.22, startAt: t,        endFreq: 1760 });
    tone({ freq: 1046.5, duration: 0.30, type: "triangle", gain: 0.18, startAt: t + 0.12 });
    tone({ freq: 1318.5, duration: 0.30, type: "triangle", gain: 0.18, startAt: t + 0.22 });
    tone({ freq: 1568,   duration: 0.40, type: "sine",     gain: 0.14, startAt: t + 0.32 });
  } else {
    // Soft low thud
    tone({ freq: 220, duration: 0.35, type: "sine", gain: 0.15, startAt: t,        endFreq: 110 });
    tone({ freq: 180, duration: 0.40, type: "sine", gain: 0.10, startAt: t + 0.20 });
  }
}

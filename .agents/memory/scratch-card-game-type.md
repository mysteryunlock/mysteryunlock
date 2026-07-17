---
name: Scratch Card / game_type field
description: game_type in theme JSONB, Phase 2A animation + audio + analytics architecture
---

## game_type field
- Stored in `theme` JSONB column — `game_type: "spin" | "scratch"` (no migration)
- Entry route `/s/$slug` reads it and navigates to `/spin` or `/scratch`
- `spinAndRecord` is unchanged — works for both

## Phase 2A implementation (July 2026)
All changes are purely frontend. Backend is frozen.

### ScratchCard.tsx architecture
- Prize canvas (bottom) → CSS shimmer div (middle) → foil overlay canvas (top)
- Shimmer: `.animate-foil-shimmer` CSS class on a `pointer-events-none` div between layers; fades out via `opacity` transition on `started` state
- Foil canvas: **NOT conditionally rendered** — kept in DOM so CSS transition plays. Controlled via React inline styles: `opacity/transform` + `cubic-bezier(0.34,1.56,0.64,1)` spring easing
- Critical fix: the old `{!completed && <canvas />}` pattern unmounted the canvas before the CSS fade could play. New approach: always render, CSS-drive visibility.
- Particles: 10 DOM divs in rotated parents (`rotate(Ndeg)`) + child `translateY(-110px)` for radial burst; `.animate-particle-burst` keyframe
- Vibration: `navigator.vibrate([60,30,60])` on win, `[40]` on lose
- Navigate after 700ms (was 500ms) to allow full spring animation

### CSS keyframes added to styles.css
- `foil-shimmer` — animates `background-position` (-150% → 250%) on 250%-wide gradient
- `particle-burst` — translateY(0) → translateY(-110px) + opacity 1→0
- `skeleton-shimmer` — translateX(-100%) → translateX(400%) sweep for loading states
- All added to `prefers-reduced-motion` suppress block

### Analytics (src/lib/analytics.ts)
- New file: thin `window.dataLayer` push (GTM-compatible, zero deps)
- `trackGameStarted(game_type, shop_slug, code)` — called on button tap
- `trackGameCompleted(game_type, shop_slug, code, won)` — called in handleComplete
- Code only stores last 4 chars (`code_tail`) — never the full code

### Audio (sounds.ts — unchanged)
- `playScratching()` already throttled via `SCRATCH_SOUND_MS = 80ms`
- `completedRef.current` check in `enqueueScratch` stops sounds on completion
- `playScratchReveal(isWin)` → 220ms delay → `playWin()` / `playLose()`

**Why:** CSS spring easing on an unmounted canvas plays no animation. The canvas must stay in DOM for the transition to work.

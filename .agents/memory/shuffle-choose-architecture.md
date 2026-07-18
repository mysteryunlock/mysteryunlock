---
name: Shuffle & Choose architecture
description: How the Scratch Card 3.0 "Shuffle & Choose" game is structured (route, components, phase machine)
---

# Shuffle & Choose — Scratch Card 3.0

## Key design decision
`spinAndRecord` fires **when the user presses START SHUFFLE**, not on card pick and not on page load.
The prize is determined and stored in route state BEFORE any animation plays.
Card selection is purely cosmetic — the backend outcome cannot be influenced by which card the user taps.

## Phase machine (route-level)
```
idle → resolving (spinAndRecord in-flight) → flipping → shuffling → choosing → chosen → scratching → revealing → done
```
ROUTE_TO_DECK maps route phase → DeckPhase prop sent to ShuffleChooseDeck.

## Key components
- `ShuffleCard.tsx` — single card; 3D flip via Framer Motion rotateY on preserve-3d wrapper; `CardState` union drives face/rotation/opacity
- `ShuffleChooseDeck.tsx` — manages cardOrder (Fisher-Yates shuffle every 380 ms), cardRotations, revealedPositions; calls onFlipComplete after staggered flip, onShuffleComplete after 9-12 shuffles
- `s.$slug.scratch.tsx` — route; phase machine, spinAndRecord call, ScratchCard overlay (AnimatePresence), navigation
- `ScratchCardSection.tsx` (dashboard) — merchant preview with animated flip preview (every 2.2 s), validation, how-it-works callout

## ScratchCardSection: removed onEditColors prop
The old ScratchCardSection had `onEditColors`. The redesigned one does not — CampaignHub no longer passes it.
WheelSection still receives `onEditColors` (that prop is on WheelSection, not ScratchCardSection).

## Server fn return type
`doSpin` (useServerFn of spinAndRecord) returns unknown; must cast:
`as { ok: boolean; prize: { id: string } }` before accessing `.ok` and `.prize.id`.

## Minimum card count
Route validates `prizes.length >= 3` before rendering the deck; shows an error if fewer.

## CSS
`animate-card-glow` keyframe added to src/styles.css for the selected card pulsing orange ring.
Also added to the prefers-reduced-motion suppression block.

**Why:** Purely cosmetic shuffle prevents any probability manipulation while still giving customers an engaging "choice" interaction.

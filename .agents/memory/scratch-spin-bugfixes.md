---
name: Scratch & Spin campaign bug audit
description: Bugs found and fixed across s.$slug.scratch, s.$slug.spin, ShuffleChooseDeck, ShuffleCard, ScratchCard.
---

## Rules established from this audit

### MuteToggle pattern (both game routes)
**Rule:** Never call state setters inside a `useState` lazy-initializer. It runs during render.
**How to apply:** Initialise the value in `useState(() => { ... return value })` (pure read). Use `useEffect(() => { sideEffect(); }, [])` for first-mount side-effects like syncing an external engine.
**Why:** `useState(() => { setMuted(x); setSoundEnabled(y); })` calls setters mid-render → React warning, potential double-execution in Strict Mode.

### Sound deduplication between ScratchCard and ShuffleChooseDeck
**Rule:** `playWin()` / `playLose()` must only fire from ONE owner. ScratchCard.triggerReveal owns them (fires at 220 ms after threshold). ShuffleChooseDeck must NOT call them again when entering the `revealing` phase.
**Why:** triggerReveal fires first (~220 ms), then onComplete fires at 700 ms, then phase transitions to "revealing". Without this rule, sounds play twice.
**How to apply:** Keep win/lose sounds only in ScratchCard.tsx. ShuffleChooseDeck revealing effect may still fire confetti, deck shake, and haptics.

### Missing import after refactor
**Rule:** After editing any function in a route file (e.g. converting `useState`→`useEffect`), verify the required hook is in the `import { ... } from "react"` list.
**Why:** The scratch route file only imported `{ useState, useCallback, useRef }` — adding `useEffect` to MuteToggle without updating the import causes a compile error.

### cards useMemo dependencies (ShuffleChooseDeck)
**Rule:** The `cards` useMemo that calls `prizeAt()` must include both `prizes` and `prizeAt` in its deps array (alongside the eslint-disable comment).
**Why:** `prizeAt` closes over `prizes` and `resolvedPrize`. If `prizes` refetches, cards memo would serve stale prize names/images/icons.

### Dead imports after fixing duplicate sounds
**Rule:** After removing `playWin`/`playLose` calls from ShuffleChooseDeck's revealing effect, remove them from the import line too.
**Why:** Dead imports cause linting noise and could mislead future engineers into thinking they are used somewhere in the file.

### ShuffleCard selected-state label
**Rule:** When a card is in the "selected" state (spinAndRecord in-flight), show "CHECKING…" not "TAP TO SCRATCH".
**Why:** The ScratchCard overlay appears automatically after the server responds — the user does not tap the card face. "TAP TO SCRATCH" implies a tap is needed and confuses users.

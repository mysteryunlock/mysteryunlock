---
name: Scratch Card / game_type field
description: Architecture decisions for the Scratch Card campaign type and the game_type extensibility field.
---

## Rule
New prize-reveal mechanics are gated by `theme.game_type` in the `campaigns` table (JSONB, no migration required). Default is `"spin"` when absent.

## Values
- `"spin"` — Spin Wheel (original, default)
- `"scratch"` — Scratch Card

## How to apply
- To add a future mechanic: add value to `z.enum` in `themeSchema` (campaigns.functions.ts), create `/s/$slug/{type}.tsx` route, create component, add case to the `interactionRoute` selector in `s.$slug.index.tsx`.
- Backend (spinAndRecord, prize_claims, access_codes, analytics) is completely unchanged for all game types.
- Customer portal history and CRM pick up new types automatically.

## Key decisions
- `game_type` chosen over `interaction_type` (too generic) and `campaign_type` (would collide with a future business-level campaign dimension like loyalty vs. referral).
- No DB migration: `theme` column is already JSONB; themeSchema uses `.partial().default({})` so adding optional fields is zero-risk.
- Prize selected server-side by `spinAndRecord` before any animation: scratch is purely cosmetic, identical to spin.

**Why:** Extensibility without schema changes; one discriminator controls the entire customer journey routing.

---
name: Minimum Probability Enforcement
description: How per-shop minimum prize probability is stored, enforced, and administered
---

## Schema
- `shops.minimum_probability NUMERIC DEFAULT 5 CHECK (>= 0 AND <= 100)` — added via migration 20260718100000
- `admin_audit_log` table — records every admin change with old_value/new_value JSONB, RLS = no client access

## Enforcement layers

### Backend (prizes.functions.ts)
- `upsertPrize`: after assertOwner, fetches shop's minimum_probability, rejects if `probability > 0 && probability < minProb`
- `updateProbabilities`: same fetch+check across all probs in the batch
- 0 is always allowed (semantics: prize disabled / weight 0 = never selected naturally)
- Error message pattern: "Prize probability must be at least X. Contact the platform administrator..."

### Frontend (PrizesTab.tsx)
- Reads `shop.minimum_probability` (default 0 if missing for backward compat)
- Modal save(): same 0-exempt check before submitting
- `saveProbs()`: checks all prizes before calling updateProbabilities
- Slider: `min={p.probability === 0 ? 0 : minProb}` — slider won't drag into the forbidden zone
- Helper text under weight input: "Minimum allowed: X%"

### Admin (super-admin.tsx)
- `MinProbSection` component in shop details modal, between SubscriptionSection and Prizes
- Calls `setShopMinimumProbability` server fn (isSuperAdmin guard)
- Writes audit record to admin_audit_log via supabaseAdmin (service role)
- Component re-fetches shop details after save to keep UI in sync

## What NOT to change
- Prize selection algorithm (pickWinnerForSlug) — untouched
- Campaign structure, QR codes, access codes, customer portal — untouched

**Why:** 0 = "disabled prize" is a long-standing convention in this codebase (pool fallback in pickWinnerForSlug). Minimum only applies to prizes actively in the draw.

**How to apply:** When adding new prize write paths, always fetch shop.minimum_probability and apply the same `probability > 0 && probability < minProb` guard.

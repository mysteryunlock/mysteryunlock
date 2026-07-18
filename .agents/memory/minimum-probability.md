---
name: Minimum probability enforcement
description: shops.minimum_probability field — how it's enforced on client and server, and the 0 = disabled-prize exception.
---

## Rule
`shops.minimum_probability` (NUMERIC DEFAULT 5, 0–100) sets the floor for prize weights in a shop.

**probability = 0 is always allowed** — it means "disabled prize" and bypasses the minimum entirely.  
**probability > 0 && < minimum_probability is blocked** at both client and server.

## Migration
`20260718100000_site_settings.sql` must be applied manually via Supabase SQL editor.
Includes `admin_audit_log` table for logging changes.

## Server enforcement (prizes.functions.ts)

### prizeInput Zod schema
```ts
probability: z.number().int().min(0).max(1000)  // 0 = disabled, allowed
```

### upsertPrize handler
```ts
const effectiveMin = Number(shopMin);  // no Math.max(…, 1)
if (data.prize.probability > 0 && data.prize.probability < effectiveMin) {
  throw new Error(`Min is ${effectiveMin}%. Set to 0 to disable.`);
}
```

### updateProbabilities validator
```ts
z.array(z.object({ id: z.string(), probability: z.number().int().min(0).max(1000) }))
```

### updateProbabilities handler
```ts
const violations = data.probs.filter((p) => p.probability > 0 && p.probability < effectiveMin);
```

## Client enforcement (PrizesTab.tsx)

```ts
const minProb: number = shop.minimum_probability ?? 5;  // no Math.max(…, 1)
```

Validation allows 0 explicitly:
```ts
if (editing.probability > 0 && editing.probability < minProb) { ... }
const violations = prizes.filter((p) => p.probability > 0 && p.probability < minProb);
```

Slider and number input both use `min={0}`.

## Game visibility (listPrizesBySlug)
0-probability (disabled) prizes are filtered OUT of the game at query time:
```ts
.gt("probability", 0)
```
They never appear in the spin wheel or scratch deck.  
`spinAndRecord` already filters them from the pick pool — consistent with the above.

**Why:** A prize with probability=0 appearing visually in the wheel but never winning is confusing and misleading to customers.

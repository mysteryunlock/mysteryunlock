---
name: Phase 4.5 frozen
description: What was built, what was skipped, and the React 19 silent-undefined pitfall discovered during audit.
---

## Phase 4.5 — Customer Experience & UI Polish (frozen 2026-07-06)

### What was delivered
- `PortalSkeleton.tsx` — PageSkeleton, CardListSkeleton, PrizeCardSkeleton
- `EmptyState.tsx` — reusable zero-state with optional action button
- `HistoryFilters.tsx` — result/shop/period filters + pure `applyHistoryFilters` fn
- `portal.prizes.$claimId.tsx` — Prize Detail page (QR, claim code, expiry, status)
- `portal.tsx` — 4-stat grid, unclaimed badge, nav cards
- `portal.history.tsx` — filter bar, month grouping, empty states
- `portal.prizes.tsx` — expiring-soon banner, filter tabs with badge
- `portal.profile.tsx` — avatar, Member Since, account section
- `CustomerPortalHeader.tsx` — unclaimed count badge on Prizes tab
- `PrizeClaimCard.tsx` — expiry highlight, View Details button
- `SpinHistoryCard.tsx` — win tint, claim badge links to detail page (link hidden when no claim.id)
- `ClaimsTab.tsx` — inline confirm-row replaces window.confirm()

### Skipped (no backend support, backend is frozen)
- Notification preference toggle — `updateMyProfileFn` only accepts name/phone
- Redemption instructions on detail page — not in `getMyPrizeClaimsFn` select or PrizeClaim type

### Key audit lesson: React 19 silent undefined
In React 19, a component that returns `undefined` (no return statement) renders silently as nothing — no runtime error, no TypeScript error (unless return type is explicitly annotated). TypeScript infers `void` and React 19 accepts it. This caused SpinHistoryCard to render nothing until caught by audit.

**Why:** React 18 threw "Nothing was returned from render" for undefined returns. React 19 relaxed this. TypeScript followed.

**How to apply:** Always add an explicit return type annotation (`): JSX.Element`) or use `React.FC<Props>` on components to catch missing returns at compile time.

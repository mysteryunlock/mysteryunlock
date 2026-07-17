---
name: Merchant Control Center redesign
description: Architecture decisions for the CampaignHub → Merchant Control Center UI redesign (Phase 3).
---

# Merchant Control Center

## What changed
`CampaignHub.tsx` was fully redesigned into a Merchant Control Center. `ui.tsx` gained 5 new reusable components.

## Key architectural decisions

### onNavigateTab prop (additive)
`CampaignHub` gained `onNavigateTab?: (tab: TabKey) => void`. `dashboard.tsx` passes `onNavigateTab={setTab}`. This allows the Customers, Analytics, and Marketing hub cards to switch top-level dashboard tabs without any routing change.

**Why:** CampaignHub previously had no way to switch dashboard tabs. The same pattern already existed for `OverviewTab` (`onNavigate={setTab}`).

**How to apply:** Any new hub card that links to an existing dashboard tab should call `onNavigateTab?.(tabKey)` — never use a route navigate.

### Section navigation unchanged
Internal `HubSection` type (`"overview" | "prizes" | "wheel" | "qr-codes" | "settings"`) is unchanged. `setSection` drives the sub-section render. Sub-components (PrizesTab, WheelSection, ScratchCardSection, QrTab, CodesTab, SettingsTab) were **not touched**.

### New reusable components in ui.tsx
- `MerchantHubCard` — nav card (emoji, title, description, chevron; `comingSoon` variant)
- `MerchantStat` — compact stat cell (label + large value + optional icon)
- `HubSectionHeader` — breadcrumb back button + section title (44px touch target)
- `StatusBadge` — Active/Paused pill with CircleDot
- `HubOverviewSkeleton` — shimmer skeleton for the hub overview loading state

### Coming Soon cards
Two disabled cards at the bottom: Rewards (🎁) and Automation (🤖). They use `comingSoon` prop on `MerchantHubCard`. No functionality, no onClick. Future modules slot in by removing `comingSoon`.

### Pre-existing TypeScript errors
`CampaignHub.tsx` inherits 5 pre-existing TS errors from the original file:
- 4× `'r' is of type 'unknown'` in `.then()` callbacks of useServerFn results
- 1× `'is_active' does not exist` in the `doUpdate` call type

These are not new — they existed at different line numbers in the original 295-line file.

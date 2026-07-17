---
name: Per-Campaign Codes & QR Architecture
description: How access codes and QR codes are scoped per-campaign and how auto-routing works
---

## The root cause
`access_codes.campaign_id` existed in the DB but UI never passed it during code generation, and `validateAccessCode` never returned it. QR URLs lacked `?c=slug`. Result: multi-campaign shops forced customers to manually pick a campaign.

## What was changed (additive only, no schema changes)

### Server: `src/lib/access-codes.functions.ts`
- `validateAccessCode` — on valid code, looks up its `campaign_id` → fetches campaign `slug` → returns `campaignSlug: string | null` in the ok response
- `listAccessCodes` — added optional `campaignId` filter (backwards compatible; callers without it get full shop list)
- `deleteUnusedCodes` — added optional `campaignId` filter (scopes delete to campaign when provided)

### Dashboard: CodesTab + QrTab + CampaignHub
- `CodesTab` now requires `campaignId` and `campaignSlug` props; all operations (generate, list, delete) are scoped to the campaign; CSV download named after campaign slug
- `QrTab` now requires `campaign: { id, slug, name } | null` prop; campaign QR = `/s/slug?c=campaign-slug`; per-code QRs = `/s/slug?c=campaign-slug&code=CODE`
- `CampaignHub` passes `activeCampaignId`/`activeCampaign` into both tabs; shows CampaignPicker in qr-codes section; codes overview stats re-fetch when active campaign changes

### Customer entry: `src/routes/s.$slug.index.tsx`
- After code validation, uses `res.campaignSlug ?? campaignSlug ?? null` as `resolvedCampaignSlug`
- Navigates with `?c=resolvedCampaignSlug` — no manual picker involved
- Fallback chain: server-authoritative campaignSlug → URL ?c= param → default/first campaign

## DB migration
`supabase/migrations/20260717100000_backfill_code_campaign_ids.sql` — backfills `campaign_id IS NULL` rows to the shop's default campaign. Safe/idempotent, must be applied manually via Supabase SQL editor.

## Why it scales
Each campaign is fully self-contained: codes know their campaign at generation time, QR encodes the campaign slug, validation returns the campaign slug, entry route routes directly. Adding campaign N costs O(1) — no global state, no pickers, no ambiguity.

**Why:** `campaign_id` was nullable by design but the UI never enforced it; every code must be assigned at generation time and is immutable thereafter.

**How to apply:** Always pass `campaignId` when calling `generateAccessCodes`, `listAccessCodes`, `deleteUnusedCodes`. Always use `res.campaignSlug` from `validateAccessCode` for routing.

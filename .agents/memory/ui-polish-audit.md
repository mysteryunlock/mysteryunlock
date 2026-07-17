---
name: UI Polish Audit Completion
description: Btn DS migration + confirm()→ConfirmModal sweep details and pitfalls
---

## What was done
Full UI polish audit pass across the Mystery Unlock codebase:

### Btn DS migration (17 files)
All `bg-[#FF6B1A] hover:bg-[#e85f00]` raw buttons replaced with `<Btn variant="primary">`. Files touched: CampaignHub, CampaignEditor, CustomerCrm, SettingsTab, CustomerHubTab, WheelSection, MarketingHub, MarketingScheduled, MarketingTemplates, MemberPurchasesSection, RecordsTab, ShopConnectionsTab, StatsTab, ui.tsx, campaigns.tsx, billing.tsx, member.$code.tsx, reset-password.tsx, customer-auth.tsx.

**billing.tsx plan button**: highlighted plan branch uses `gradient-primary hover:opacity-95` CSS class (same as Btn primary variant) instead of `bg-[#FF6B1A] hover:bg-[#e85f00]` to avoid complex conditional Btn variant logic.

### confirm() → ConfirmModal (9 files)
Files with browser `confirm()` converted to DS `<ConfirmModal>` with state:
- CodesTab (delete unused codes)
- PrizesTab (delete prize → `deleteId: string | null` state)
- MarketingHub (bulk SMS/WA → `smsConfirmOpen`/`waConfirmOpen`)
- MarketingScheduled (cancel broadcast → `cancelConfirmId`)
- MarketingTemplates (delete template → `deleteTemplateId`)
- RecordsTab (3 confirms: bulk delete, reset all, single delete)

super-admin.tsx `confirm()` calls intentionally left as-is (admin-only panel).

## Critical pitfall
**RecordsTab has a `CustomerProfile` sub-component defined in the same file after the main component.**
When adding ConfirmModals to RecordsTab's JSX return, the anchor strings `</div>\n  );\n}` match BOTH RecordsTab's closing AND CustomerProfile's closing. Always use context from lines well above the final `</div>` (e.g., the `{/* Profile drawer */}` block) to uniquely identify RecordsTab's return end.

## Verification grep (all should return zero hits in src/):
- `grep -rn "hover:bg-\[#e85f00\]" src/ --include="*.tsx"`
- `grep -rn "FF7A00\|ff7a00" src/`
- `grep -rn "Poppins" src/`
- `grep -rn "[^_a-zA-Z]confirm(" src/ --include="*.tsx"` (excluding super-admin, comments, modal.tsx)

**Why:** DS consistency — all interactive primary actions must use the `<Btn>` component and its `gradient-primary` styling; browser `confirm()` dialogs break the design system and accessibility.

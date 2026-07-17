---
name: QA Audit Emoji/Alert Baseline
description: Post-QA-audit baseline state — what is intentionally kept vs what was fixed
---

## Fixed (now zero)
- `alert()` calls outside super-admin
- `[DEBUG portal/shops]` console.log/error statements
- `⚠` / `⚠️` as raw text/emoji in UI error states and warnings
- `★` / `▾` as raw Unicode in dropdown UI
- `🏆` in EmptyState icon props
- `🛍️` in EmptyState icon props
- `☝` in scratch card hint text

## Intentionally kept (do not touch)
- `🎉` `🎁` in SMS/WhatsApp template body text (user content)
- `🎁` in email template subjects (user content)
- `🏆` `🎱` drawn via canvas context in ScratchCard.tsx (game mechanic)
- `🎉` `🎯` in landing page demo modal (demo content per user instruction)
- `🎉` in transient connection success messages (portal.tsx, connect.$code.tsx)
- `🎉` in WhatsApp/SMS share strings on result page (user share content)
- `★` in landing page rating stats ("4.9★") — marketing copy
- `★` in Pricing.tsx — marketing copy
- `confirm()` in super-admin.tsx — platform-admin tool, acceptable

**Why:** These categories were explicitly listed as out-of-scope by the user: "user-generated content, SMS templates, WhatsApp messages, demo/chat content."

## Verification commands (all should return zero)
```
grep -Prn "\balert\(" src/ --include="*.tsx" | grep -v "super-admin|//|modal\.tsx|AlertTriangle"
grep -Prn "console\.(log|error).*DEBUG" src/ --include="*.tsx" --include="*.ts"
```

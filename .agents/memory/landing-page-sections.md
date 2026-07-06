---
name: Landing Page 2.0 sections
description: Complete record of all Landing Page 2.0 components built, their locations, and data file conventions.
---

## Components built (in render order, all in src/components/landing/)

| Component | File | Data file | Status |
|---|---|---|---|
| Hero | Hero.tsx | — | ✅ |
| WhyChooseUs | WhyChooseUs.tsx | — | ✅ |
| HowItWorks | HowItWorks.tsx | — | ✅ |
| Features | Features.tsx | — | ✅ |
| DashboardPreview | DashboardPreview.tsx | — | ✅ |
| CustomerExperience | CustomerExperience.tsx | — | ✅ |
| RealResults | RealResults.tsx | — | ✅ |
| IndustryShowcase | IndustryShowcase.tsx | — | ✅ |
| WhoItsFor | WhoItsFor.tsx | — | ✅ |
| HowToLaunch | HowToLaunch.tsx | — | ✅ |
| Pricing | Pricing.tsx | src/data/pricing.ts | ✅ |
| FAQ | FAQ.tsx | src/data/faq.ts | ✅ |
| FinalCTA | FinalCTA.tsx | — | ✅ |

## Data files (src/data/)
- **pricing.ts** — PLANS (3), COMPARISON_ROWS (17), PAYMENT_METHODS (5), TRUST_BADGES (4)
- **faq.ts** — FAQ_ITEMS (23 across 5 categories), FAQ_CATEGORIES

## Render location
`src/routes/index.tsx` — all Landing 2.0 components render after the old sections that remain (Wheel Demo, old How It Works), before the Footer.

## Design conventions
- Brand tokens: `dark: #2A3E4B`, `mid: #7FA6B8`, `light: #D6E6EF`, `bg: #F7FBFD`, `accent: #FF6B00`
- Foundation imports: SectionContainer, FoundationCard (hover="lift"), FoundationBadge, PrimaryButton, OutlineButton
- FoundationCard hover prop is `"lift"` not boolean
- All decorative SVG/icon elements use `aria-hidden`
- Spinning/animated decorative elements must include `motion-reduce:animate-none`
- Internal CTAs use `<Link to="/auth">`, external use `<a href="...">`

**Why:** These conventions were established across all Landing 2.0 sections to maintain visual consistency and pass code review.

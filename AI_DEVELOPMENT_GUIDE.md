# AI Development Guide — Mystery Unlock

This document guides every future AI coding session on this project. Read it before making changes.

---

## 1. Project Overview

**Mystery Unlock** is a SaaS loyalty and customer engagement platform. Shop owners create branded spin-to-win prize wheels, share a QR code with customers, and track every winner from a dashboard.

The platform serves two user types:

- **Customers** — scan a QR code / visit a shop link, enter an access code, spin the wheel, and receive a prize.
- **Shop Owners** — sign up, brand their wheel, manage campaigns and prizes, generate access codes, message customers, and view analytics from a dashboard.

**Future roadmap** (design and build with this direction in mind, even when not yet implemented):

- Customer Portal (accounts, spin history, saved prizes)
- CRM (customer relationship tools for shop owners)
- Marketplace (cross-shop discovery/rewards)
- AI Assistant (in-app help / campaign optimization)
- Mobile Apps

When adding new features, prefer designs and data models that won't need to be thrown away when these land.

---

## 2. Development Principles

- **Never modify authentication unless explicitly requested.** This includes `src/routes/auth.tsx`, `auth.callback.tsx`, `reset-password.tsx`, `src/lib/auth.functions.ts`, `src/lib/pending-signups.functions.ts`, and `src/integrations/supabase/auth-middleware.ts` / `auth-attacher.ts`.
- **Never modify the Supabase schema unless explicitly requested.** This includes anything in `supabase/migrations/`, RLS policies, and `src/integrations/supabase/types.ts` (auto-generated — regenerate, don't hand-edit).
- **Never remove existing features without approval.** If a change appears to require removing something, stop and ask first.
- **Prefer reusable components over duplicated code.** Check `src/components/foundation/` and `src/components/ui/` before writing new markup.
- **Keep components small and modular.** Avoid growing any single file into a monolith (see existing tech debt in Section 3 — don't add to it).
- **Maintain responsive design.** Every new UI must work at mobile, tablet, and desktop widths.
- **Preserve performance.** Don't introduce heavy client-side work on hot paths (e.g. the spin wheel animation, dashboard data tables). Prefer lazy-loading for rarely used, heavy dependencies (see `canvas-confetti`'s dynamic import as precedent).

---

## 3. Folder Conventions

```
src/
├── routes/                  # File-based routes (TanStack Router). One file = one route.
│   ├── index.tsx             # Public landing page
│   ├── auth.tsx, auth.callback.tsx, reset-password.tsx   # Auth pages — do not touch casually
│   ├── contact.tsx, privacy.tsx, terms.tsx, trust.tsx     # Static/legal pages
│   ├── s.$slug*.tsx          # Public customer-facing spin flow
│   └── _authenticated/       # Auth-gated routes (guarded by _authenticated/route.tsx)
│       ├── dashboard.tsx, campaigns.tsx, billing.tsx, super-admin.tsx
│
├── components/
│   ├── ui/                   # shadcn/Radix primitives (Button, Card, Dialog, etc.)
│   │                          # Low-level, generic. Extend variants here only for truly
│   │                          # generic needs shared by the whole app.
│   ├── foundation/            # Mystery Unlock UI Foundation — reusable, brand-styled
│   │                          # building blocks composed on top of ui/. Prefer this for
│   │                          # any new marketing/dashboard UI. Organized by category:
│   │   ├── buttons/            # PrimaryButton, SecondaryButton, OutlineButton, HeroButton
│   │   ├── cards/               # Card, StatCard, FeatureCard
│   │   ├── layout/               # SectionContainer, Navbar, Footer
│   │   └── feedback/              # Badge, EmptyState, LoadingSkeleton
│   ├── dashboard/              # Dashboard-tab-specific components (OverviewTab, StatsTab, etc.)
│   └── Footer.tsx, SpinWheel.tsx, MessagingTab.tsx   # Existing shared components — reuse,
│                                                        don't fork, unless asked to replace them
│
├── lib/                       # Server functions ("API" layer) + utilities
│   ├── *.functions.ts          # TanStack Start server functions (one file per domain:
│   │                            shops, campaigns, prizes, access-codes, messaging, etc.)
│   └── utils.ts                # cn() helper and shared utilities
│
├── integrations/supabase/     # Supabase client setup, auth middleware, generated types
├── hooks/                     # Shared React hooks
├── assets/                    # Images/logos
└── styles.css                 # Tailwind v4 theme tokens (source of truth for design)

supabase/migrations/           # Schema of record — chronological SQL migrations
artifacts/mockup-sandbox/      # Isolated design-preview tool, not part of the shipped app
```

**Where to put new components:**

| Kind of component | Location |
|---|---|
| Generic, app-wide primitive (new shadcn component) | `src/components/ui/` |
| Brand-styled, reusable building block (button, card, section, badge, empty state, etc.) | `src/components/foundation/<category>/` |
| Landing-page-specific section (Hero, Pricing, FAQ, etc.) | `src/components/landing/` (create if it doesn't exist yet) |
| Dashboard-tab-specific UI | `src/components/dashboard/` |
| One-off, route-only markup | Keep inline in the route file only if small; extract otherwise |

---

## 4. Coding Standards

- **TypeScript** everywhere — no implicit `any`. Export prop types alongside components (e.g. `export interface FooProps`).
- **React** — function components with hooks. Use `React.forwardRef` for components that wrap a DOM element and may need a ref (matches existing `ui/` and `foundation/` conventions).
- **TanStack Router** — routes are file-based under `src/routes/`. Data loading goes in a route's `loader`; server-only logic goes in `src/lib/*.functions.ts` as TanStack Start server functions, not inline in components.
- **Tailwind CSS v4** — CSS-first config (no `tailwind.config.js`); theme tokens live in `src/styles.css`. Use utility classes and existing theme tokens (`bg-primary`, `text-accent`, `font-display`, etc.) instead of inline styles or one-off hex codes.
- **Naming conventions**:
  - Components: `PascalCase.tsx`, one component per file (co-locate tightly related sub-components, e.g. `CardHeader` inside `Card.tsx`).
  - Server functions: `camelCase` inside `*.functions.ts` files, grouped by domain.
  - Variant styling: use `cva` (class-variance-authority) for components with multiple visual variants, matching existing `button.tsx` / `badge.tsx` patterns.
- **Reusable UI components** — before building new markup, check `src/components/foundation/` and `src/components/ui/` first. Compose from there rather than duplicating styles.
- Use the `cn()` helper (`src/lib/utils.ts`) for conditional/merged class names — never string-concatenate classes.

---

## 5. Design Rules — Mystery Unlock Design System

Source of truth: `src/styles.css`. Do not introduce a new, divergent color system (a page-local color duplicate already exists as known tech debt on the landing page — don't repeat this pattern).

**Brand colors** (CSS variables, mapped to Tailwind tokens):
- `--primary` (navy) `#0c2340` — primary actions, headings, dark surfaces
- `--accent` / `--gold` (orange) `#ff6b1a` — CTAs, highlights, focus rings
- `--background` / `--card` (white) `#ffffff`
- `--muted` `#f4f6fa`, `--muted-foreground` `#4a5b78` — secondary text/surfaces
- `--border` — subtle navy-tinted border, `rgba(12, 35, 64, 0.12)`
- `--radius` `1rem` — base corner radius for cards/buttons

**Typography:**
- Display/headings: `--font-display` → "Space Grotesk" (tight tracking, `-0.01em`)
- Body: `--font-sans` → "DM Sans"
- Utility class `.font-display` applies the display font explicitly

**Buttons** — use `src/components/foundation/buttons/`:
- `PrimaryButton` — solid navy, for the single most important action
- `SecondaryButton` — subtle neutral background, supporting actions
- `OutlineButton` — bordered/transparent, low emphasis
- `HeroButton` — large gradient + glow CTA, marketing/hero sections only

**Cards** — use `src/components/foundation/cards/`:
- `Card` (+ `CardHeader`, `CardTitle`, `CardDescription`) — general surface
- `StatCard` — metric display
- `FeatureCard` — icon + title + description grid item

**Spacing:**
- Use `SectionContainer` (`src/components/foundation/layout/`) for page-section wrappers — it standardizes max-width and vertical rhythm (`sm`/`md`/`lg` spacing scales).
- Prefer Tailwind's default spacing scale; don't invent arbitrary pixel values unless matching an existing precise design.

**Icons:**
- `lucide-react` exclusively (already the shadcn default in `components.json`).

**Animations:**
- Reuse existing utilities in `styles.css`: `.animate-pulse-gold`, `.animate-slow-spin`, `.animate-float-up`, `tw-animate-css` classes.
- `canvas-confetti` for win celebrations — always dynamically imported, never a static top-level import.
- Respect `prefers-reduced-motion` — existing utilities already disable animation under this setting; new animations should do the same.

---

## 6. Workflow

Before making any change:

1. **Analyze the existing code.** Read the relevant route/component/server-function files before editing. Don't guess at structure.
2. **Reuse existing components where possible.** Check `src/components/foundation/` and `src/components/ui/` first; only create new components when nothing fits.
3. **Explain the implementation plan.** Summarize what will change, which files are affected, and confirm it doesn't touch auth/Supabase/business logic unless that was explicitly requested.
4. **Wait for approval before large refactors.** Small, additive, reversible changes (new component, new route) can proceed directly. Anything that touches multiple existing files, restructures routing, or changes data models should be proposed first.

---

## 7. Testing Checklist

For every change, before considering it done:

- [ ] Check desktop layout (wide viewport).
- [ ] Check mobile layout (narrow viewport / responsive breakpoints).
- [ ] Verify existing functionality still works (manually exercise the affected flow).
- [ ] Ensure no authentication regressions (login, signup, OTP, OAuth, password reset still work if anywhere near the change).
- [ ] Ensure no database/Supabase regressions (RLS policies, server functions, and query shapes are unaffected unless the change explicitly targets them).
- [ ] Confirm no new TypeScript errors were introduced in the files you touched.

# Phase 4.1 — Authentication Architecture Audit

*Mystery Unlock · TanStack Start + Supabase Auth · July 2026*
*Audit only — no files modified.*

---

## Part 1 — Current Authentication Flow

### Overview

The system implements a **two-audience** authentication design in its current form, though only one audience (shop owners) has working auth today. The architecture is:

```
Shop Owner Audience:
  Supabase Auth (email/password + email OTP step-up + Google OAuth)
  → JWT in localStorage → Bearer header on every server-fn RPC
  → requireSupabaseAuth middleware validates JWT server-side
  → RLS enforces data isolation per owner

Customer / Spinner Audience:
  Anonymous today — identified only by access_code URL param
  No login, no account, no session
  Customer PII stored as plain columns in access_codes rows
```

---

## Part 2 — Supabase Authentication Integration

### Client Files

| File | Role |
|---|---|
| `src/integrations/supabase/client.ts` | Browser-side Supabase client. `localStorage` persistence, lazy `Proxy` init, `autoRefreshToken: true`. Used for all client-side auth calls. |
| `src/integrations/supabase/client.server.ts` | Server-side admin client. Uses `SUPABASE_SERVICE_ROLE_KEY`. Bypasses RLS. Used in server functions for privileged operations (email checks, admin mutations). |
| `src/integrations/supabase/auth-middleware.ts` | `createMiddleware({ type: 'function' }).server()` — extracts `Authorization: Bearer <token>`, validates via `supabase.auth.getClaims(token)`, injects `{ supabase, userId, claims }` into server function context. |
| `src/integrations/supabase/auth-attacher.ts` | `createMiddleware({ type: 'function' }).client()` — global middleware (registered in `src/start.ts`). Before every server-fn RPC, retrieves the Supabase access token and attaches it as `Authorization: Bearer <token>`. Handles mobile tab-resume by calling `refreshSession()` if storage has a session but the in-memory token is missing. |

### JWT Validation Detail

```
Client call → attachSupabaseAuth:
  1. supabase.auth.getSession() → access_token
  2. If no token but localStorage has sb-*-auth-token → refreshSession()
  3. Header: { Authorization: "Bearer <token>" }

Server receive → requireSupabaseAuth:
  1. request.headers.get("authorization") → token
  2. createClient(url, publishableKey, { global: { headers: { Authorization } } })
  3. supabase.auth.getClaims(token) → { sub, email, ... }
  4. Inject: context.supabase (user-scoped), context.userId = claims.sub
  5. All subsequent .from() calls run under user's JWT → RLS enforced
```

---

## Part 3 — Login Flow

```
User lands on /auth (mode: "signin")
  │
  ├─ Password sign-in:
  │    supabase.auth.signInWithPassword({ email, password })
  │    → success: check localStorage "mu_last_auth" (timestamp)
  │         │
  │         ├─ TRUSTED (< 3 days): navigate("/dashboard")
  │         │
  │         └─ UNTRUSTED / EXPIRED:
  │              supabase.auth.signOut()   ← signs out the just-established session
  │              supabase.auth.signInWithOtp({ email, shouldCreateUser: false })
  │              step = "signin-otp"
  │                   │
  │                   └─ User enters 6-digit code
  │                        supabase.auth.verifyOtp({ email, token, type: "email" })
  │                        localStorage.setItem("mu_last_auth", Date.now())
  │                        navigate("/dashboard")
  │
  └─ Google OAuth:
       supabase.auth.signInWithOAuth({ provider: "google", redirectTo: origin + "/auth/callback" })
       → redirect to /auth/callback
            if user has shops → navigate("/dashboard")
            if no shops → show "Create Your Shop" form → createShop → navigate("/dashboard")
```

---

## Part 4 — Signup Flow

```
User lands on /auth (mode: "signup")
  │
  ├─ Inputs: Shop Name, Slug, Email, Password
  │
  ├─ Email typo detection (Levenshtein distance ≤ 2 against known domains)
  ├─ Password strength meter (weak/medium/strong)
  │
  ├─ Submit:
  │    checkEmailRegisteredFn (server fn, service role)
  │      → supabaseAdmin checks auth.users for email
  │      → if found: error "email already registered"
  │
  │    supabase.auth.signInWithOtp({ email, shouldCreateUser: true })
  │    step = "signup-otp"
  │    sessionStorage.setItem("otp_state", ...) ← survives mobile tab switch
  │
  ├─ User enters 6-digit OTP
  │    supabase.auth.verifyOtp({ email, token, type: "email" })
  │    → session established
  │    supabase.auth.updateUser({ password }) ← sets password post-OTP
  │    doCreateShop({ name, slug, logoUrl }) ← createShop server function
  │    navigate("/dashboard")
  │
  └─ Pending Approval path (alternate):
       pending_signups table stores { email, password (plain!), shop_name, slug, status: "pending" }
       Super admin reviews → approves/rejects
       (Note: current code stores raw password — security concern, see Part 14)
```

---

## Part 5 — Password Reset Flow

```
User visits /reset-password
  │
  ├─ Step 1 — Request code:
  │    Enter email
  │    supabase.auth.resetPasswordForEmail(email)
  │    → Supabase sends email with 6-digit {{ .Token }} code
  │    sessionStorage.setItem("reset_email", email)
  │    60-second cooldown
  │
  ├─ Step 2 — Verify code:
  │    supabase.auth.verifyOtp({ email, token, type: "recovery" })
  │    onAuthStateChange: "PASSWORD_RECOVERY" or "SIGNED_IN" → verified = true
  │
  └─ Step 3 — Set new password:
       supabase.auth.updateUser({ password: newPassword })
       navigate("/auth")
```

---

## Part 6 — Session Handling

| Mechanism | Detail |
|---|---|
| **Storage** | `localStorage` (Supabase default). Key pattern: `sb-<project-ref>-auth-token` |
| **Auto-refresh** | Supabase SDK handles `autoRefreshToken: true` in browser client |
| **Mobile tab resume** | `auth-attacher.ts` detects stale in-memory session (no token but localStorage has key) → calls `refreshSession()` before attaching header |
| **Device trust** | `localStorage["mu_last_auth"]` = Unix timestamp. On login: if age > 3 days → OTP step-up required |
| **Server-side** | Stateless. Each server-fn call carries a fresh Bearer token. No server-stored sessions. |
| **Sign-out** | `supabase.auth.signOut()` → clears localStorage → navigate to `/auth` |

---

## Part 7 — Protected Routes

```
Routes requiring authentication (/_authenticated group):
  /dashboard       → shop owner dashboard
  /campaigns       → campaign hub
  /billing         → billing / subscription
  /super-admin     → platform admin (additional role check)

Guard mechanism:
  src/routes/_authenticated/route.tsx
    beforeLoad: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });
      return { user: data.user };
    }
  ssr: false — guard runs client-side only
```

---

## Part 8 — Route Middleware

Two middleware layers run on every server function call:

```
Layer 1 — CLIENT (auth-attacher.ts):
  Registered as global functionMiddleware in src/start.ts
  Runs in the browser before the RPC request is sent
  Attaches: Authorization: Bearer <access_token>

Layer 2 — SERVER (requireSupabaseAuth middleware):
  Applied per server function via: .middleware([requireSupabaseAuth])
  Validates Bearer token via getClaims()
  Provides: context.supabase, context.userId, context.claims

No middleware runs on public routes (/, /s/:slug/*, /auth, /reset-password, etc.)
```

---

## Part 9 — User Model

```
auth.users (Supabase managed — not in public schema)
  id: uuid (PK)
  email: text
  user_metadata: jsonb
    full_name: string   ← set on Google OAuth
    name: string        ← set on Google OAuth
    avatar_url: string  ← set on Google OAuth
  created_at, updated_at, last_sign_in_at, etc.

public.user_roles
  id: uuid (PK)
  user_id: uuid → auth.users(id)
  role: app_role enum ('super_admin')
  created_at: timestamptz

⚠ NO public.profiles table exists.
  Owner name is read at runtime: auth.users.user_metadata.full_name || .name || email prefix
```

---

## Part 10 — Shop Ownership Model

```
public.shops
  owner_user_id: uuid → auth.users(id)   ← the ownership link

Verification pattern (assertOwner) — in every mutation server function:
  SELECT id FROM shops
  WHERE id = $shopId AND owner_user_id = $ctx.userId
  → throws "Not authorized" if no row returned

Dashboard load:
  listMyShops() → SELECT * FROM shops WHERE owner_user_id = auth.uid() ORDER BY created_at
  UI: setShop(list[0] ?? null)   ← takes first shop only

Relationship: one auth.user → many shops (schema), but one auth.user → one shop (UI)
Super admin: checked via user_roles table, redirected to /super-admin instead of dashboard
```

---

## Part 11 — Database Tables Related to Authentication

### Schema Overview

```sql
-- Supabase-managed
auth.users              ← all authenticated identities

-- Public schema
public.shops            ← shop entities, linked to auth.users via owner_user_id
public.user_roles       ← role assignments (super_admin)
public.pending_signups  ← pre-approval signup queue (admin-only flow)
```

### Full Column Definitions

**`public.shops`**
```
id                 uuid PK default gen_random_uuid()
owner_user_id      uuid FK → auth.users(id)
name               text NOT NULL
slug               text NOT NULL UNIQUE
logo_url           text
is_active          boolean NOT NULL DEFAULT true
plan               shop_plan enum ('free','pro','lifetime')
subscription_status shop_sub_status enum ('trial','active','past_due','suspended')
trial_ends_at      timestamptz
current_period_end timestamptz
billing_notes      text
created_at         timestamptz NOT NULL DEFAULT now()
updated_at         timestamptz NOT NULL DEFAULT now()
```

**`public.user_roles`**
```
id         uuid PK
user_id    uuid FK → auth.users(id)
role       app_role enum ('super_admin')
created_at timestamptz DEFAULT now()
```

**`public.pending_signups`**
```
id           uuid PK
email        text NOT NULL
password     text NOT NULL   ⚠ plaintext — see security analysis
shop_name    text NOT NULL
slug         text NOT NULL
status       text DEFAULT 'pending' ('pending','approved','rejected')
review_notes text
reviewed_at  timestamptz
reviewed_by  uuid FK → auth.users(id)
created_at   timestamptz DEFAULT now()
```

---

## Part 12 — Existing Profile System

**No profiles table exists.** User identity is handled entirely through:

1. `auth.users.user_metadata` — `full_name`, `name`, `avatar_url` (set by Google OAuth)
2. `auth.users.email` — used as fallback display name (email prefix before `@`)
3. `public.shops.name` — shop display name (separate from owner name)

**Implication for Phase 4:** Any customer profile system must be built from scratch. No profile migration burden exists, but no profile infrastructure exists either.

---

## Part 13 — Existing Customer-Related Tables

**No dedicated `customers` table.** Customer data is co-located with spin events in `access_codes`:

**`public.access_codes`**
```
shop_id          uuid FK → shops(id)    ─┐ Composite PK
code             text                   ─┘
campaign_id      uuid FK → campaigns(id)
customer_name    text      ← entered before spin
customer_contact text      ← phone number (used for SMS/WhatsApp)
customer_email   text      ← email address
is_used          boolean NOT NULL DEFAULT false
prize_won        text      ← prize name (string, not FK)
spun_at          timestamptz
created_at       timestamptz DEFAULT now()
```

**CRM aggregation (runtime computation):**
- Customer key priority: `customer_contact` → `customer_email` → `customer_name` → `code`
- Segments computed in JS: Winner / VIP (≥5 spins) / Multi-Spin (≥2) / New / Lapsed
- No permanent customer ID — same person spinning twice gets two rows

**Other data tables:**

```
public.campaigns       ← id, shop_id, name, slug, is_active, is_default, theme (jsonb)
public.prizes          ← id, shop_id, campaign_id, name, short, image_url, is_win, probability
public.shop_payments   ← billing history
public.subscription_plans ← plan catalog
public.marketing_broadcasts ← broadcast history + scheduled
public.marketing_templates  ← message templates
public.site_settings   ← landing page CMS content
```

---

## Part 14 — Existing RLS Policies

### Policy Matrix

| Table | anon | authenticated (self) | authenticated (owner) | super_admin |
|---|---|---|---|---|
| `shops` | SELECT (is_active) | SELECT own, INSERT own, UPDATE own | — | ALL |
| `user_roles` | ✗ | SELECT own | — | ALL |
| `prizes` | SELECT (active shops) | — | ALL | ALL |
| `access_codes` | DENY (false) | DENY (false) | ALL via svc role | ALL |
| `campaigns` | SELECT (active) | — | ALL | — |
| `shop_payments` | ✗ | SELECT own | — | ALL |
| `subscription_plans` | SELECT (active) | SELECT (active) | — | ALL |
| `site_settings` | SELECT | SELECT | — | ALL |
| `marketing_broadcasts` | ✗ | SELECT+INSERT own | — | — |
| `marketing_templates` | ✗ | — | ALL | — |
| `pending_signups` | DENY (false) | DENY (false) | — | svc role only |

### Key Functions

```sql
private.has_role(user_id uuid, role app_role) → boolean
  -- Queries user_roles table; used in admin policies
  -- Defined in: 20260620074708_d9906f14-...sql

Owner check pattern (inline in most policies):
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = table.shop_id
    AND shops.owner_user_id = auth.uid()
  )
```

### Notable Security Design

- `access_codes` is **fully locked** to direct client access (`USING (false)` for both anon and authenticated). All spin operations go through service-role server functions — this prevents code forgery.
- `pending_signups` is similarly locked — only service role can read/write.
- `marketing_broadcasts` has INSERT but **no UPDATE or DELETE** policy for owners — updates happen via service role in server functions.

---

## Part 15 — Dashboard Protection

Three layers of protection for the shop owner dashboard:

```
Layer 1 — Route guard (/_authenticated/route.tsx):
  supabase.auth.getUser() client-side
  → no user: redirect("/auth")
  Note: ssr: false — this runs only in the browser

Layer 2 — Server function auth (requireSupabaseAuth):
  Every data fetch validates Bearer JWT server-side
  → invalid/missing token: throws "Unauthorized"
  Even if Layer 1 is bypassed, no data is returned

Layer 3 — Ownership assertion (assertOwner):
  Each mutation verifies shops.owner_user_id = auth.uid()
  → prevents cross-shop data access

Super-admin bypass:
  listMyShops detects super_admin role → navigate("/super-admin")
  Super-admin server functions call isSuperAdmin(ctx) before any operation
```

---

## Part 16 — Current Route Architecture

### Complete Route Map

```
PUBLIC ROUTES (no auth required)
─────────────────────────────────
/                           src/routes/index.tsx            Landing page (CMS-driven)
/auth                       src/routes/auth.tsx             Sign-in + Sign-up (multi-step)
/auth/callback              src/routes/auth.callback.tsx    Google OAuth callback
/reset-password             src/routes/reset-password.tsx   Password recovery
/billing                    src/routes/billing.tsx          Public billing/pricing page
/contact                    src/routes/contact.tsx
/privacy                    src/routes/privacy.tsx
/terms                      src/routes/terms.tsx
/trust                      src/routes/trust.tsx

SHOP PUBLIC ROUTES (anon, per-shop)
────────────────────────────────────
/s/:slug                    src/routes/s.$slug.tsx          Shop landing + code entry
/s/:slug/                   src/routes/s.$slug.index.tsx    Spin landing / info collect
/s/:slug/spin               src/routes/s.$slug.spin.tsx     Actual spin (requires ?code=)
/s/:slug/result             src/routes/s.$slug.result.tsx   Prize result page

PROTECTED ROUTES (/_authenticated group)
─────────────────────────────────────────
/_authenticated             src/routes/_authenticated/route.tsx     Layout + auth guard
/dashboard                  src/routes/_authenticated/dashboard.tsx  Shop owner dashboard
/campaigns                  src/routes/_authenticated/campaigns.tsx  Campaign hub
/billing (auth view)        src/routes/_authenticated/billing.tsx    Billing management
/super-admin                src/routes/_authenticated/super-admin.tsx Admin panel

INFRASTRUCTURE
──────────────
src/routes/__root.tsx       Root layout (QueryClientProvider, global styles)
```

### Routing Conventions

- **`_authenticated/`** — pathless layout group (underscore prefix). Provides shared `beforeLoad` guard. The path segment `_authenticated` does not appear in URLs.
- **`s.$slug`** — dynamic segment. `$slug` matches the shop's unique URL slug.
- **`ssr: false`** on `/_authenticated/route.tsx` — auth guard runs client-side only (no SSR pre-auth).

---

## Part 17 — Authentication Components

| Component / File | Responsibility |
|---|---|
| `src/routes/auth.tsx` — `AuthPage` | Unified sign-in/sign-up UI. Manages `mode` (signin/signup), `step` (form/signup-otp/signin-otp), OTP cooldown, email typo detection, password strength |
| `src/routes/auth.callback.tsx` | Handles Google OAuth redirect. Creates shop if new user. |
| `src/routes/reset-password.tsx` — `ResetPasswordPage` | 3-step recovery: request code → verify code → set password |
| `src/components/dashboard/DashboardHeader.tsx` | Renders owner name (from user_metadata), shop logo, sign-out button |
| `src/integrations/supabase/client.ts` | Supabase browser client (lazy proxy) |
| `src/integrations/supabase/auth-attacher.ts` | Global client middleware — attaches Bearer token |
| `src/integrations/supabase/auth-middleware.ts` | Server middleware — validates JWT, injects context |
| `src/lib/auth.functions.ts` | Server functions: `checkEmailRegisteredFn`, `changePasswordFn` (used by super admin) |
| `src/lib/shops.functions.ts` | `createShop`, `listMyShops`, `isSuperAdmin`, `assertOwner` |
| `src/lib/validation.ts` | `isValidEmail`, `checkPassword`, `codeChars`, `slugSchema` |

---

## Part 18 — Role Handling

### Role System

```
app_role enum: 'super_admin'   ← only one role currently defined

public.user_roles:
  user_id → role mapping, enforced by RLS via private.has_role()

Shop owner is NOT a role:
  Ownership is proven by shops.owner_user_id = auth.uid()
  No "shop_owner" row in user_roles
```

### Super Admin Lifecycle

```
1. Bootstrap:
   SUPER_ADMIN_EMAIL env var set on server
   When super admin logs in and calls listMyShops():
     IF email matches AND no existing user_roles record:
       upsert into user_roles (user_id, role='super_admin')
   → Role is self-healing: env var → permanent DB record

2. Detection server-side:
   isSuperAdmin(ctx):
     SELECT id FROM user_roles
     WHERE user_id = ctx.userId AND role = 'super_admin'
   Called by: listAllShops, setShopActive, deleteShop, all admin mutations

3. Route-level:
   /super-admin inherits /_authenticated guard (must be logged in)
   Data rendered by server functions which each call isSuperAdmin()
   No data = blank page for non-admins who reach the URL

4. UI suppression:
   listMyShops returns superAdmin: boolean
   Dashboard redirects to /super-admin if true
   No nav links shown to non-super-admins
```

### Super Admin Capabilities

- List/activate/suspend/delete any shop
- Update plan, subscription_status, trial/billing dates
- Reset any owner's password (via service role)
- Sign any owner out of all devices
- Record manual payments
- Manage subscription plans catalog
- Review pending signups (approve/reject)
- Manage site settings (landing page CMS)

---

## Part 19 — How Shops Are Linked to Users

```
auth.users (Supabase)
    │
    │ owner_user_id FK
    ▼
public.shops
    │
    │ shop_id FK
    ├──▶ campaigns
    │       │ campaign_id FK
    │       └──▶ prizes
    │       └──▶ access_codes
    │
    ├──▶ access_codes (direct shop_id)
    ├──▶ marketing_broadcasts
    ├──▶ marketing_templates
    └──▶ shop_payments
```

**Key facts:**
- One `auth.user` can own multiple shops (schema allows it)
- UI only ever uses `shops[0]` — multi-shop is unsupported in the UI
- `assertOwner` is the universal gate: every server-fn mutation queries `shops WHERE id=$shopId AND owner_user_id=$userId`
- No invitation or co-ownership system — shops are single-owner

---

## Part 20 — How Customers Could Be Linked in the Future

### Current State

```
access_codes row:
  customer_name    ← free text, entered before spin
  customer_contact ← phone (optional)
  customer_email   ← email (optional)
  No FK, no customer_id, no account linkage
```

### Natural Extension Points

The `access_codes` table's `customer_email` is the natural join key for future customer auth. When a customer authenticates (Phase 4.3), their identity can be linked:

```
Future: public.customers
  id             uuid PK
  shop_id        uuid FK → shops(id)
  auth_user_id   uuid FK → auth.users(id)   ← null until they create an account
  email          text NOT NULL
  phone          text
  name           text
  created_at     timestamptz

Linkage to existing spin history:
  access_codes.customer_email → customers.email (per shop)
  OR add: access_codes.customer_id uuid FK → customers(id) (backfill)
```

---

## Part A — Database Relationship Diagram

```
auth.users (Supabase-managed)
├── id (PK)
├── email
└── user_metadata { full_name, name, avatar_url }
      │
      │ 1:N  (user_roles)
      ▼
public.user_roles
├── user_id → auth.users.id
└── role: 'super_admin'

      │
      │ 1:N  (shops — via owner_user_id)
      ▼
public.shops
├── id (PK)
├── owner_user_id → auth.users.id
├── name, slug, logo_url
├── is_active, plan, subscription_status
├── trial_ends_at, current_period_end
      │
      ├── 1:N ──▶ public.campaigns
      │              ├── id (PK)
      │              ├── shop_id → shops.id
      │              ├── name, slug, is_active, is_default
      │              └── theme (jsonb)
      │                    │
      │                    └── 1:N ──▶ public.prizes
      │                                  ├── id (PK, composite with shop_id)
      │                                  ├── shop_id → shops.id
      │                                  ├── campaign_id → campaigns.id
      │                                  └── name, probability, is_win
      │
      ├── 1:N ──▶ public.access_codes        ← spin events + customer PII
      │              ├── (shop_id, code) PK (composite)
      │              ├── shop_id → shops.id
      │              ├── campaign_id → campaigns.id
      │              ├── customer_name, customer_contact, customer_email
      │              ├── is_used, prize_won, spun_at
      │              └── created_at
      │                    ⚠ No customer_id FK — PII is denormalized
      │
      ├── 1:N ──▶ public.marketing_broadcasts
      │              ├── id (PK), shop_id → shops.id
      │              ├── channel, body, subject
      │              ├── status ('draft','sent','scheduled','cancelled')
      │              └── scheduled_at, created_at
      │
      ├── 1:N ──▶ public.marketing_templates
      │              ├── id (PK), shop_id → shops.id
      │              └── name, category, subject, body, favorite
      │
      └── 1:N ──▶ public.shop_payments
                     └── billing history

Standalone (no FK to shops):
public.subscription_plans   ← plan catalog (managed by super admin)
public.site_settings        ← landing page CMS
public.pending_signups      ← pre-approval queue (email, password⚠, shop_name)
```

---

## Part B — Authentication Flow Diagram

```
┌─────────────────────────────── SHOP OWNER AUTH ───────────────────────────────┐
│                                                                                 │
│  /auth (signup mode)                    /auth (signin mode)                    │
│       │                                      │                                 │
│  [1] Enter: shop name, slug,           [1] Enter: email, password              │
│      email, password                         │                                 │
│       │                                  [2] signInWithPassword                │
│  [2] checkEmailRegisteredFn (svc role)       │                                 │
│       │                                  [3] Check mu_last_auth                │
│  [3] signInWithOtp(shouldCreateUser)         │                                 │
│       │                                  ┌───┴────┐                           │
│  [4] step="signup-otp"              trusted │      │ untrusted                 │
│       │                                  │        │                            │
│  [5] Enter 6-digit code             [4] /dash   signOut                        │
│       │                                         signInWithOtp                  │
│  [6] verifyOtp(type:"email")               step="signin-otp"                   │
│       │                                         │                              │
│  [7] updateUser({ password })          [5] Enter 6-digit code                  │
│       │                                         │                              │
│  [8] createShop()                       [6] verifyOtp(type:"email")            │
│       │                                         │                              │
│  [9] navigate("/dashboard")             [7] set mu_last_auth                   │
│                                                 │                              │
│                      ┌──────────────── [8] navigate("/dashboard")              │
│  Google OAuth:       │                                                          │
│  signInWithOAuth ────┘                                                          │
│  → /auth/callback                                                               │
│       │                                                                         │
│  has shops? → /dashboard                                                        │
│  no shops?  → CreateShopForm → createShop → /dashboard                         │
│                                                                                 │
│  Password Reset:                                                                │
│  /reset-password                                                                │
│  resetPasswordForEmail → 6-digit code → verifyOtp(type:"recovery")             │
│  → updateUser({ password }) → /auth                                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────── CUSTOMER (SPINNER) FLOW ───────────────────────────┐
│                                                                                 │
│  /s/:slug          → shop landing page (public)                                │
│  /s/:slug/         → enter name/email/phone → generate/validate access_code    │
│  /s/:slug/spin?code=XXX&name=&contact=&email=                                  │
│                    → spinAndRecord (service role) → saves to access_codes      │
│  /s/:slug/result   → show prize                                                │
│                                                                                 │
│  ⚠ No authentication. No session. No account. Identified by access_code only.  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Part C — Route Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │              __root.tsx                      │
                        │  QueryClientProvider, global CSS, Outlet    │
                        └──────────────────┬──────────────────────────┘
                                           │
              ┌────────────────────────────┼──────────────────────────────────┐
              │                            │                                  │
   ┌──────────▼──────────┐    ┌────────────▼────────────┐    ┌───────────────▼────────────┐
   │   PUBLIC ROUTES     │    │   SHOP PUBLIC ROUTES     │    │  PROTECTED GROUP            │
   │                     │    │   /s/:slug/*             │    │  /_authenticated/route.tsx  │
   │ /          index    │    │                          │    │  beforeLoad: getUser()      │
   │ /auth               │    │ /s/:slug                 │    │  → redirect /auth if none   │
   │ /auth/callback      │    │ /s/:slug/index           │    └─────────────┬───────────────┘
   │ /reset-password     │    │ /s/:slug/spin  ←──────── │── ?code= param  │
   │ /billing            │    │ /s/:slug/result          │                  │
   │ /contact            │    │                          │    ┌─────────────▼───────────────┐
   │ /privacy            │    │ Auth: NONE               │    │  /dashboard                 │
   │ /terms              │    │ RLS: anon SELECT only    │    │  /campaigns                 │
   │ /trust              │    │ spinAndRecord: svc role  │    │  /billing                   │
   │                     │    │                          │    │  /super-admin               │
   │ Auth: NONE          │    └──────────────────────────┘    │                             │
   │ RLS: anon/public    │                                     │ Auth: Bearer JWT required   │
   └─────────────────────┘                                    │ RLS: owner_user_id = uid()  │
                                                              └─────────────────────────────┘
```

---

## Part D — Security Analysis

### Strengths

| # | Finding |
|---|---|
| ✅ | **OTP step-up on login** — password alone is insufficient for new devices; 6-digit email code required |
| ✅ | **Stateless server-side auth** — no server sessions; JWT validated fresh on every RPC |
| ✅ | **RLS enforced at DB layer** — even a compromised server function cannot read cross-owner data (user-scoped client is used) |
| ✅ | **`access_codes` RLS = deny-all** — spin operations can only happen via service role; clients cannot forge or inspect codes directly |
| ✅ | **`pending_signups` RLS = deny-all** — signup queue is service-role-only |
| ✅ | **`assertOwner` dual-check** — ownership verified both in DB (via RLS on the Supabase client) and in application logic |
| ✅ | **Google OAuth available** — reduces password attack surface |
| ✅ | **Token refresh on mobile** — tab-resume handled gracefully |

### Security Concerns

| Severity | Finding | Location |
|---|---|---|
| 🔴 **CRITICAL** | `pending_signups.password` stores the user's **plaintext password**. If the table is ever read by a compromised service-role key, all pending-signup credentials are exposed. | `supabase/migrations/20260630064242_...sql` |
| 🟠 **HIGH** | **Route guard is client-side only** (`ssr: false`). SSR pages render without auth validation — only a redirect after hydration. A server-rendered HTML snapshot of `/dashboard` could leak page structure. In practice, all data comes from server functions (which do validate), but the guard surface is incomplete. | `src/routes/_authenticated/route.tsx` |
| 🟠 **HIGH** | **Device trust uses localStorage** (`mu_last_auth`). An XSS attack could clear or forge this value, allowing step-up bypass or infinite step-up loops. | `src/routes/auth.tsx` |
| 🟡 **MEDIUM** | **No rate limiting** on OTP requests at the application layer. Supabase has its own rate limits, but there is no explicit client-side or server-side throttle beyond the 60-second UI cooldown (easily bypassed). | `src/routes/auth.tsx` |
| 🟡 **MEDIUM** | **`prize_won` stored as a string, not a FK** to `prizes`. This means a compromised server function could write arbitrary strings. No referential integrity. | `access_codes` schema |
| 🟡 **MEDIUM** | `SUPER_ADMIN_EMAIL` auto-grants the super_admin role on `listMyShops`. If the env var is changed to a different email, the new email gets super_admin on next login. Old super admins retain their DB role. No revocation logic. | `src/lib/shops.functions.ts` |
| 🟡 **MEDIUM** | **No CSRF protection** on server functions. TanStack Start's `createServerFn` uses POST RPCs, but no CSRF token is validated. The Bearer auth header provides partial protection (not sent by default browser form submissions), but XHR-based CSRF is not blocked. | Architecture-wide |
| 🟢 **LOW** | `sessionStorage.setItem("otp_state", ...)` persists partial signup data (email, shopName, slug) across mobile tab switches. If inspected, it reveals the signup intent. Not sensitive but worth noting. | `src/routes/auth.tsx` |

---

## Part E — Missing Pieces Required for Dual Authentication

The following infrastructure gaps must be filled before Phase 4.2–4.5 can be implemented:

### For Phase 4.2 — Shop Owner Auth (refinements)

| Gap | Description |
|---|---|
| No email verification on Google OAuth new users | Callback creates shop immediately; no step to verify intent or collect shop details cleanly if user already has Supabase account from another sign-in method |
| No "already logged in" redirect | If a logged-in owner navigates to `/auth`, they see the login form instead of being redirected to `/dashboard` |
| No multi-shop UI | Schema supports N shops per owner, but UI only shows `shops[0]` |
| SSR route guard | `ssr: false` means Supabase session check runs only client-side |
| Pending signup password storage | Plaintext password in `pending_signups.password` must be hashed |

### For Phase 4.3 — Customer Authentication (new)

| Missing Piece | Description |
|---|---|
| `customers` table | No dedicated table. Customer identity is currently denormalized PII in `access_codes`. |
| Customer `auth.users` accounts | Customers have no Supabase accounts. A separate email/OTP flow (magic link) is the natural fit. |
| `shop_customers` junction | No table linking a customer to a specific shop they've interacted with. |
| Customer RLS policies | No policies define what a customer can see about their own spin history. |
| Customer server functions | No server functions exist for customer auth, profile, or history retrieval. |
| Customer JWT context | `requireSupabaseAuth` injects `userId` but doesn't distinguish owner vs. customer. A customer JWT would look identical — code would need to check if the `userId` belongs to a customer or a shop owner. |

### For Phase 4.4 — Customer Portal (new)

| Missing Piece | Description |
|---|---|
| Customer-facing route group | No `/_customer/` protected route group exists |
| Customer portal UI | No components for spin history, prize collection, profile management |
| `prize_claims` or claim tracking | `prize_won` is a string in `access_codes`; no claim status, expiry, or redemption tracking |
| Cross-shop customer identity | A customer who spins at two different shops is two separate identities — no global customer account concept |

### For Phase 4.5 — Role-Based Routing (extension)

| Missing Piece | Description |
|---|---|
| `app_role` only has `super_admin` | No `shop_owner`, `customer`, or `staff` role in the enum |
| No role-aware router helper | The route guard just checks "is authenticated"; it doesn't check role. Super-admin redirect lives in component code (`dashboard.tsx`), not in a router middleware. |
| No route-level role assertion | A non-super-admin can navigate to `/super-admin` URL; the page renders (blank/error) because server functions reject them, but the route itself has no role guard |

---

## Part F — Implementation Roadmap

---

### Phase 4.2 — Shop Owner Authentication

**Goal:** Harden and complete the existing shop owner auth, fix security issues, add missing UX.

**Scope of work:**

**DB changes (1 migration):**
```sql
-- Hash pending_signups.password (replace plaintext column)
ALTER TABLE pending_signups ADD COLUMN password_hash text;
-- (backfill + drop old column in same migration or subsequent)

-- Add: already-logged-in redirect support (no DB change needed)
-- Add: multi-shop nav (no DB change needed — schema already supports it)
```

**Server functions:**
- Update `pending_signups` write path to hash the password before storing (bcrypt via a Supabase Edge Function or use Supabase's `signUp` → confirm flow instead of storing credentials at all)
- Add `getMyProfile` server function returning `auth.users` metadata

**Route changes:**
- Add `beforeLoad` to `/auth` that redirects authenticated users to `/dashboard`
- Add SSR-compatible session check to `/_authenticated/route.tsx` (or accept current client-only as-is with documentation)
- Add role guard to `/super-admin` at the route level (not just data level)

**Security fixes:**
- `pending_signups`: replace plaintext password with a pending-approval OTP flow (invite link) instead of storing credentials
- Move `mu_last_auth` from localStorage to an httpOnly cookie (if possible in TanStack Start) or at minimum add XSS note to security doc

**Estimated effort:** Small (2–3 server functions, 1 migration, 3 route edits)

---

### Phase 4.3 — Customer Authentication

**Goal:** Allow customers (spinners) to create accounts and log in with their email, linking their spin history to a persistent identity.

**Scope of work:**

**DB changes (1 migration):**
```sql
CREATE TABLE public.customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    uuid UNIQUE REFERENCES auth.users(id),  -- null until account created
  email           text NOT NULL,
  phone           text,
  name            text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE public.shop_customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES shops(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  first_seen  timestamptz DEFAULT now(),
  UNIQUE (shop_id, customer_id)
);

-- Backlink: add customer_id to access_codes
ALTER TABLE public.access_codes ADD COLUMN customer_id uuid REFERENCES customers(id);

-- RLS for customers table:
-- Customers can read/update their own row (auth.uid() = auth_user_id)
-- Shop owners can read customers who have spun at their shop (via shop_customers)
-- No anon access
```

**Authentication mechanism:**
- Magic link / email OTP (no password — frictionless for one-time spinners)
- `supabase.auth.signInWithOtp({ email, shouldCreateUser: true })` — same SDK call as owner flow but in a separate UI context
- Customer signs in → `auth.users` record created → `customers` record upserted (by email) → `shop_customers` upserted → any `access_codes` rows with matching email+shop_id backlinked via `customer_id`

**Server functions (new file: `src/lib/customer-auth.functions.ts`):**
```
customerSignIn(email, shopSlug)          → send OTP
customerVerifyOtp(email, token, shopSlug) → verify + upsert customers + shop_customers
getMySpinHistory(shopId)                 → access_codes WHERE customer_id = me
getMyProfile()                           → customers WHERE auth_user_id = me
updateMyProfile(name, phone)             → UPDATE customers
```

**Middleware:**
- `requireSupabaseAuth` already works for customers (same JWT flow)
- Add helper: `requireCustomer(ctx)` — checks if `ctx.userId` maps to a `customers.auth_user_id`, throws if it's a shop owner trying to access customer endpoints

**Estimated effort:** Medium (1 migration, 5–6 server functions, new sign-in UI on spin pages)

---

### Phase 4.4 — Customer Portal

**Goal:** Give authenticated customers a dedicated view of their spin history, prizes won, and profile.

**Scope of work:**

**Route group (new):**
```
src/routes/_customer/
  route.tsx          ← beforeLoad: check customer auth (not owner auth)
  portal.tsx         ← customer dashboard
  history.tsx        ← spin history across all shops
  prizes.tsx         ← prizes won + claim status
  profile.tsx        ← edit name, phone, email preferences
```

**DB additions (1 migration):**
```sql
CREATE TABLE public.prize_claims (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid REFERENCES shops(id),
  customer_id  uuid REFERENCES customers(id),
  access_code  text,
  shop_id_fk   uuid,
  FOREIGN KEY (shop_id_fk, access_code) REFERENCES access_codes(shop_id, code),
  prize_name   text NOT NULL,
  status       text DEFAULT 'unclaimed',  -- 'unclaimed','claimed','expired'
  claimed_at   timestamptz,
  expires_at   timestamptz,
  claim_code   text UNIQUE,   -- QR/barcode for in-store redemption
  created_at   timestamptz DEFAULT now()
);
```

**UI components:**
- `CustomerPortalHeader` — customer name, shop logo, sign-out
- `SpinHistoryCard` — date, campaign, prize won, claim status
- `PrizeClaimCard` — prize details, redemption QR code
- `CustomerProfileForm` — name, phone, email preferences

**Integration with shop owner dashboard:**
- Dashboard prizes tab → show claim status per winner
- Shop owner can mark prizes as redeemed

**Estimated effort:** Medium-Large (1 migration, new route group, 5–6 components, 4–5 server functions)

---

### Phase 4.5 — Role-Based Routing

**Goal:** Clean up the role-checking logic into a proper, centralized routing layer that handles `super_admin`, `shop_owner`, and `customer` contexts without relying on component-level redirects.

**Scope of work:**

**DB change:**
```sql
-- Extend app_role enum (Postgres enum requires careful migration)
-- Option A: Add 'customer' and 'shop_owner' to app_role (rigid)
-- Option B: Keep user_roles for super_admin only; determine role from table presence:
--   has customers.auth_user_id match → customer
--   has shops.owner_user_id match → shop_owner
--   has user_roles super_admin → super_admin
-- Recommendation: Option B (no migration needed; roles derived from data)
```

**Router changes:**
```
src/routes/_authenticated/route.tsx
  → Add role detection to beforeLoad context
  → Return: { user, role: 'super_admin' | 'shop_owner' | 'customer' | 'unknown' }

src/routes/_authenticated/super-admin.tsx
  → beforeLoad: if role !== 'super_admin' → redirect('/dashboard')

src/routes/_authenticated/dashboard.tsx
  → beforeLoad: if role === 'super_admin' → redirect('/super-admin')
  →             if role === 'customer' → redirect('/portal')
  → Remove navigate() in component body (move to route layer)

New: src/routes/_customer/route.tsx
  → beforeLoad: if role !== 'customer' → redirect('/auth')
```

**Centralized role resolver (`src/lib/auth-role.ts`):**
```typescript
// Called once; result passed via router context
async function resolveUserRole(userId: string): Promise<AppRole>
  1. Check user_roles for super_admin
  2. Check shops for owner_user_id match
  3. Check customers for auth_user_id match
  4. Return 'unknown' (prompt shop creation or login)
```

**Server function guards:**
```typescript
// Replace scattered isSuperAdmin() calls with:
requireRole(ctx, 'super_admin')   // throws Forbidden
requireRole(ctx, 'shop_owner')    // throws Forbidden
requireRole(ctx, 'customer')      // throws Forbidden
```

**Estimated effort:** Medium (no migration needed with Option B, ~8 route/function file edits, 1 new lib file)

---

## Summary Table

| Phase | Goal | DB Changes | New Files | Modified Files | Complexity |
|---|---|---|---|---|---|
| **4.2** | Harden shop owner auth | 1 migration (hash passwords) | 0 | 4–5 | Small |
| **4.3** | Customer authentication | 1 migration (customers, shop_customers, access_codes.customer_id) | 1 server-fn file | Spin routes, RLS | Medium |
| **4.4** | Customer portal | 1 migration (prize_claims) | 5–6 components + route group | Dashboard prizes tab | Medium-Large |
| **4.5** | Role-based routing | 0 (Option B) | 1 lib file | 4–5 routes + server fns | Medium |

**Dependencies:**
- 4.3 must complete before 4.4 (customers table required)
- 4.2 can run in parallel with 4.3 planning
- 4.5 can start after 4.3 is complete (needs customer role defined)
- 4.4 depends on 4.3 (customer identity) but not on 4.5 (routing)

---

*Audit complete. No files were modified.*

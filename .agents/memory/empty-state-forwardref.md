---
name: EmptyState forwardRef icon detection
description: EmptyState in ds/empty-state.tsx must detect Lucide icons as forwardRef objects, not functions — wrong check crashes new merchants with zero records.
---

## The rule
`ds/empty-state.tsx` detects whether the `icon` prop is a renderable React component using:

```js
const isLucideIcon =
  typeof icon === "function" ||
  (typeof icon === "object" && icon !== null && "$$typeof" in (icon as object));
```

**Never** use `typeof icon === "function"` alone — that was the original bug.

**Why:** Modern Lucide icons are `React.forwardRef()` wrappers. Their `typeof` is `"object"`, not `"function"`. They carry `{ $$typeof: Symbol(react.forward_ref), render: fn }`. The old `"function"` check made `isLucideIcon = false`, so the component was passed straight to `{icon as React.ReactNode}`, which throws "Objects are not valid as a React child (found: object with keys {$$typeof, render})".

**How to apply:** Any time you add a `typeof icon === "function"` guard to distinguish a Lucide/React component from a ReactNode, also include the `"$$typeof" in (icon as object)` branch.

## Why only new merchants were affected
The crash path in `OverviewTab` is `stats.total === 0` → `<EmptyState icon={Zap} .../>`. New merchants have zero spin records, so `stats.total = 0` always. Existing merchants have records, `stats.top` is non-null, and they take a different JSX branch that never calls `EmptyState`.

## Important: Edit tool escaping
The `Edit` tool may silently drop one `$` from `$$typeof`, turning it into `$typeof`. Always verify with `sed -n 'Np' file` after editing strings containing `$$`. Use `sed -i` for the replacement if `Edit` garbles it.

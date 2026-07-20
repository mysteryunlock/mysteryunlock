---
name: Android OTP crash fix
description: Root cause and fix for the Android Brave login crash during OTP step-up
---

## Root cause
`input-otp` v1.4.2 crashed Brave's Android renderer at the tab process level when the OTP form was rendered. The crash happened during React render of the OTP step (between `signInWithOtp:result` and the `step:signin-otp:mounted` useEffect firing). Because the renderer was killed at the browser process level — not at the JavaScript level — no `window.onerror` or `window.addEventListener('error', ...)` handlers could capture it.

## Fix
Replaced `src/components/ds/otp-input.tsx` with a pure native implementation using a single transparent `<input type="text" inputMode="numeric" autoComplete="one-time-code">` absolutely positioned over visual digit slots. Zero dependency on `input-otp`. Same external API (`length`, `value`, `onChange`, `onComplete`, `autoFocus`, `disabled`, `separatorAfter`).

**Why:** `input-otp` v1.x uses deprecated `document.execCommand`, custom `InputEvent.inputType` values, and `ResizeObserver` patterns that conflict with Brave's fingerprinting protection. These APIs are blocked or modified by Brave, causing the renderer to crash.

**How to apply:** If a new OTP input component is ever needed, use the native pattern (transparent overlay input + visual slots) instead of any library. `autoComplete="one-time-code"` is essential for Android SMS autofill.

## Secondary issues fixed in this session
1. **Cross-tab race condition**: auth.tsx `onAuthStateChange` auto-nav to `/dashboard` on `SIGNED_IN` fired in passive tabs before OTP step-up `signOut()` could complete. Fixed with 600ms re-verify delay in `maybeNavigate`.
2. **React hydration error #418**: Pre-existing mismatch between SSR HTML and client React tree on initial page load. Causes automatic fallback to client rendering. Not blocking login flow. Investigate separately.

## Debug infrastructure added (can be removed post-fix)
- `src/lib/debug-auth-log.ts` — cross-tab localStorage debug log
- `src/components/DebugAuthPanel.tsx` — long-press logo debug panel
- `window.onerror` + `window.onunhandledrejection` handlers in `__root.tsx`
- `pushDebugEvent` calls throughout auth.tsx, _authenticated/route.tsx, dashboard.tsx, auth-attacher.ts
- `ls-monitor` localStorage interceptor in `__root.tsx`

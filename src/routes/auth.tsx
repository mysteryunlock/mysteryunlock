import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  Store,
  Mail,
  Check,
  X,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

import { supabase, getClientId } from "@/integrations/supabase/client";
import { pushDebugEvent, openDebugPanel } from "@/lib/debug-auth-log";
import { isValidEmail, checkPassword } from "@/lib/validation";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { createShop } from "@/lib/shops.functions";
import { checkEmailRegisteredFn } from "@/lib/auth.functions";
import { parseServerValidationError } from "@/lib/utils";
import { OtpInput } from "@/components/ds";

// ── Long-press logo (Android debug access) ────────────────────────────────────
// Uses a div wrapper so touch events land on the div, not the img.
// `onContextMenu` prevention stops Android Chrome's "Save image" sheet from
// firing touchcancel and killing the timer before 700 ms.
// `onTouchCancel` is intentionally omitted — if the browser fires it (e.g.
// during a suppressed context-menu), we still want the timer to fire.
function LongPressLogo({ className }: { className?: string }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(openDebugPanel, 700);
  };
  const cancel = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  return (
    <div
      onTouchStart={start}
      onTouchEnd={cancel}
      onTouchMove={cancel}
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        display: 'inline-block',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'none',
        cursor: 'pointer',
      } as React.CSSProperties}
    >
      <img
        src={DEFAULT_LOGO}
        alt="Mystery Unlock"
        className={className}
        draggable={false}
        style={{ display: 'block', pointerEvents: 'none', userSelect: 'none' }}
      />
    </div>
  );
}

export const Route = createFileRoute("/auth")({
  // Disable SSR — this is a purely client-side page (depends on Supabase
  // session state, localStorage, and the browser client). Server-rendering it
  // causes SSR failures when the server has no session context (e.g. after
  // sign-out or a fresh browser load), resulting in the renderErrorPage() 500.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Mystery Unlock" },
      { name: "description", content: "Create a shop or sign in to your Mystery Unlock account." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";
// signup-otp: verifying email during sign-up
// signin-otp: step-up code after password check
type Step = "form" | "signup-otp" | "signin-otp";

// ── Email domain typo detection ───────────────────────────────────────────────
const KNOWN_DOMAINS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "me.com", "mac.com", "live.com", "msn.com", "aol.com",
  "protonmail.com", "proton.me", "mail.com", "googlemail.com",
];

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function suggestDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain.includes(".")) return null;
  if (KNOWN_DOMAINS.includes(domain)) return null;
  let best: string | null = null, bestDist = Infinity;
  for (const d of KNOWN_DOMAINS) {
    const dist = levenshtein(domain, d);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return bestDist <= 2 ? best : null;
}

// ── Password strength ─────────────────────────────────────────────────────────
function getStrength(pass: string): number {
  if (pass.length === 0) return 0;
  if (pass.length < 6) return 1;
  if (pass.length < 10) return 2;
  return 3;
}

// ── Shared input class ────────────────────────────────────────────────────────
const inputCls = [
  "w-full bg-[#F7F8FA] text-[#0C2340] placeholder:text-[#4a5b78]/50",
  "border border-[#0C2340]/12 rounded-xl",
  "px-3.5 py-2.5 text-sm leading-snug",
  "transition-all duration-150 outline-none",
  "focus:ring-2 focus:ring-[#FF6B1A]/25 focus:border-[#FF6B1A]/60 focus:bg-white",
].join(" ");

// ── Brand panel — left side on desktop ───────────────────────────────────────
function BrandPanel() {
  const features = [
    "Launch a prize wheel or scratch card in minutes",
    "Connect customers across any sales channel",
    "Track wins, claims, and engagement in real time",
  ];
  return (
    <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 bg-[#0C2340] px-10 py-12 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-[#FF6B1A]/10 blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full bg-white/4 blur-3xl translate-y-1/2 -translate-x-1/4" />
      </div>

      {/* Logo */}
      <div className="relative z-10">
        <LongPressLogo className="h-10 w-auto object-contain brightness-0 invert" />
      </div>

      {/* Center content */}
      <div className="relative z-10 space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#FF6B1A]/15 border border-[#FF6B1A]/25 rounded-full px-3 py-1.5 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[#FF6B1A]" strokeWidth={2} />
            <span className="text-[11px] font-semibold text-[#FF6B1A] uppercase tracking-wide">Gamified Marketing</span>
          </div>
          <h2 className="text-3xl font-display font-bold text-white leading-tight mb-3">
            Turn every visit into a winning moment
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Mystery Unlock helps merchants drive repeat visits, capture customer data, and reward loyalty — all through beautiful prize experiences.
          </p>
        </div>

        <ul className="space-y-3.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#FF6B1A]/20 border border-[#FF6B1A]/30 grid place-items-center mt-0.5">
                <Check className="w-3 h-3 text-[#FF6B1A]" strokeWidth={2.5} />
              </span>
              <span className="text-sm text-white/80 leading-relaxed">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="relative z-10">
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Enterprise-grade security · SOC 2 compliant</span>
        </div>
      </div>
    </div>
  );
}

// ── DIAGNOSTIC: log all sb-* auth keys in localStorage ───────────────────
function logSbKeys(label: string) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('sb-') && k.endsWith('-auth-token')) keys.push(k);
    }
    console.log(`[auth:sb-keys] ${label}:`, keys.length > 0 ? keys : '⚠️ NONE');
  } catch (e) {
    console.warn('[auth:sb-keys] could not read localStorage:', e);
  }
}

// ── DIAGNOSTIC: 3-point session persistence check (t=0, 500ms, 2500ms) ───
function checkSessionPersistence(label: string) {
  const snap = async (when: string) => {
    const sbKeys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('sb-') && k.endsWith('-auth-token')) sbKeys.push(k);
      }
    } catch {}
    const { data } = await supabase.auth.getSession();
    console.log(`[auth:persist-check] ${label} — ${when}`, {
      clientId: getClientId(),
      hasSession: !!data.session,
      userId: data.session?.user?.id ?? null,
      expiresAt: data.session?.expires_at ?? null,
      sbKeys: sbKeys.length > 0 ? sbKeys : '⚠️ NONE',
    });
    pushDebugEvent('auth.tsx', label, `getSession:${when}`, {
      clientId: getClientId(),
      hasSession: !!data.session,
      userId: data.session?.user?.id ?? null,
      expiresAt: data.session?.expires_at ?? null,
      sbKeys: sbKeys.length > 0 ? sbKeys : '⚠️ NONE',
    }, data.session ? 'success' : 'error');
  };
  void snap('t=0ms');
  setTimeout(() => { void snap('t=500ms'); }, 500);
  setTimeout(() => { void snap('t=2500ms'); }, 2500);
}

function AuthPage() {
  const navigate = useNavigate();
  const doCreateShop = useServerFn(createShop);

  const [mode, setMode] = useState<Mode>("signup");
  const [step, setStep] = useState<Step>("form");

  // Shared OTP
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Sign-up fields (kept in state so they survive the OTP step)
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Sign-in fields
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [showSigninPassword, setShowSigninPassword] = useState(false);

  const [error, setError] = useState("");
  const [hintEmail, setHintEmail] = useState("");
  const showSignInHint = hintEmail !== "" && email.trim().toLowerCase() === hintEmail.trim().toLowerCase();
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const didInteract = useRef(false);
  const slugTouched = useRef(false);
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  // ── sessionStorage helpers (survive mobile page reloads) ─────────────────────
  const saveOtpState = useCallback((data: {
    step: Step; otpEmail: string;
    shopName?: string; slug?: string; password?: string;
  }) => {
    try { sessionStorage.setItem("mu_otp", JSON.stringify(data)); } catch {}
  }, []);

  const clearOtpState = useCallback(() => {
    try { sessionStorage.removeItem("mu_otp"); } catch {}
  }, []);

  // Restore OTP step after a mobile page reload (runs once on mount)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("mu_otp");
      if (!saved) return;
      const s = JSON.parse(saved) as {
        step?: Step; otpEmail?: string;
        shopName?: string; slug?: string; password?: string;
      };
      if (s.step && s.step !== "form" && s.otpEmail) {
        didInteract.current = true;
        setStep(s.step);
        setOtpEmail(s.otpEmail);
        if (s.shopName) setShopName(s.shopName);
        if (s.slug)     setSlug(s.slug);
        if (s.password) setPassword(s.password);
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect already signed-in users.
  useEffect(() => {
    let cancelled = false;
    // Re-verify the session after a short delay before navigating away from /auth.
    // This prevents a race condition where:
    //   - Tab B signs in (SIGNED_IN fires in Tab A as a cross-tab event)
    //   - Tab A would prematurely navigate to /dashboard
    //   - Tab B's OTP step-up then calls signOut() (~300 ms later), deleting the session
    //   - Tab A's dashboard loads with no session → "Unauthorized"
    // Waiting 600 ms and re-checking the session means the OTP step-up signOut
    // always completes first; only a stable, non-transient session triggers the nav.
    const maybeNavigate = () => {
      setTimeout(async () => {
        if (cancelled || didInteract.current) return;
        const { data: recheck } = await supabase.auth.getSession();
        if (!cancelled && !didInteract.current && recheck.session) {
          navigate({ to: "/dashboard" });
        }
      }, 600);
    };
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && !didInteract.current && data.session) maybeNavigate();
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || !session) return;
      if (event === "SIGNED_IN" && !didInteract.current) maybeNavigate();
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [navigate]);

  // Track step transitions for debugging
  useEffect(() => {
    if (step === "signin-otp" || step === "signup-otp") {
      pushDebugEvent('auth.tsx', 'render', `step:${step}:mounted`, { otpEmail }, 'info');
    }
  }, [step, otpEmail]);

  // Cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  const autoSlug = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  // ── Resend OTP ───────────────────────────────────────────────────────────────
  const resendOtp = useCallback(async (target: string, create: boolean) => {
    setSendingOtp(true); setError(""); setInfo("");
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: target,
        options: { shouldCreateUser: create },
      });
      if (err) throw err;
      setInfo("A new code was sent to your email.");
      setOtpCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code.");
    } finally { setSendingOtp(false); }
  }, []);

  const checkEmailRegistered = useServerFn(checkEmailRegisteredFn);

  // ── SIGN UP: step 1 — send OTP ───────────────────────────────────────────────
  const onSignupSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    didInteract.current = true;
    setError(""); setInfo(""); setLoading(true);
    try {
      if (!shopName.trim()) throw new Error("Shop name is required");
      if (!isValidEmail(email)) throw new Error("Please enter a valid email address (e.g. you@example.com)");
      const pwCheck = checkPassword(password);
      if (!pwCheck.ok) throw new Error(pwCheck.errors.join(" · "));
      const resolvedSlug = slug || autoSlug(shopName);
      if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(resolvedSlug))
        throw new Error("Shop URL can only use lowercase letters, numbers and dashes");
      if (!slug) setSlug(resolvedSlug);

      const { exists } = await checkEmailRegistered({ data: { email } });
      if (exists) {
        setHintEmail(email);
        setError("An account with this email already exists.");
        return;
      }

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (otpErr) {
        const msg = otpErr.message ?? "";
        const isAlreadyRegistered =
          /already registered/i.test(msg) ||
          /already been registered/i.test(msg) ||
          /already confirmed/i.test(msg) ||
          /email.*exist/i.test(msg) ||
          /rate.?limit/i.test(msg) ||
          /for security/i.test(msg);
        if (isAlreadyRegistered) {
          setHintEmail(email);
          setError("An account with this email already exists.");
          return;
        }
        throw otpErr;
      }

      setOtpEmail(email);
      setOtpCode("");
      setStep("signup-otp");
      setOtpCooldown(60);
      saveOtpState({ step: "signup-otp", otpEmail: email, shopName, slug: resolvedSlug, password });
    } catch (err) {
      setHintEmail("");
      setError(parseServerValidationError(err) ?? (err instanceof Error ? err.message : "Something went wrong"));
    } finally { setLoading(false); }
  };

  // ── SIGN UP: step 2 — verify OTP → create shop → go to dashboard ─────────────
  const onSignupVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otpCode.replace(/\D/g, "");
    if (!/^\d{6,8}$/.test(token)) { setError("Enter the verification code from your email"); return; }
    setError(""); setInfo(""); setLoading(true);
    try {
      console.log("[auth:clientId] before verifyOtp (signup):", getClientId());
      pushDebugEvent('auth.tsx', 'onSignupOtp', 'verifyOtp:request', { clientId: getClientId(), flow: 'signup' });
      const { error: verr, data: signupVerData } = await supabase.auth.verifyOtp({ email: otpEmail, token, type: "email" });
      console.log("[auth:verifyOtp (signup-step1)]", { session: signupVerData?.session ? { userId: signupVerData.session.user?.id, expiresAt: signupVerData.session.expires_at } : null, error: verr ?? null });
      pushDebugEvent('auth.tsx', 'onSignupOtp', 'verifyOtp:result', { hasSession: !!signupVerData?.session, hasUser: !!signupVerData?.user, errorMsg: verr?.message ?? null }, verr ? 'error' : 'success');
      const { data: afterSignupVer } = await supabase.auth.getSession();
      console.log("[auth:verifyOtp (signup-step1)] getSession() after:", { hasSession: !!afterSignupVer.session, tokenExpiry: afterSignupVer.session?.expires_at ?? null });
      pushDebugEvent('auth.tsx', 'onSignupOtp', 'getSession:after-verifyOtp', { hasSession: !!afterSignupVer.session }, afterSignupVer.session ? 'success' : 'error');
      logSbKeys("after signup verifyOtp");
      if (verr) throw verr;
      checkSessionPersistence("signup-verifyOtp");

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: existingShop } = await supabase
          .from("shops")
          .select("id")
          .eq("owner_user_id", user.id)
          .maybeSingle();
        if (existingShop) {
          await supabase.auth.signOut().catch(() => {});
          clearOtpState();
          setStep("form");
          setOtpCode("");
          setLoading(false);
          setError("An account with this email already exists. Please use Sign in instead.");
          return;
        }
      }

      // ── Create shop BEFORE setting password ──────────────────────────────────
      // IMPORTANT: supabase.auth.updateUser({ password }) rotates the JWT session
      // (Supabase issues fresh tokens). During that brief rotation the old
      // localStorage entry is removed before the new one is written. If
      // attachSupabaseAuth calls getSession() inside that window it returns null
      // → no Authorization header → requireSupabaseAuth throws "Unauthorized" →
      // shop is never created. Fix: create the shop first, using the stable
      // verifyOtp session, then set the password afterward.
      const resolvedSlug = slug || autoSlug(shopName);
      try {
        await doCreateShop({ data: { name: shopName.trim(), slug: resolvedSlug } });
      } catch (shopErr) {
        console.error("[signup] doCreateShop failed:", shopErr);
        await supabase.auth.signOut().catch(() => {});
        clearOtpState();
        setStep("form");
        setOtpCode("");
        setLoading(false);
        const shopErrMsg = parseServerValidationError(shopErr) ?? (shopErr instanceof Error ? shopErr.message : "Could not create your shop — please try again");
        setError(`${shopErrMsg}. Your account was created — you can sign in with ${otpEmail} if you already have a shop, or try registering again with a different shop name.`);
        return;
      }

      // Shop is created. Now set the password — session rotation here is safe
      // because we no longer need to call any server functions afterward.
      console.log("[auth:clientId] before updateUser:", getClientId());
      pushDebugEvent('auth.tsx', 'onSignupOtp', 'updateUser:request', { clientId: getClientId() });
      console.log("[auth:updateUser] calling updateUser({ password })...");
      logSbKeys("before updateUser");
      await supabase.auth.updateUser({ password }).catch(() => {});
      const { data: afterUpdate } = await supabase.auth.getSession();
      console.log("[auth:updateUser] getSession() after:", { hasSession: !!afterUpdate.session, tokenExpiry: afterUpdate.session?.expires_at ?? null });
      pushDebugEvent('auth.tsx', 'onSignupOtp', 'updateUser:after', { hasSession: !!afterUpdate.session }, afterUpdate.session ? 'success' : 'warn');
      logSbKeys("after updateUser");

      try { localStorage.setItem("mu_last_auth", Date.now().toString()); } catch {}
      clearOtpState();
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const isExpired = /expir|invalid.*token|token.*invalid|otp.*invalid|invalid.*otp/i.test(msg);
      if (isExpired) {
        clearOtpState();
        setOtpCooldown(0);
        setStep("form");
        setOtpCode("");
        setError("Your verification code has expired. Please start registration again to receive a new code.");
      } else {
        setError(msg || "Invalid or expired code — please check and try again");
      }
    } finally { setLoading(false); }
  };

  // ── SIGN IN: password → check device trust → OTP only if needed ──────────────
  const onSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    didInteract.current = true;
    setError(""); setInfo(""); setLoading(true);
    try {
      if (!isValidEmail(signinEmail)) throw new Error("Please enter a valid email address");
      if (!signinPassword || signinPassword.length < 6) throw new Error("Password must be at least 6 characters");

      console.log("[auth:clientId] before signInWithPassword:", getClientId());
      pushDebugEvent('auth.tsx', 'onSignin', 'signInWithPassword:request', { clientId: getClientId() });
      const { error: pwErr, data: pwData } = await supabase.auth.signInWithPassword({
        email: signinEmail,
        password: signinPassword,
      });
      console.log("[auth:signInWithPassword]", { session: pwData?.session ? { userId: pwData.session.user?.id, expiresAt: pwData.session.expires_at } : null, user: pwData?.user?.id ?? null, error: pwErr ?? null });
      pushDebugEvent('auth.tsx', 'onSignin', 'signInWithPassword:result', { hasSession: !!pwData?.session, hasUser: !!pwData?.user, errorMsg: pwErr?.message ?? null }, pwErr ? 'error' : 'info');
      const { data: afterPw } = await supabase.auth.getSession();
      console.log("[auth:signInWithPassword] getSession() after:", { hasSession: !!afterPw.session, tokenExpiry: afterPw.session?.expires_at ?? null });
      logSbKeys("after signInWithPassword");
      if (pwErr) throw pwErr;

      const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
      try {
        const lastAuth = localStorage.getItem("mu_last_auth");
        if (lastAuth && Date.now() - parseInt(lastAuth, 10) < THREE_DAYS) {
          clearOtpState();
          navigate({ to: "/dashboard" });
          return;
        }
      } catch {}

      console.log("[auth:clientId] before step-up signOut:", getClientId());
      pushDebugEvent('auth.tsx', 'onSignin', 'step-up:signOut', { reason: 'device not trusted — OTP step-up required' }, 'warn');
      await supabase.auth.signOut();
      const { data: afterStepUpSignOut } = await supabase.auth.getSession();
      console.log("[auth:signOut (step-up)] getSession() after signOut:", { hasSession: !!afterStepUpSignOut.session });
      pushDebugEvent('auth.tsx', 'onSignin', 'step-up:afterSignOut', { sessionGone: !afterStepUpSignOut.session }, 'info');
      logSbKeys("after step-up signOut");
      setSendingOtp(true);
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: signinEmail,
        options: { shouldCreateUser: false },
      });
      setSendingOtp(false);
      console.log("[auth:signInWithOtp (step-up)]", { error: otpErr ?? null });
      pushDebugEvent('auth.tsx', 'onSignin', 'signInWithOtp:result', { errorMsg: otpErr?.message ?? null, email: signinEmail }, otpErr ? 'error' : 'success');
      if (otpErr) {
        setError("Your password was accepted but we couldn't send the verification code. Please try again.");
        setLoading(false);
        return;
      }

      setOtpEmail(signinEmail);
      setOtpCode("");
      setStep("signin-otp");
      setOtpCooldown(60);
      saveOtpState({ step: "signin-otp", otpEmail: signinEmail });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect email or password");
      setSendingOtp(false);
    } finally { setLoading(false); }
  };

  // ── SIGN IN: verify OTP ──────────────────────────────────────────────────────
  const onSigninVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otpCode.replace(/\D/g, "");
    if (!/^\d{6,8}$/.test(token)) { setError("Enter the verification code from your email"); return; }
    setError(""); setInfo(""); setLoading(true);
    try {
      console.log("[auth:clientId] before verifyOtp (signin):", getClientId());
      pushDebugEvent('auth.tsx', 'onSigninOtp', 'verifyOtp:request', { clientId: getClientId(), flow: 'signin' });
      const { error: err, data: signinVerData } = await supabase.auth.verifyOtp({ email: otpEmail, token, type: "email" });
      console.log("[auth:verifyOtp (signin)]", { session: signinVerData?.session ? { userId: signinVerData.session.user?.id, expiresAt: signinVerData.session.expires_at } : null, user: signinVerData?.user?.id ?? null, error: err ?? null });
      pushDebugEvent('auth.tsx', 'onSigninOtp', 'verifyOtp:result', { hasSession: !!signinVerData?.session, hasUser: !!signinVerData?.user, errorMsg: err?.message ?? null }, err ? 'error' : 'success');
      const { data: afterSigninVer } = await supabase.auth.getSession();
      console.log("[auth:verifyOtp (signin)] getSession() after:", { hasSession: !!afterSigninVer.session, tokenExpiry: afterSigninVer.session?.expires_at ?? null });
      pushDebugEvent('auth.tsx', 'onSigninOtp', 'getSession:after-verifyOtp', { hasSession: !!afterSigninVer.session }, afterSigninVer.session ? 'success' : 'error');
      logSbKeys("after signin verifyOtp");
      if (err) throw err;
      checkSessionPersistence("signin-verifyOtp");
      try { localStorage.setItem("mu_last_auth", Date.now().toString()); } catch {}
      clearOtpState();
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally { setLoading(false); }
  };

  // ── Google OAuth ─────────────────────────────────────────────────────────────
  const onGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) { setError(err.message); setGoogleLoading(false); }
  };

  const onForgotPassword = async () => {
    setError(""); setInfo("");
    if (!isValidEmail(signinEmail)) { setError("Enter your email above first"); return; }
    setLoading(true);
    try {
      const { error: otpErr } = await supabase.auth.resetPasswordForEmail(signinEmail);
      if (otpErr) throw otpErr;
      try { sessionStorage.setItem("reset_email", signinEmail); } catch {}
      navigate({ to: "/reset-password" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally { setLoading(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // OTP SCREENS
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === "signup-otp" || step === "signin-otp") {
    const isSignup = step === "signup-otp";
    const onVerify = isSignup ? onSignupVerifyOtp : onSigninVerifyOtp;
    return (
      <div className="min-h-[100dvh] flex animate-fade-in">
        <BrandPanel />

        {/* Form area */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#F7F8FA]">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <LongPressLogo className="h-9 w-auto object-contain" />
          </div>

          <div className="w-full max-w-md">
            {/* Back link */}
            <button
              type="button"
              onClick={() => { clearOtpState(); setStep("form"); setOtpCode(""); setError(""); setInfo(""); }}
              className="inline-flex items-center gap-1.5 text-sm text-[#4a5b78] hover:text-[#0C2340] transition-colors mb-8 min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              <span>Back</span>
            </button>

            {/* Header */}
            <div className="mb-8">
              <div className="w-14 h-14 rounded-2xl bg-[#FF6B1A]/10 grid place-items-center mb-5">
                <MailCheck className="w-7 h-7 text-[#FF6B1A]" strokeWidth={1.75} />
              </div>
              <h1 className="text-2xl font-display font-bold text-[#0C2340] mb-2">
                {isSignup ? "Verify your email" : "Check your email"}
              </h1>
              <p className="text-sm text-[#4a5b78] leading-relaxed">
                {isSignup
                  ? <>We sent a 6-digit code to <strong className="text-[#0C2340] font-semibold">{otpEmail}</strong>. Enter it below to finish creating your shop.</>
                  : <>We sent a 6-digit code to <strong className="text-[#0C2340] font-semibold">{otpEmail}</strong>.</>
                }
              </p>
            </div>

            <form onSubmit={onVerify} className="space-y-5">
              {/* OTP input */}
              <div>
                <label className="block text-[13px] font-semibold text-[#0C2340] mb-3">
                  Verification code
                </label>
                <OtpInput
                  length={6}
                  value={otpCode}
                  onChange={(v) => { setOtpCode(v); setError(""); }}
                  onComplete={(v) => setOtpCode(v)}
                  autoFocus
                />
              </div>

              {info && (
                <div className="rounded-xl px-4 py-3 text-sm bg-sky-50 text-sky-700 border border-sky-200/60">
                  {info}
                </div>
              )}
              {error && (
                <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200/60" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full h-12 rounded-xl gradient-primary text-white text-sm font-display font-bold shadow-[0_4px_16px_-4px_rgba(255,107,26,0.45)] hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading
                  ? isSignup ? "Creating your shop…" : "Signing in…"
                  : isSignup ? "Verify & create shop" : "Sign in"
                }
              </button>

              <div className="flex items-center justify-end pt-1">
                <button
                  type="button"
                  disabled={otpCooldown > 0 || sendingOtp}
                  onClick={() => resendOtp(otpEmail, isSignup)}
                  className="text-sm font-semibold flex items-center gap-1.5 text-[#4a5b78] hover:text-[#0C2340] transition-colors disabled:opacity-40 min-h-[44px]"
                >
                  {sendingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />}
                  {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN FORM
  // ─────────────────────────────────────────────────────────────────────────────
  const isSignin = mode === "signin";
  const strength = getStrength(password);

  return (
    <div className="min-h-[100dvh] flex animate-fade-in">
      <BrandPanel />

      {/* Form area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#F7F8FA] overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <LongPressLogo className="h-9 w-auto object-contain" />
        </div>

        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-[28px] font-display font-bold text-[#0C2340] leading-tight mb-1.5">
              {isSignin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-[#4a5b78]">
              {isSignin
                ? "Sign in to your Mystery Unlock account"
                : "Launch your first prize wheel in minutes"}
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-[24px] border border-[#0C2340]/8 shadow-[0_4px_24px_-8px_rgba(12,35,64,0.12)] p-7">

            {/* ── SIGN IN FORM ── */}
            {isSignin && (
              <form onSubmit={onSignin} className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="signin-email" className="block text-[13px] font-semibold text-[#0C2340]">
                    Email
                  </label>
                  <input
                    id="signin-email"
                    type="email"
                    value={signinEmail}
                    onChange={(e) => { setSigninEmail(e.target.value); setError(""); }}
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    className={inputCls}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="signin-password" className="text-[13px] font-semibold text-[#0C2340]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={onForgotPassword}
                      disabled={loading}
                      className="text-xs font-semibold text-[#FF6B1A] hover:opacity-75 transition-opacity disabled:opacity-50 min-h-[44px] flex items-center"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="signin-password"
                      type={showSigninPassword ? "text" : "password"}
                      value={signinPassword}
                      onChange={(e) => { setSigninPassword(e.target.value); setError(""); }}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className={cn(inputCls, "pr-11")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSigninPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[#4a5b78] hover:text-[#0C2340] transition-colors rounded-lg"
                      aria-label={showSigninPassword ? "Hide password" : "Show password"}
                    >
                      {showSigninPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200/60" role="alert">
                    {error}
                  </div>
                )}
                {info && (
                  <div className="rounded-xl px-4 py-3 text-sm bg-sky-50 text-sky-700 border border-sky-200/60">
                    {info}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || sendingOtp}
                  className="w-full h-12 rounded-xl gradient-primary text-white text-sm font-display font-bold shadow-[0_4px_16px_-4px_rgba(255,107,26,0.45)] hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {(loading || sendingOtp) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading || sendingOtp ? "Please wait…" : "Sign In"}
                </button>

                {/* Divider */}
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#0C2340]/8" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-white text-[#4a5b78]">or continue with</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={googleLoading || loading || sendingOtp}
                  className="w-full h-11 rounded-xl border border-[#0C2340]/12 bg-white hover:bg-[#F7F8FA] font-semibold text-sm text-[#0C2340] flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
                  Google
                </button>

                <p className="text-center text-sm text-[#4a5b78]">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("signup"); setError(""); setHintEmail(""); setInfo(""); setEmail(signinEmail); setPassword(""); setSigninPassword(""); }}
                    className="font-semibold text-[#FF6B1A] hover:opacity-75 transition-opacity min-h-[44px] inline-flex items-center"
                  >
                    Sign up
                  </button>
                </p>
              </form>
            )}

            {/* ── SIGN UP FORM ── */}
            {!isSignin && (
              <form onSubmit={onSignupSendOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="shop-name" className="block text-[13px] font-semibold text-[#0C2340]">
                    Shop name
                  </label>
                  <div className="relative">
                    <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a5b78] pointer-events-none" />
                    <input
                      id="shop-name"
                      value={shopName}
                      onChange={(e) => { setShopName(e.target.value); if (!slugTouched.current) setSlug(autoSlug(e.target.value)); setError(""); }}
                      placeholder="Acme Store"
                      maxLength={80}
                      className={cn(inputCls, "pl-10")}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="shop-url" className="block text-[13px] font-semibold text-[#0C2340]">
                    Shop URL
                  </label>
                  <input
                    id="shop-url"
                    value={slug}
                    onChange={(e) => { slugTouched.current = true; setSlug(autoSlug(e.target.value)); }}
                    placeholder="acmestore"
                    maxLength={40}
                    className={inputCls}
                  />
                  <p className="text-xs text-[#4a5b78]/70">
                    mysteryunlock.com/<span className="font-semibold text-[#4a5b78]">{slug || "acmestore"}</span>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="signup-email" className="block text-[13px] font-semibold text-[#0C2340]">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a5b78] pointer-events-none" />
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      required
                      autoComplete="email"
                      placeholder="you@company.com"
                      className={cn(inputCls, "pl-10")}
                    />
                  </div>
                  {(() => {
                    const suggestion = suggestDomain(email);
                    if (!suggestion) return null;
                    const fixed = email.slice(0, email.lastIndexOf("@") + 1) + suggestion;
                    return (
                      <p className="text-xs mt-1 text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2">
                        Did you mean{" "}
                        <button
                          type="button"
                          className="underline font-semibold hover:opacity-75"
                          onClick={() => setEmail(fixed)}
                        >
                          {fixed}
                        </button>
                        ?
                      </p>
                    );
                  })()}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="signup-password" className="block text-[13px] font-semibold text-[#0C2340]">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      required
                      minLength={8}
                      maxLength={128}
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      className={cn(inputCls, "pr-11")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[#4a5b78] hover:text-[#0C2340] transition-colors rounded-lg"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password strength bars */}
                  {password.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {[1, 2, 3].map((level) => (
                        <div
                          key={level}
                          className={cn(
                            "h-1.5 flex-1 rounded-full transition-colors duration-300",
                            strength >= level
                              ? strength === 1 ? "bg-red-500"
                                : strength === 2 ? "bg-amber-500"
                                : "bg-emerald-500"
                              : "bg-[#0C2340]/10"
                          )}
                        />
                      ))}
                    </div>
                  )}
                  {password.length > 0 && (() => {
                    const { errors } = checkPassword(password);
                    return errors.length > 0 ? (
                      <ul className="mt-1.5 space-y-1">
                        {errors.map((e) => (
                          <li key={e} className="text-[11px] flex items-center gap-1.5 text-red-600">
                            <X className="w-3 h-3 shrink-0" strokeWidth={2.5} />
                            {e}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] flex items-center gap-1.5 mt-1.5 text-emerald-600">
                        <Check className="w-3 h-3 shrink-0" strokeWidth={2.5} />
                        Password looks good
                      </p>
                    );
                  })()}
                </div>

                {(error || showSignInHint) && (
                  <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200/60" role="alert">
                    {error || "An account with this email already exists."}
                    {showSignInHint && (
                      <span>
                        {" "}
                        <button
                          type="button"
                          className="underline font-semibold hover:opacity-75"
                          onClick={() => {
                            setMode("signin");
                            setSigninEmail(email);
                            setError("");
                            setHintEmail("");
                            setInfo("");
                            setPassword("");
                            setSigninPassword("");
                          }}
                        >
                          Sign in instead
                        </button>
                      </span>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl gradient-primary text-white text-sm font-display font-bold shadow-[0_4px_16px_-4px_rgba(255,107,26,0.45)] hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px] mt-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Sending code…" : "Create Account"}
                  {!loading && <ChevronRight className="w-4 h-4" strokeWidth={2.5} />}
                </button>

                {/* Divider */}
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#0C2340]/8" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-white text-[#4a5b78]">or</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={googleLoading || loading}
                  className="w-full h-11 rounded-xl border border-[#0C2340]/12 bg-white hover:bg-[#F7F8FA] font-semibold text-sm text-[#0C2340] flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
                  Sign up with Google
                </button>

                <p className="text-center text-sm text-[#4a5b78]">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("signin"); setError(""); setHintEmail(""); setInfo(""); if (email) setSigninEmail(email); setPassword(""); setSigninPassword(""); }}
                    className="font-semibold text-[#FF6B1A] hover:opacity-75 transition-opacity min-h-[44px] inline-flex items-center"
                  >
                    Sign in
                  </button>
                </p>

                <p className="text-center text-xs text-[#4a5b78]/70 max-w-[280px] mx-auto">
                  By creating an account, you agree to our{" "}
                  <Link to="/terms" className="underline hover:opacity-80 text-[#4a5b78]">Terms</Link>
                  {" & "}
                  <Link to="/privacy" className="underline hover:opacity-80 text-[#4a5b78]">Privacy Policy</Link>
                </p>
              </form>
            )}
          </div>

          {/* Security footer — sign in only */}
          {isSignin && (
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[#4a5b78]/70">
              <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Enterprise-grade security</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

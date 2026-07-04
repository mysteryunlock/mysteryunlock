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
} from "lucide-react";

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

import { supabase } from "@/integrations/supabase/client";
import { isValidEmail, checkPassword } from "@/lib/validation";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { createShop } from "@/lib/shops.functions";

export const Route = createFileRoute("/auth")({
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

const strengthColor = (level: number, strength: number) => {
  if (strength < level) return "#E5E7EB";
  if (strength === 1) return "#EF4444";
  if (strength === 2) return "#EAB308";
  return "#10B981";
};

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
        didInteract.current = true;   // prevent the session-check auto-redirect
        setStep(s.step);
        setOtpEmail(s.otpEmail);
        if (s.shopName) setShopName(s.shopName);
        if (s.slug)     setSlug(s.slug);
        if (s.password) setPassword(s.password);
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect already signed-in users (skip during signup-otp so we can create the shop first)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && !didInteract.current && data.session) navigate({ to: "/dashboard" });
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || !session) return;
      if (event === "SIGNED_IN" && stepRef.current !== "signup-otp") navigate({ to: "/dashboard" });
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [navigate]);

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

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (otpErr) throw otpErr;

      setOtpEmail(email);
      setOtpCode("");
      setStep("signup-otp");
      setOtpCooldown(60);
      // Persist so the OTP screen survives a mobile page reload
      saveOtpState({ step: "signup-otp", otpEmail: email, shopName, slug: resolvedSlug, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  };

  // ── SIGN UP: step 2 — verify OTP → create shop → go to dashboard ─────────────
  const onSignupVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otpCode.replace(/\D/g, "");
    if (!/^\d{6,8}$/.test(token)) { setError("Enter the verification code from your email"); return; }
    setError(""); setInfo(""); setLoading(true);
    try {
      const { error: verr } = await supabase.auth.verifyOtp({ email: otpEmail, token, type: "email" });
      if (verr) throw verr;

      // Guard: if the user already has a shop, they tried to re-register an existing account
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

      // Update their password (account was created passwordless via OTP; set the one they chose)
      await supabase.auth.updateUser({ password }).catch(() => {});

      const resolvedSlug = slug || autoSlug(shopName);
      try {
        await doCreateShop({ data: { name: shopName.trim(), slug: resolvedSlug } });
      } catch (shopErr) {
        // Shop creation failed (e.g. slug already taken) — sign the user out and
        // send them back to the form so they can fix the details and try again.
        await supabase.auth.signOut().catch(() => {});
        clearOtpState();
        setStep("form");
        setOtpCode("");
        setLoading(false);
        setError(shopErr instanceof Error ? shopErr.message : "Could not create your shop — please try again");
        return;
      }
      // Mark this device as verified so new sign-ins skip OTP for 3 days
      try { localStorage.setItem("mu_last_auth", Date.now().toString()); } catch {}
      clearOtpState();
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code — request a new one");
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

      const { error: pwErr } = await supabase.auth.signInWithPassword({
        email: signinEmail,
        password: signinPassword,
      });
      if (pwErr) throw pwErr;

      // Check if this device was verified within the last 3 days.
      // If so, skip the OTP step and go straight to the dashboard.
      const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
      try {
        const lastAuth = localStorage.getItem("mu_last_auth");
        if (lastAuth && Date.now() - parseInt(lastAuth, 10) < THREE_DAYS) {
          clearOtpState();
          navigate({ to: "/dashboard" });
          return;
        }
      } catch {}

      // Device not recently verified — sign out and send OTP for email verification
      await supabase.auth.signOut();
      setSendingOtp(true);
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: signinEmail,
        options: { shouldCreateUser: false },
      });
      setSendingOtp(false);
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
      const { error: err } = await supabase.auth.verifyOtp({ email: otpEmail, token, type: "email" });
      if (err) throw err;
      // Mark this device as verified so OTP is skipped for the next 3 days
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
      // resetPasswordForEmail uses the "Reset Password" template — the correct
      // semantic template. We omit redirectTo so there is no broken link;
      // the user just enters the 6-digit {{ .Token }} from the email.
      const { error: otpErr } = await supabase.auth.resetPasswordForEmail(signinEmail);
      if (otpErr) throw otpErr;
      try { sessionStorage.setItem("reset_email", signinEmail); } catch {}
      navigate({ to: "/reset-password" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally { setLoading(false); }
  };

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm border-2 outline-none transition-all font-['Poppins']";
  const fo = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#6F8FA3"; };
  const fb = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#e5e7eb"; };
  // ─────────────────────────────────────────────────────────────────────────────
  // OTP SCREENS (signup-otp and signin-otp share the same layout)
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === "signup-otp" || step === "signin-otp") {
    const isSignup = step === "signup-otp";
    const onVerify = isSignup ? onSignupVerifyOtp : onSigninVerifyOtp;
    return (
      <Shell>
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #2E3C48, #3D5066)" }}
          >
            <MailCheck className="w-7 h-7" style={{ color: "#E8DCC4" }} />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {isSignup ? "Verify your email" : "Check your email"}
          </h1>
          <p className="text-sm text-gray-500 max-w-xs mx-auto">
            {isSignup
              ? <>We sent a 6-digit code to <strong className="text-gray-700">{otpEmail}</strong>. Enter it to finish creating your shop.</>
              : <>We sent a 6-digit code to <strong className="text-gray-700">{otpEmail}</strong>.</>
            }
          </p>
        </div>

        <form onSubmit={onVerify} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">
              Verification code
            </label>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otpCode}
              onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "")); setError(""); }}
              placeholder="000000"
              className="w-full rounded-lg px-4 py-4 text-center text-3xl font-mono tracking-[0.5em] border border-gray-200 outline-none transition-all focus:border-[#6F8FA3] focus:ring-2 focus:ring-[#6F8FA3]/20"
              style={{ color: "#1F2A37" }}
              autoFocus
            />
          </div>

          {info && (
            <div className="rounded-lg px-4 py-3 text-sm bg-blue-50 text-blue-700 border border-blue-100">{info}</div>
          )}
          {error && (
            <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || otpCode.length < 6}
            className="w-full font-semibold h-11 rounded-lg text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#2E3C48", color: "#E8DCC4" }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading
              ? isSignup ? "Creating your shop…" : "Signing in…"
              : isSignup ? "Verify & create shop" : "Sign in"
            }
          </button>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => { clearOtpState(); setStep("form"); setOtpCode(""); setError(""); setInfo(""); }}
              className="text-sm font-medium flex items-center gap-1.5 hover:opacity-70 transition-opacity"
              style={{ color: "#2E3C48" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={otpCooldown > 0 || sendingOtp}
              onClick={() => resendOtp(otpEmail, isSignup)}
              className="text-sm font-medium flex items-center gap-1.5 hover:opacity-70 transition-opacity disabled:opacity-40"
              style={{ color: "#6F8FA3" }}
            >
              {sendingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      </Shell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN FORM
  // ─────────────────────────────────────────────────────────────────────────────
  const isSignin = mode === "signin";
  const strength = getStrength(password);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #2E3C48 0%, #3D5066 100%)",
        fontFamily: "'Poppins', sans-serif",
        color: "#1F2A37",
      }}
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 overflow-hidden my-8">
        <div className="p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={DEFAULT_LOGO} alt="Mystery Unlock" className="h-12 w-auto object-contain" />
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">
              {isSignin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-gray-500">
              {isSignin
                ? "Sign in to your Mystery Unlock account"
                : "Launch your first prize wheel in minutes"}
            </p>
          </div>

          {/* ── SIGN IN FORM ── */}
          {isSignin && (
            <form onSubmit={onSignin} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="signin-email" className="text-sm font-medium text-gray-700 block">
                  Email
                </label>
                <input
                  id="signin-email"
                  type="email"
                  value={signinEmail}
                  onChange={(e) => { setSigninEmail(e.target.value); setError(""); }}
                  required
                  autoComplete="email"
                  placeholder="m.scott@dundermifflin.com"
                  className="w-full rounded-lg px-3 py-2.5 text-sm border border-gray-200 outline-none transition-all focus:ring-2 focus:ring-[#6F8FA3]/30 focus:border-[#6F8FA3]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="signin-password" className="text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    disabled={loading}
                    className="text-sm hover:underline disabled:opacity-60 transition-opacity"
                    style={{ color: "#6F8FA3" }}
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
                    className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm border border-gray-200 outline-none transition-all focus:ring-2 focus:ring-[#6F8FA3]/30 focus:border-[#6F8FA3]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSigninPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showSigninPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>}
              {info && <div className="rounded-lg px-4 py-3 text-sm bg-blue-50 text-blue-700 border border-blue-100">{info}</div>}

              <button
                type="submit"
                disabled={loading || sendingOtp}
                className="w-full font-semibold h-11 rounded-lg text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#2E3C48", color: "#E8DCC4" }}
              >
                {(loading || sendingOtp) && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading || sendingOtp ? "Please wait…" : "Sign In"}
              </button>

              {/* Divider */}
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onGoogleSignIn}
                disabled={googleLoading || loading || sendingOtp}
                className="w-full h-11 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium text-sm flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
              >
                {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
                Google
              </button>

              <p className="text-center text-sm text-gray-500 mt-2">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("signup"); setError(""); setInfo(""); }}
                  className="font-medium hover:underline"
                  style={{ color: "#2E3C48" }}
                >
                  Sign up
                </button>
              </p>
            </form>
          )}

          {/* ── SIGN UP FORM ── */}
          {!isSignin && (
            <form onSubmit={onSignupSendOtp} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="shop-name" className="text-sm font-medium text-gray-700 block">
                  Shop name
                </label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="shop-name"
                    value={shopName}
                    onChange={(e) => { setShopName(e.target.value); if (!slugTouched.current) setSlug(autoSlug(e.target.value)); setError(""); }}
                    placeholder="Acme Store"
                    maxLength={80}
                    className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm border border-gray-200 outline-none transition-all focus:ring-2 focus:ring-[#6F8FA3]/30 focus:border-[#6F8FA3]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="shop-url" className="text-sm font-medium text-gray-700 block">
                  Shop URL
                </label>
                <input
                  id="shop-url"
                  value={slug}
                  onChange={(e) => { slugTouched.current = true; setSlug(autoSlug(e.target.value)); }}
                  placeholder="acmestore"
                  maxLength={40}
                  className="w-full rounded-lg px-3 py-2.5 text-sm border border-gray-200 outline-none transition-all focus:ring-2 focus:ring-[#6F8FA3]/30 focus:border-[#6F8FA3]"
                />
                <p className="text-xs text-gray-400">mysteryunlock.com/{slug || "acmestore"}</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="signup-email" className="text-sm font-medium text-gray-700 block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    required
                    autoComplete="email"
                    placeholder="m.scott@dundermifflin.com"
                    className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm border border-gray-200 outline-none transition-all focus:ring-2 focus:ring-[#6F8FA3]/30 focus:border-[#6F8FA3]"
                  />
                </div>
                {(() => {
                  const suggestion = suggestDomain(email);
                  if (!suggestion) return null;
                  const fixed = email.slice(0, email.lastIndexOf("@") + 1) + suggestion;
                  return (
                    <p className="text-xs mt-1 text-amber-700">
                      Did you mean{" "}
                      <button
                        type="button"
                        className="underline font-semibold"
                        onClick={() => setEmail(fixed)}
                      >
                        {fixed}
                      </button>
                      ?
                    </p>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <label htmlFor="signup-password" className="text-sm font-medium text-gray-700 block">
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
                    className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm border border-gray-200 outline-none transition-all focus:ring-2 focus:ring-[#6F8FA3]/30 focus:border-[#6F8FA3]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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
                        className="h-1 flex-1 rounded-full transition-colors duration-300"
                        style={{ backgroundColor: strengthColor(level, strength) }}
                      />
                    ))}
                  </div>
                )}
                {password.length > 0 && (() => {
                  const { errors } = checkPassword(password);
                  return errors.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {errors.map((e) => (
                        <li key={e} className="text-[11px] flex items-center gap-1 text-red-500">
                          <span>✕</span> {e}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] flex items-center gap-1 mt-1 text-green-600">
                      <span>✓</span> Password looks good
                    </p>
                  );
                })()}
              </div>

              {error && <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full font-semibold h-11 rounded-lg text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
                style={{ backgroundColor: "#2E3C48", color: "#E8DCC4" }}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Sending code…" : "Create Account"}
              </button>

              {/* Divider */}
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full h-11 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium text-sm flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
              >
                {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
                Sign up with Google
              </button>

              <p className="text-center text-sm text-gray-500 mt-2">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("signin"); setError(""); setInfo(""); }}
                  className="font-medium hover:underline"
                  style={{ color: "#2E3C48" }}
                >
                  Sign in
                </button>
              </p>

              <p className="text-center text-xs text-gray-400 max-w-[280px] mx-auto">
                By creating an account, you agree to our{" "}
                <Link to="/terms" className="underline hover:opacity-80">Terms</Link>
                {" & "}
                <Link to="/privacy" className="underline hover:opacity-80">Privacy Policy</Link>
              </p>
            </form>
          )}
        </div>

        {/* Footer — shown on sign-in only */}
        {isSignin && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex items-center justify-center gap-2 text-sm text-gray-500">
            <ShieldCheck className="w-4 h-4" />
            <span>Enterprise-grade security</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{
        background: "linear-gradient(135deg, #2E3C48 0%, #3D5066 100%)",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div className="flex justify-center mb-8">
        <img src={DEFAULT_LOGO} alt="Mystery Unlock" className="h-12 w-auto object-contain" />
      </div>
      <div className="w-full max-w-md bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 p-8">
        {children}
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, MailCheck, RefreshCw, ArrowLeft, ShieldCheck } from "lucide-react";

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

  // ── Forgot password ──────────────────────────────────────────────────────────
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
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #2E3C48, #3D5066)" }}
          >
            <MailCheck className="w-8 h-8" style={{ color: "#E8DCC4" }} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight font-['Poppins']" style={{ color: "#1F2A37" }}>
            {isSignup ? "Verify your email" : "Check your email"}
          </h2>
          <p className="text-sm mt-2 max-w-xs text-gray-500">
            {isSignup
              ? <>We sent a verification code to <strong className="text-gray-700">{otpEmail}</strong>. Enter it to finish creating your shop.</>
              : <>We sent a verification code to <strong className="text-gray-700">{otpEmail}</strong>.</>
            }
          </p>
        </div>

        <form onSubmit={onVerify} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest mb-2 block text-gray-500">
              Verification code
            </label>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otpCode}
              onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "")); setError(""); }}
              placeholder="000000"
              className="w-full rounded-xl px-4 py-4 text-center text-3xl font-mono tracking-[0.5em] border-2 outline-none transition-all"
              style={{ background: "#F8FAFC", borderColor: error ? "#ef4444" : "#e5e7eb", color: "#1F2A37" }}
              autoFocus
              onFocus={e => { e.currentTarget.style.borderColor = error ? "#ef4444" : "#6F8FA3"; }}
              onBlur={e => { e.currentTarget.style.borderColor = error ? "#ef4444" : "#e5e7eb"; }}
            />
          </div>

          {info && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#EEF4F8", color: "#2E3C48" }}>{info}</div>
          )}
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || otpCode.length < 6}
            className="w-full font-semibold py-3.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-['Poppins']"
            style={{ background: "#2E3C48", color: "#E8DCC4" }}
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
              className="text-sm flex items-center gap-1.5 hover:opacity-70 transition-opacity text-gray-400"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={otpCooldown > 0 || sendingOtp}
              onClick={() => resendOtp(otpEmail, isSignup)}
              className="text-sm flex items-center gap-1.5 hover:opacity-70 transition-opacity disabled:opacity-40"
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
  return (
    <div className="min-h-screen flex font-['Poppins']" style={{ background: "linear-gradient(135deg, #2E3C48 0%, #3D5066 100%)" }}>
      {/* Left panel — desktop */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col items-center justify-center relative overflow-hidden px-12"
        style={{ background: "linear-gradient(150deg, #1a2730 0%, #2E3C48 60%, #3D5066 100%)" }}
      >
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6F8FA3, transparent)" }} />
        <div className="absolute bottom-[-5%] right-[-5%] w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #E8DCC4, transparent)" }} />
        <div className="relative z-10 max-w-xs text-white">
          <div className="mb-10">
            <img src={DEFAULT_LOGO} alt="Mystery Unlock" className="h-12 w-auto object-contain" />
          </div>
          <h2 className="text-3xl font-bold leading-tight mb-4 font-['Poppins']">
            Turn every visit into a memorable spin.
          </h2>
          <p className="text-sm opacity-70 leading-relaxed mb-8">
            Brand your wheel, share a QR code, and track every winner from one beautiful dashboard.
          </p>
          <div className="space-y-3">
            {["Custom-branded prize wheels", "QR code sharing in seconds", "Real-time winner dashboard", "WhatsApp & email notifications"].map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm opacity-80">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#E8DCC422" }}>
                  <svg viewBox="0 0 12 12" className="w-3 h-3" aria-hidden>
                    <polyline points="2,6 5,9 10,3" fill="none" stroke="#E8DCC4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile brand */}
        <div className="flex lg:hidden flex-col items-center mb-8">
          <img src={DEFAULT_LOGO} alt="Mystery Unlock" className="h-12 w-auto object-contain mb-3" />
        </div>

        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.15)] border border-gray-100 overflow-hidden">
            <div className="p-8">
              {/* Mode tabs */}
              <div className="flex rounded-xl p-1 mb-6 bg-gray-100 border border-gray-200">
                {(["signup", "signin"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(""); setInfo(""); }}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: mode === m ? "#2E3C48" : "transparent",
                      color: mode === m ? "#E8DCC4" : "#6F8FA3",
                      boxShadow: mode === m ? "0 2px 8px rgba(46,60,72,0.3)" : "none",
                    }}
                  >
                    {m === "signup" ? "Create shop" : "Sign in"}
                  </button>
                ))}
              </div>

              {/* ── CREATE SHOP ── */}
              {mode === "signup" && (
                <form onSubmit={onSignupSendOtp} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Shop name</label>
                    <input
                      value={shopName}
                      onChange={(e) => { setShopName(e.target.value); if (!slugTouched.current) setSlug(autoSlug(e.target.value)); setError(""); }}
                      placeholder="My Mobile Shop"
                      maxLength={80}
                      className={inputCls}
                      style={{ background: "#F8FAFC", borderColor: "#e5e7eb", color: "#1F2A37" }}
                      onFocus={fo} onBlur={fb}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Shop URL</label>
                    <div
                      className="flex items-center rounded-xl px-4 py-3 border-2 transition-all"
                      style={{ background: "#F8FAFC", borderColor: "#e5e7eb" }}
                      onFocusCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#6F8FA3"}
                      onBlurCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#e5e7eb"}
                    >
                      <span className="text-sm mr-1 text-gray-400">/s/</span>
                      <input
                        value={slug}
                        onChange={(e) => { slugTouched.current = true; setSlug(autoSlug(e.target.value)); }}
                        placeholder="my-mobile-shop"
                        maxLength={40}
                        className="flex-1 bg-transparent text-sm outline-none font-['Poppins']"
                        style={{ color: "#1F2A37" }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={inputCls}
                      style={{ background: "#F8FAFC", borderColor: "#e5e7eb", color: "#1F2A37" }}
                      onFocus={fo} onBlur={fb}
                    />
                    {(() => {
                      const suggestion = suggestDomain(email);
                      if (!suggestion) return null;
                      const fixed = email.slice(0, email.lastIndexOf("@") + 1) + suggestion;
                      return (
                        <p className="text-xs mt-1" style={{ color: "#b45309" }}>
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

                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                        required
                        minLength={8}
                        maxLength={128}
                        placeholder="Min. 8 characters"
                        autoComplete="new-password"
                        className={`${inputCls} pr-12`}
                        style={{ background: "#F8FAFC", borderColor: "#e5e7eb", color: "#1F2A37" }}
                        onFocus={fo} onBlur={fb}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity text-gray-400"
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    {password.length > 0 && (() => {
                      const strength = password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
                      return (
                        <div className="flex gap-1 mt-2">
                          {[1, 2, 3].map((level) => (
                            <div
                              key={level}
                              className="h-1 flex-1 rounded-full transition-colors duration-300"
                              style={{
                                backgroundColor: strength >= level
                                  ? (strength === 1 ? '#EF4444' : strength === 2 ? '#EAB308' : '#10B981')
                                  : '#E5E7EB'
                              }}
                            />
                          ))}
                        </div>
                      );
                    })()}
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

                  {error && <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full font-semibold py-3.5 rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "#2E3C48", color: "#E8DCC4" }}
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? "Sending code…" : "Continue — verify email"}
                  </button>

                  <p className="text-xs text-center text-gray-400">
                    We'll email you a verification code to confirm your address.
                  </p>

                  <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs font-medium text-gray-400">or</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    disabled={googleLoading || loading}
                    className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-semibold border-2 transition-all active:scale-[0.98] disabled:opacity-60 hover:bg-gray-50 border-gray-200 text-gray-700 bg-white"
                  >
                    {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
                    Continue with Google
                  </button>
                </form>
              )}

              {/* ── SIGN IN ── */}
              {mode === "signin" && (
                <form onSubmit={onSignin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Email</label>
                    <input
                      type="email"
                      value={signinEmail}
                      onChange={(e) => { setSigninEmail(e.target.value); setError(""); }}
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={inputCls}
                      style={{ background: "#F8FAFC", borderColor: "#e5e7eb", color: "#1F2A37" }}
                      onFocus={fo} onBlur={fb}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Password</label>
                      <button
                        type="button"
                        onClick={onForgotPassword}
                        disabled={loading}
                        className="text-xs hover:underline disabled:opacity-60"
                        style={{ color: "#6F8FA3" }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showSigninPassword ? "text" : "password"}
                        value={signinPassword}
                        onChange={(e) => { setSigninPassword(e.target.value); setError(""); }}
                        required
                        minLength={6}
                        placeholder="Your password"
                        autoComplete="current-password"
                        className={`${inputCls} pr-12`}
                        style={{ background: "#F8FAFC", borderColor: "#e5e7eb", color: "#1F2A37" }}
                        onFocus={fo} onBlur={fb}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSigninPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity text-gray-400"
                      >
                        {showSigninPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  {error && <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>}
                  {info && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#EEF4F8", color: "#2E3C48" }}>{info}</div>}

                  <button
                    type="submit"
                    disabled={loading || sendingOtp}
                    className="w-full font-semibold py-3.5 rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: "#2E3C48", color: "#E8DCC4" }}
                  >
                    {(loading || sendingOtp) && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading || sendingOtp ? "Please wait…" : "Sign in"}
                  </button>

                  <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs font-medium text-gray-400">or</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    disabled={googleLoading || loading || sendingOtp}
                    className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-semibold border-2 transition-all active:scale-[0.98] disabled:opacity-60 hover:bg-gray-50 border-gray-200 text-gray-700 bg-white"
                  >
                    {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
                    Continue with Google
                  </button>
                </form>
              )}

              <div className="mt-5 text-center">
                <Link
                  to="/"
                  className="text-xs flex items-center justify-center gap-1.5 hover:opacity-70 transition-opacity text-gray-400"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to home
                </Link>
              </div>
            </div>

            {/* Trust footer */}
            <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Enterprise-grade security</span>
              </div>
              <p className="text-xs text-gray-400">
                <Link to="/terms" className="underline hover:opacity-80">Terms</Link>
                {" & "}
                <Link to="/privacy" className="underline hover:opacity-80">Privacy</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 font-['Poppins']" style={{ background: "linear-gradient(135deg, #2E3C48 0%, #3D5066 100%)" }}>
      <div className="mb-8">
        <img src={DEFAULT_LOGO} alt="Mystery Unlock" className="h-12 w-auto object-contain" />
      </div>
      <div className="w-full max-w-md bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.15)] border border-gray-100 p-8">
        {children}
      </div>
    </div>
  );
}

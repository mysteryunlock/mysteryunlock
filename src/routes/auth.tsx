import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Eye, EyeOff, Loader2, MailCheck, RefreshCw,
  Clock, CheckCircle2, XCircle, ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail } from "@/lib/validation";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { submitSignupRequest, getSignupRequestStatus } from "@/lib/pending-signups.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Mystery Unlock" },
      { name: "description", content: "Create a shop or sign in to manage your Mystery Unlock campaign." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";
// "signup-otp" = email verification during signup flow
// "signin-otp" = step-up OTP after password check
type Step = "form" | "signup-otp" | "signin-otp" | "submitted";

function AuthPage() {
  const navigate = useNavigate();
  const submitRequest = useServerFn(submitSignupRequest);
  const checkStatus = useServerFn(getSignupRequestStatus);

  const [mode, setMode] = useState<Mode>("signup");
  const [step, setStep] = useState<Step>("form");

  // Shared OTP state
  const [otpEmail, setOtpEmail] = useState(""); // which email the OTP was sent to
  const [otpCode, setOtpCode] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Sign-in fields
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [showSigninPassword, setShowSigninPassword] = useState(false);

  // Signup fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");

  // Feedback
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [requestStatus, setRequestStatus] = useState<null | {
    status: "pending" | "approved" | "rejected";
    review_notes: string | null;
    reviewed_at: string | null;
    created_at: string;
  }>(null);

  const didInteract = useRef(false);

  // Redirect already signed-in users
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && !didInteract.current && data.session) navigate({ to: "/dashboard" });
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Only auto-navigate on SIGNED_IN if we're not in the middle of a signup OTP flow
      if (cancelled || !session) return;
      if (event === "SIGNED_IN" && step !== "signup-otp") navigate({ to: "/dashboard" });
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [navigate, step]);

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

  // ── SIGNUP: step 1 — validate + send OTP ────────────────────────────────────
  const onSignupSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    didInteract.current = true;
    setError(""); setInfo(""); setLoading(true);
    try {
      if (!shopName.trim()) throw new Error("Shop name is required");
      if (!isValidEmail(email)) throw new Error("Please enter a valid email address");
      if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");
      const desiredSlug = slug || autoSlug(shopName);
      if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(desiredSlug))
        throw new Error("Shop URL can only contain lowercase letters, numbers and dashes");

      // Send a verification OTP — creates Supabase user if needed
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (otpErr) throw otpErr;

      // Store the resolved slug back in state
      if (!slug) setSlug(desiredSlug);
      setOtpEmail(email);
      setOtpCode("");
      setStep("signup-otp");
      setOtpCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  };

  // ── SIGNUP: step 2 — verify OTP → save request → sign out → show pending ───
  const onSignupVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otpCode.replace(/\D/g, "");
    if (!/^\d{6}$/.test(token)) { setError("Enter the 6-digit code from your email"); return; }
    setError(""); setInfo(""); setLoading(true);
    try {
      const { error: verr } = await supabase.auth.verifyOtp({ email: otpEmail, token, type: "email" });
      if (verr) throw verr;

      // Email verified — now save the shop request
      const resolvedSlug = slug || autoSlug(shopName);
      await submitRequest({
        data: {
          shop_name: shopName.trim(),
          slug: resolvedSlug,
          email: otpEmail,
          password,
        },
      });

      // Sign the user back out — they can't access the dashboard until admin approves
      await supabase.auth.signOut();
      setStep("submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  };

  // ── SIGN IN: password → then OTP ────────────────────────────────────────────
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
      if (pwErr) {
        // Check for pending signup request before surfacing raw error
        try {
          const res = await checkStatus({ data: { email: signinEmail } });
          if (res.request) {
            setRequestStatus(res.request as typeof requestStatus);
            setStep("submitted");
            return;
          }
        } catch {/* ignore */}
        throw pwErr;
      }

      // Password OK — sign out and require OTP step-up
      await supabase.auth.signOut();
      setSendingOtp(true);
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: signinEmail,
        options: { shouldCreateUser: false },
      });
      setSendingOtp(false);
      if (otpErr) throw otpErr;

      setOtpEmail(signinEmail);
      setOtpCode("");
      setStep("signin-otp");
      setOtpCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSendingOtp(false);
    } finally { setLoading(false); }
  };

  // ── SIGN IN: verify OTP ──────────────────────────────────────────────────────
  const onSigninVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otpCode.replace(/\D/g, "");
    if (!/^\d{6}$/.test(token)) { setError("Enter the 6-digit code from your email"); return; }
    setError(""); setInfo(""); setLoading(true);
    try {
      const { error: err } = await supabase.auth.verifyOtp({ email: otpEmail, token, type: "email" });
      if (err) throw err;
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally { setLoading(false); }
  };

  // ── Forgot password ──────────────────────────────────────────────────────────
  const onForgotPassword = async () => {
    setError(""); setInfo("");
    if (!isValidEmail(signinEmail)) { setError("Enter your email above first"); return; }
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(signinEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      try { sessionStorage.setItem("reset_email", signinEmail); } catch {}
      setInfo("Reset link sent! Check your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally { setLoading(false); }
  };

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm border-2 outline-none transition-all";
  const fo = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#ff6b1a"; };
  const fb = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#D6E6EF"; };

  // ─────────────────────────────────────────────────────────────────────────────
  // SUBMITTED STEP
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === "submitted") {
    const status = requestStatus?.status ?? "pending";
    return (
      <Shell>
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            {status === "pending" && <Clock className="text-amber-500" size={52} />}
            {status === "approved" && <CheckCircle2 className="text-emerald-500" size={52} />}
            {status === "rejected" && <XCircle className="text-red-500" size={52} />}
          </div>
          {status === "pending" && (
            <>
              <h2 className="text-xl font-black" style={{ color: "#2A3E4B", fontFamily: "'Space Grotesk', sans-serif" }}>
                Request submitted!
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "#2A3E4B99" }}>
                Your email is verified. Your shop request for{" "}
                <strong style={{ color: "#2A3E4B" }}>{otpEmail || email}</strong> is now
                waiting for admin review — usually within 24 hours.
              </p>
            </>
          )}
          {status === "approved" && (
            <>
              <h2 className="text-xl font-black" style={{ color: "#2A3E4B", fontFamily: "'Space Grotesk', sans-serif" }}>You're approved!</h2>
              <p className="text-sm" style={{ color: "#2A3E4B99" }}>Your account is active. Sign in to continue.</p>
              <button
                onClick={() => { setStep("form"); setMode("signin"); setRequestStatus(null); }}
                className="w-full font-bold py-3 rounded-xl text-sm"
                style={{ background: "linear-gradient(135deg, #ff6b1a, #ff8c42)", color: "white" }}
              >Sign in now</button>
            </>
          )}
          {status === "rejected" && (
            <>
              <h2 className="text-xl font-black" style={{ color: "#2A3E4B", fontFamily: "'Space Grotesk', sans-serif" }}>Request declined</h2>
              <p className="text-sm" style={{ color: "#2A3E4B99" }}>
                Your signup request was declined.
                {requestStatus?.review_notes && <><br /><em className="mt-1 block">"{requestStatus.review_notes}"</em></>}
              </p>
              <p className="text-xs mt-1" style={{ color: "#2A3E4B60" }}>Questions? <a href="mailto:support@mysteryunlock.com" className="underline">support@mysteryunlock.com</a></p>
            </>
          )}
          <button
            onClick={() => { setStep("form"); setRequestStatus(null); setOtpCode(""); }}
            className="w-full text-sm flex items-center justify-center gap-1.5 hover:opacity-70 transition-opacity mt-2"
            style={{ color: "#2A3E4B99" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
          </button>
        </div>
      </Shell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // OTP STEPS (signup-otp and signin-otp share the same UI)
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === "signup-otp" || step === "signin-otp") {
    const isSignup = step === "signup-otp";
    const onVerify = isSignup ? onSignupVerifyOtp : onSigninVerifyOtp;
    return (
      <Shell>
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #D6E6EF, #b8d4e3)" }}
          >
            <MailCheck className="w-8 h-8" style={{ color: "#2A3E4B" }} />
          </div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: "#2A3E4B", fontFamily: "'Space Grotesk', sans-serif" }}>
            {isSignup ? "Verify your email" : "Check your email"}
          </h2>
          <p className="text-sm mt-2 max-w-xs" style={{ color: "#2A3E4B99" }}>
            {isSignup
              ? <>We sent a 6-digit code to <strong style={{ color: "#2A3E4B" }}>{otpEmail}</strong>. Enter it to verify your email and submit your shop request.</>
              : <>We sent a 6-digit sign-in code to <strong style={{ color: "#2A3E4B" }}>{otpEmail}</strong>.</>
            }
          </p>
        </div>

        <form onSubmit={onVerify} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "#2A3E4B99" }}>
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
              style={{ background: "#F7FBFD", borderColor: error ? "#ef4444" : "#D6E6EF", color: "#2A3E4B" }}
              autoFocus
              onFocus={e => { e.currentTarget.style.borderColor = error ? "#ef4444" : "#ff6b1a"; }}
              onBlur={e => { e.currentTarget.style.borderColor = error ? "#ef4444" : "#D6E6EF"; }}
            />
          </div>

          {info && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#D6E6EF", color: "#2A3E4B" }}>{info}</div>}
          {error && <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>}

          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            className="w-full font-bold py-3.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #ff6b1a, #ff8c42)", color: "white", boxShadow: "0 8px 24px #ff6b1a40" }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading
              ? isSignup ? "Submitting request…" : "Verifying…"
              : isSignup ? "Verify & submit request" : "Sign in"
            }
          </button>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => { setStep("form"); setOtpCode(""); setError(""); setInfo(""); }}
              className="text-sm flex items-center gap-1.5 hover:opacity-70 transition-opacity"
              style={{ color: "#2A3E4B99" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={otpCooldown > 0 || sendingOtp}
              onClick={() => resendOtp(otpEmail, isSignup)}
              className="text-sm flex items-center gap-1.5 hover:opacity-70 transition-opacity disabled:opacity-40"
              style={{ color: "#7FA6B8" }}
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
  // MAIN FORM (split-screen layout)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex" style={{ background: "#F7FBFD" }}>

      {/* Left panel — desktop only */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col items-center justify-center relative overflow-hidden px-12"
        style={{ background: "linear-gradient(150deg, #2A3E4B 0%, #1a2f38 60%, #0f1e26 100%)" }}
      >
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #7FA6B8, transparent)" }} />
        <div className="absolute bottom-[-5%] right-[-5%] w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #ff6b1a, transparent)" }} />

        <div className="relative z-10 max-w-xs text-white">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/10 flex items-center justify-center ring-1 ring-white/20">
              <img src={DEFAULT_LOGO} alt="Mystery Unlock" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="text-lg font-black tracking-wider">MYSTERY UNLOCK</div>
              <div className="text-xs tracking-[0.2em] opacity-60 uppercase">Shop Owner Portal</div>
            </div>
          </div>
          <h2 className="text-3xl font-black leading-tight mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Turn every visit into a memorable spin.
          </h2>
          <p className="text-sm opacity-70 leading-relaxed mb-8">
            Brand your wheel, share a QR code, and track every winner from one beautiful dashboard.
          </p>
          <div className="space-y-3">
            {["Custom-branded prize wheels", "QR code sharing in seconds", "Real-time winner dashboard", "WhatsApp & email notifications"].map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm opacity-80">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#ff6b1a22" }}>
                  <svg viewBox="0 0 12 12" className="w-3 h-3" aria-hidden>
                    <polyline points="2,6 5,9 10,3" fill="none" stroke="#ff6b1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
          <img src={DEFAULT_LOGO} alt="" className="w-16 h-16 rounded-2xl object-cover mb-3 ring-1 ring-black/10" />
          <div className="text-xl font-black tracking-wider" style={{ color: "#2A3E4B", fontFamily: "'Space Grotesk', sans-serif" }}>MYSTERY UNLOCK</div>
          <div className="text-xs tracking-[0.3em] uppercase mt-0.5" style={{ color: "#ff6b1a" }}>Shop Owner Portal</div>
        </div>

        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl shadow-black/5 border p-8" style={{ borderColor: "#2A3E4B0f" }}>

            {/* Mode tabs */}
            <div className="flex rounded-xl p-1 mb-6" style={{ background: "#F7FBFD", border: "1px solid #D6E6EF" }}>
              {(["signup", "signin"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(""); setInfo(""); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: mode === m ? "linear-gradient(135deg, #ff6b1a, #ff8c42)" : "transparent",
                    color: mode === m ? "white" : "#2A3E4B80",
                    boxShadow: mode === m ? "0 4px 12px #ff6b1a33" : "none",
                  }}
                >
                  {m === "signup" ? "Request shop" : "Sign in"}
                </button>
              ))}
            </div>

            {/* ── SIGN UP ── */}
            {mode === "signup" && (
              <form onSubmit={onSignupSendOtp} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2A3E4B80" }}>Shop name</label>
                  <input
                    value={shopName}
                    onChange={(e) => { setShopName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)); setError(""); }}
                    placeholder="My Mobile Shop"
                    maxLength={80}
                    className={inputCls}
                    style={{ background: "#F7FBFD", borderColor: "#D6E6EF", color: "#2A3E4B" }}
                    onFocus={fo} onBlur={fb}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2A3E4B80" }}>Shop URL</label>
                  <div
                    className="flex items-center rounded-xl px-4 py-3 border-2 transition-all"
                    style={{ background: "#F7FBFD", borderColor: "#D6E6EF" }}
                    onFocusCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#ff6b1a"}
                    onBlurCapture={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#D6E6EF"}
                  >
                    <span className="text-sm mr-1" style={{ color: "#2A3E4B50" }}>/s/</span>
                    <input
                      value={slug}
                      onChange={(e) => setSlug(autoSlug(e.target.value))}
                      placeholder="my-mobile-shop"
                      maxLength={40}
                      className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: "#2A3E4B" }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2A3E4B80" }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={inputCls}
                    style={{ background: "#F7FBFD", borderColor: "#D6E6EF", color: "#2A3E4B" }}
                    onFocus={fo} onBlur={fb}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2A3E4B80" }}>Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      required
                      minLength={6}
                      placeholder="Min. 6 characters"
                      autoComplete="new-password"
                      className={`${inputCls} pr-12`}
                      style={{ background: "#F7FBFD", borderColor: "#D6E6EF", color: "#2A3E4B" }}
                      onFocus={fo} onBlur={fb}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                      style={{ color: "#2A3E4B60" }}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {error && <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full font-bold py-3.5 rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #ff6b1a, #ff8c42)", color: "white", boxShadow: "0 8px 24px #ff6b1a40" }}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Sending code…" : "Continue — verify email"}
                </button>

                <p className="text-xs text-center" style={{ color: "#2A3E4B80" }}>
                  We'll email you a code to verify your address, then an admin reviews your shop request.
                </p>
              </form>
            )}

            {/* ── SIGN IN ── */}
            {mode === "signin" && (
              <form onSubmit={onSignin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2A3E4B80" }}>Email</label>
                  <input
                    type="email"
                    value={signinEmail}
                    onChange={(e) => { setSigninEmail(e.target.value); setError(""); }}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={inputCls}
                    style={{ background: "#F7FBFD", borderColor: "#D6E6EF", color: "#2A3E4B" }}
                    onFocus={fo} onBlur={fb}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2A3E4B80" }}>Password</label>
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
                      style={{ background: "#F7FBFD", borderColor: "#D6E6EF", color: "#2A3E4B" }}
                      onFocus={fo} onBlur={fb}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSigninPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                      style={{ color: "#2A3E4B60" }}
                    >
                      {showSigninPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={onForgotPassword}
                      disabled={loading}
                      className="text-xs hover:underline disabled:opacity-60 transition-opacity"
                      style={{ color: "#7FA6B8" }}
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                {error && <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>}
                {info && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#D6E6EF", color: "#2A3E4B" }}>{info}</div>}

                <button
                  type="submit"
                  disabled={loading || sendingOtp}
                  className="w-full font-bold py-3.5 rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #ff6b1a, #ff8c42)", color: "white", boxShadow: "0 8px 24px #ff6b1a40" }}
                >
                  {(loading || sendingOtp) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading || sendingOtp ? "Please wait…" : "Sign in"}
                </button>
              </form>
            )}

            <div className="mt-5 text-center">
              <Link
                to="/"
                className="text-xs flex items-center justify-center gap-1.5 hover:opacity-70 transition-opacity"
                style={{ color: "#2A3E4B80" }}
              >
                <ArrowLeft className="w-3 h-3" /> Back to home
              </Link>
            </div>
          </div>

          <p className="text-xs text-center mt-4" style={{ color: "#2A3E4B60" }}>
            By signing in you agree to our{" "}
            <Link to="/terms" className="underline hover:opacity-80">Terms</Link>
            {" & "}
            <Link to="/privacy" className="underline hover:opacity-80">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: "#F7FBFD" }}>
      <div className="flex items-center gap-3 mb-8">
        <img src={DEFAULT_LOGO} alt="" className="w-10 h-10 rounded-xl object-cover ring-1 ring-black/10" />
        <div>
          <div className="text-base font-black tracking-wider" style={{ color: "#2A3E4B", fontFamily: "'Space Grotesk', sans-serif" }}>MYSTERY UNLOCK</div>
          <div className="text-xs tracking-[0.2em] uppercase" style={{ color: "#ff6b1a" }}>Shop Owner Portal</div>
        </div>
      </div>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-black/5 border p-8" style={{ borderColor: "#2A3E4B0f" }}>
        {children}
      </div>
    </div>
  );
}

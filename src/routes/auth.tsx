import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, MailCheck, RefreshCw, Clock, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
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

// ── Device trust ──────────────────────────────────────────────────────────────
const TRUSTED_KEY = "mu_trusted_ts";
const TRUST_TTL = 2 * 24 * 60 * 60 * 1000; // 2 days

function isTrustedDevice(): boolean {
  try {
    const ts = localStorage.getItem(TRUSTED_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < TRUST_TTL;
  } catch { return false; }
}
function trustDevice() {
  try { localStorage.setItem(TRUSTED_KEY, String(Date.now())); } catch {}
}

// ── Google logo SVG ───────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

type Step = "form" | "otp-verify" | "submitted";

function AuthPage() {
  const navigate = useNavigate();
  const submitRequest = useServerFn(submitSignupRequest);
  const checkStatus = useServerFn(getSignupRequestStatus);

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [step, setStep] = useState<Step>("form");

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");

  // OTP step
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Status / feedback
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

  const interactedRef = useRef(false);

  // Redirect already-signed-in users
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || interactedRef.current) return;
      if (data.session) navigate({ to: "/dashboard" });
    })();
    // Handle OAuth / magic-link redirect
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if ((event === "SIGNED_IN") && session) {
        trustDevice();
        navigate({ to: "/dashboard" });
      }
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [navigate]);

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  const autoSlug = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  // ── Google OAuth ─────────────────────────────────────────────────────────────
  const onGoogleSignIn = async () => {
    interactedRef.current = true;
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (err) setError(err.message);
  };

  // ── Send OTP helper ───────────────────────────────────────────────────────────
  const sendOtp = useCallback(async (target: string) => {
    setSendingOtp(true);
    setError(""); setInfo("");
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: target,
        options: { shouldCreateUser: false },
      });
      if (err) throw err;
      setInfo("A 6-digit code was sent to your email.");
      setOtpCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code. Please try again.");
    } finally { setSendingOtp(false); }
  }, []);

  // ── Verify OTP ────────────────────────────────────────────────────────────────
  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otpCode.replace(/\D/g, "");
    if (!/^\d{6}$/.test(token)) { setError("Enter the 6-digit code from your email"); return; }
    setError(""); setInfo(""); setLoading(true);
    try {
      const { error: err } = await supabase.auth.verifyOtp({ email: otpEmail, token, type: "email" });
      if (err) throw err;
      trustDevice();
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally { setLoading(false); }
  };

  // ── Forgot password ───────────────────────────────────────────────────────────
  const onForgotPassword = async () => {
    setError(""); setInfo("");
    if (!isValidEmail(email)) { setError("Enter your email above first"); return; }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      try { sessionStorage.setItem("reset_email", email); } catch {}
      setInfo("Reset link sent! Check your email.");
      setTimeout(() => navigate({ to: "/reset-password" }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally { setLoading(false); }
  };

  // ── Main form submit ──────────────────────────────────────────────────────────
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    interactedRef.current = true;
    setError(""); setInfo(""); setLoading(true);
    try {
      if (!isValidEmail(email)) throw new Error("Please enter a valid email address");
      if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");

      if (mode === "signup") {
        const desiredSlug = slug || autoSlug(shopName);
        if (!shopName.trim()) throw new Error("Shop name is required");
        if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(desiredSlug))
          throw new Error("Shop URL can only contain lowercase letters, numbers and dashes");
        await submitRequest({ data: { shop_name: shopName.trim(), slug: desiredSlug, email, password } });
        setStep("submitted");
      } else {
        const { error: e1 } = await supabase.auth.signInWithPassword({ email, password });
        if (e1) {
          try {
            const res = await checkStatus({ data: { email } });
            if (res.request) { setRequestStatus(res.request as typeof requestStatus); setStep("submitted"); return; }
          } catch {/* ignore */}
          throw e1;
        }
        // Step-up: require email OTP if device is not trusted or session is stale
        if (!isTrustedDevice()) {
          await supabase.auth.signOut();
          setOtpEmail(email);
          setStep("otp-verify");
          await sendOtp(email);
        } else {
          navigate({ to: "/dashboard" });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // OTP VERIFY STEP
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === "otp-verify") {
    return (
      <AuthShell>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, #D6E6EF, #b8d4e3)" }}>
            <MailCheck className="w-8 h-8" style={{ color: "#2A3E4B" }} />
          </div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: "#2A3E4B", fontFamily: "'Space Grotesk', sans-serif" }}>
            Verify your identity
          </h2>
          <p className="text-sm mt-2 max-w-xs" style={{ color: "#2A3E4B99" }}>
            We sent a 6-digit code to <strong style={{ color: "#2A3E4B" }}>{otpEmail}</strong> to confirm it's you.
          </p>
        </div>

        <form onSubmit={onVerifyOtp} className="space-y-4">
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
              style={{
                background: "#F7FBFD",
                borderColor: error ? "#ef4444" : "#D6E6EF",
                color: "#2A3E4B",
              }}
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>
          )}
          {info && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#D6E6EF", color: "#2A3E4B" }}>{info}</div>
          )}

          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            className="w-full font-bold py-3.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #ff6b1a, #ff8c42)", color: "white" }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Verifying…" : "Verify & sign in"}
          </button>

          <div className="flex items-center justify-between">
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
              onClick={() => sendOtp(otpEmail)}
              className="text-sm flex items-center gap-1.5 hover:opacity-70 transition-opacity disabled:opacity-40"
              style={{ color: "#7FA6B8" }}
            >
              {sendingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Resend code"}
            </button>
          </div>
        </form>

        <p className="text-xs text-center mt-6" style={{ color: "#2A3E4B60" }}>
          This keeps your shop secure when signing in from a new device or after a few days.
        </p>
      </AuthShell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUBMITTED STEP
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === "submitted") {
    const status = requestStatus?.status ?? "pending";
    return (
      <AuthShell>
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            {status === "pending" && <Clock className="text-amber-500" size={52} />}
            {status === "approved" && <CheckCircle2 className="text-emerald-500" size={52} />}
            {status === "rejected" && <XCircle className="text-red-500" size={52} />}
          </div>

          {status === "pending" && (
            <>
              <h2 className="text-xl font-black" style={{ color: "#2A3E4B", fontFamily: "'Space Grotesk', sans-serif" }}>Request submitted</h2>
              <p className="text-sm" style={{ color: "#2A3E4B99" }}>
                Thanks! Your shop request for <strong style={{ color: "#2A3E4B" }}>{email}</strong> is waiting for admin review.
                You'll receive an email once it's approved — usually within 24 hours.
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
              <p className="text-xs" style={{ color: "#2A3E4B60" }}>Questions? <a href="mailto:support@mysteryunlock.com" className="underline">support@mysteryunlock.com</a></p>
            </>
          )}

          <button
            onClick={() => { setStep("form"); setRequestStatus(null); }}
            className="w-full text-sm mt-2 flex items-center justify-center gap-1.5 hover:opacity-70 transition-opacity"
            style={{ color: "#2A3E4B99" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
          </button>
        </div>
      </AuthShell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN FORM
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex"
      style={{ background: "#F7FBFD" }}
    >
      {/* Left panel — desktop only */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col items-center justify-center relative overflow-hidden px-12"
        style={{ background: "linear-gradient(150deg, #2A3E4B 0%, #1a2f38 60%, #0f1e26 100%)" }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #7FA6B8, transparent)" }} />
        <div className="absolute bottom-[-5%] right-[-5%] w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #ff6b1a, transparent)" }} />
        <div className="absolute top-[40%] right-[-15%] w-64 h-64 rounded-full opacity-5" style={{ background: "radial-gradient(circle, #D6E6EF, transparent)" }} />

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
            {[
              "Custom-branded prize wheels",
              "QR code sharing in seconds",
              "Real-time winner dashboard",
              "WhatsApp & email notifications",
            ].map((f) => (
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

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile brand header */}
        <div className="flex lg:hidden flex-col items-center mb-8">
          <img src={DEFAULT_LOGO} alt="" className="w-16 h-16 rounded-2xl object-cover mb-3 ring-1 ring-black/10" />
          <div className="text-xl font-black tracking-wider" style={{ color: "#2A3E4B", fontFamily: "'Space Grotesk', sans-serif" }}>MYSTERY UNLOCK</div>
          <div className="text-xs tracking-[0.3em] uppercase mt-0.5" style={{ color: "#ff6b1a" }}>Shop Owner Portal</div>
        </div>

        <div className="w-full max-w-md">
          <form
            onSubmit={onSubmit}
            onInput={() => { interactedRef.current = true; }}
            className="bg-white rounded-3xl shadow-xl shadow-black/5 border p-8 space-y-4"
            style={{ borderColor: "#2A3E4B0f" }}
          >
            {/* Tabs */}
            <div className="flex rounded-xl p-1 mb-2" style={{ background: "#F7FBFD", border: "1px solid #D6E6EF" }}>
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(""); setInfo(""); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: mode === "signup" ? "linear-gradient(135deg, #ff6b1a, #ff8c42)" : "transparent",
                  color: mode === "signup" ? "white" : "#2A3E4B80",
                  boxShadow: mode === "signup" ? "0 4px 12px #ff6b1a33" : "none",
                }}
              >
                Request shop
              </button>
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(""); setInfo(""); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: mode === "signin" ? "linear-gradient(135deg, #ff6b1a, #ff8c42)" : "transparent",
                  color: mode === "signin" ? "white" : "#2A3E4B80",
                  boxShadow: mode === "signin" ? "0 4px 12px #ff6b1a33" : "none",
                }}
              >
                Sign in
              </button>
            </div>

            {/* Google OAuth */}
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border text-sm font-semibold transition-all hover:bg-gray-50 active:scale-[0.98]"
              style={{ borderColor: "#2A3E4B20", color: "#2A3E4B" }}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "#2A3E4B14" }} />
              <span className="text-xs font-medium" style={{ color: "#2A3E4B60" }}>or continue with email</span>
              <div className="flex-1 h-px" style={{ background: "#2A3E4B14" }} />
            </div>

            {/* Signup extra fields */}
            {mode === "signup" && (
              <>
                <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "#FFF8F0", border: "1px solid #ff6b1a33", color: "#2A3E4B99" }}>
                  <strong style={{ color: "#2A3E4B" }}>Admin approval required.</strong> We review every new shop before activation to keep the platform safe.
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2A3E4B80" }}>Shop name</label>
                  <input
                    value={shopName}
                    onChange={(e) => { setShopName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)); }}
                    placeholder="My Mobile Shop"
                    maxLength={80}
                    className="w-full rounded-xl px-4 py-3 text-sm border-2 outline-none transition-all"
                    style={{ background: "#F7FBFD", borderColor: "#D6E6EF", color: "#2A3E4B" }}
                    onFocus={e => e.currentTarget.style.borderColor = "#ff6b1a"}
                    onBlur={e => e.currentTarget.style.borderColor = "#D6E6EF"}
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
              </>
            )}

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2A3E4B80" }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl px-4 py-3 text-sm border-2 outline-none transition-all"
                style={{ background: "#F7FBFD", borderColor: "#D6E6EF", color: "#2A3E4B" }}
                onFocus={e => e.currentTarget.style.borderColor = "#ff6b1a"}
                onBlur={e => e.currentTarget.style.borderColor = "#D6E6EF"}
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#2A3E4B80" }}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="w-full rounded-xl px-4 py-3 pr-12 text-sm border-2 outline-none transition-all"
                  style={{ background: "#F7FBFD", borderColor: "#D6E6EF", color: "#2A3E4B" }}
                  onFocus={e => e.currentTarget.style.borderColor = "#ff6b1a"}
                  onBlur={e => e.currentTarget.style.borderColor = "#D6E6EF"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                  style={{ color: "#2A3E4B60" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {mode === "signin" && (
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
              )}
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>
            )}
            {info && (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#D6E6EF", color: "#2A3E4B" }}>{info}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-bold py-3.5 rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #ff6b1a, #ff8c42)", color: "white", boxShadow: "0 8px 24px #ff6b1a40" }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Please wait…" : mode === "signup" ? "Submit request" : "Sign in"}
            </button>

            <div className="text-center pt-1">
              <Link
                to="/"
                className="text-xs flex items-center justify-center gap-1.5 hover:opacity-70 transition-opacity"
                style={{ color: "#2A3E4B80" }}
              >
                <ArrowLeft className="w-3 h-3" /> Back to home
              </Link>
            </div>
          </form>

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

// ── Shared wrapper for OTP / submitted steps ──────────────────────────────────
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: "#F7FBFD" }}>
      <div className="flex items-center gap-3 mb-8">
        <img src={DEFAULT_LOGO} alt="" className="w-10 h-10 rounded-xl object-cover ring-1 ring-black/10" />
        <div>
          <div className="text-base font-black tracking-wider" style={{ color: "#2A3E4B", fontFamily: "'Space Grotesk', sans-serif" }}>MYSTERY UNLOCK</div>
          <div className="text-xs tracking-[0.2em] uppercase" style={{ color: "#ff6b1a" }}>Shop Owner Portal</div>
        </div>
      </div>
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-black/5 border p-8"
        style={{ borderColor: "#2A3E4B0f" }}
      >
        {children}
      </div>
    </div>
  );
}

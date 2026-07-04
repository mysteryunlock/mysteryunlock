import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, KeyRound, ArrowLeft, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail } from "@/lib/validation";
import { DEFAULT_LOGO } from "@/lib/spin-store";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Mystery Unlock" },
      { name: "description", content: "Set a new password for your Mystery Unlock shop owner account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let active = true;
    try {
      const stashed = sessionStorage.getItem("reset_email");
      if (stashed) setEmail(stashed);
    } catch {}
    // Only mark verified when an actual auth event arrives (not for pre-existing sessions)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !session) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasRecoverySession(true);
        setVerified(true);
      }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    setError(""); setInfo("");
    if (!isValidEmail(email)) { setError("Enter a valid email address"); return; }
    setSending(true);
    try {
      // resetPasswordForEmail uses the "Reset Password" template (correct).
      // No redirectTo — we rely solely on the 6-digit {{ .Token }} code.
      const { error: err } = await supabase.auth.resetPasswordForEmail(email);
      if (err) throw err;
      try { sessionStorage.setItem("reset_email", email); } catch {}
      setInfo("A 6-digit code was sent to your email. Enter it below.");
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally { setSending(false); }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    const token = code.replace(/\s+/g, "");
    if (!isValidEmail(email)) { setError("Enter your email first"); return; }
    if (!/^\d{6}$/.test(token)) { setError("Enter the 6-digit code from your email"); return; }
    setLoading(true);
    try {
      // type "recovery" matches the resetPasswordForEmail flow
      const { error: verr } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
      if (verr) throw verr;
      setVerified(true);
      setInfo("Code verified! Set your new password below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally { setLoading(false); }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (!/[a-zA-Z]/.test(password)) return setError("Password must contain at least one letter");
    if (!/[0-9]/.test(password)) return setError("Password must contain at least one number");
    if (password !== confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      try { sessionStorage.removeItem("reset_email"); } catch {}
      setInfo("Password updated! Redirecting…");
      setTimeout(() => navigate({ to: "/dashboard" }), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally { setLoading(false); }
  };

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm border-2 outline-none transition-all font-['Poppins']";
  const inputStyle = { background: "#F8FAFC", borderColor: "#e5e7eb", color: "#1F2A37" };
  const fo = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#6F8FA3"; };
  const fb = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "#e5e7eb"; };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 font-['Poppins']" style={{ background: "linear-gradient(135deg, #2E3C48 0%, #3D5066 100%)" }}>
      {/* Logo */}
      <div className="mb-8">
        <img src={DEFAULT_LOGO} alt="Mystery Unlock" className="h-12 w-auto object-contain" />
      </div>

      <div className="w-full max-w-md bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.15)] border border-gray-100 overflow-hidden">
        <div className="p-8">
          <Link
            to="/auth"
            className="inline-flex items-center text-sm font-medium mb-8 hover:opacity-80 transition-opacity"
            style={{ color: "#6F8FA3" }}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to sign in
          </Link>

          {/* Icon header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #2E3C48, #3D5066)" }}
            >
              <KeyRound className="w-7 h-7" style={{ color: "#E8DCC4" }} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#1F2A37" }}>
              {verified ? "Set new password" : "Reset your password"}
            </h1>
            <p className="text-sm mt-1.5 text-gray-500">
              {verified
                ? "Choose a strong password for your account."
                : "Enter your email to receive a 6-digit reset code."}
            </p>
          </div>

          {/* Step 1: Code verification */}
          {!verified && !hasRecoverySession && (
            <form onSubmit={verifyCode} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={inputCls}
                  style={inputStyle}
                  onFocus={fo}
                  onBlur={fb}
                />
              </div>

              <button
                type="button"
                onClick={sendCode}
                disabled={sending || cooldown > 0}
                className="w-full py-3 rounded-xl text-sm font-semibold border-2 transition-all disabled:opacity-50 flex items-center justify-center gap-2 border-gray-200 text-gray-600 bg-gray-50 hover:bg-gray-100"
              >
                {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                {cooldown > 0 ? `Resend code in ${cooldown}s` : sending ? "Sending…" : "Send reset code"}
              </button>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                  Verification code
                </label>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
                  placeholder="000000"
                  className="w-full rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] border-2 outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = "#6F8FA3"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
                />
              </div>

              {error && <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>}
              {info && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#EEF4F8", color: "#2E3C48" }}>{info}</div>}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full font-semibold py-3.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#2E3C48", color: "#E8DCC4" }}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Verifying…" : "Verify code"}
              </button>
            </form>
          )}

          {/* Step 2: New password */}
          {verified && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">New password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Min. 8 characters, include a number"
                    autoComplete="new-password"
                    className={`${inputCls} pr-12`}
                    style={inputStyle}
                    onFocus={fo}
                    onBlur={fb}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity text-gray-400"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Confirm password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className={inputCls}
                  style={inputStyle}
                  onFocus={fo}
                  onBlur={fb}
                />
              </div>

              {error && <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>}
              {info && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#EEF4F8", color: "#2E3C48" }}>{info}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full font-semibold py-3.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#2E3C48", color: "#E8DCC4" }}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          )}

          {!verified && (
            <div className="mt-6 p-4 rounded-lg bg-gray-50 border border-gray-100 flex gap-3 items-start">
              <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500 leading-relaxed">
                Check your spam folder if you don't see the email within 2 minutes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

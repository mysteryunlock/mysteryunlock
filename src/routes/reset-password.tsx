import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, KeyRound, ArrowLeft, Mail, Info } from "lucide-react";
import { Btn } from "@/components/ds";
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

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-[#F7F8FA]">
      <div className="w-full max-w-md bg-white rounded-[24px] shadow-[0_20px_60px_-12px_rgba(12,35,64,0.15)] border border-[#0C2340]/8 overflow-hidden relative">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-[#FF6B1A]/5 rounded-full opacity-50 blur-xl pointer-events-none" />

        <div className="p-8 relative z-10">
          {/* Back link */}
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 text-sm font-medium mb-8 text-[#4a5b78] hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={DEFAULT_LOGO} alt="Mystery Unlock" className="h-12 w-auto object-contain" />
          </div>

          {/* Icon + heading */}
          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 bg-[#FF6B1A]/10 rounded-full flex items-center justify-center mb-4">
              <div className="relative">
                <KeyRound className="w-6 h-6 text-[#FF6B1A]" />
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FF6B1A]/60 rounded-full animate-ping" />
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FF6B1A] rounded-full" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-[#0C2340]">
              {verified ? "Set new password" : "Reset your password"}
            </h1>
            <p className="text-sm text-[#4a5b78]">
              {verified
                ? "Choose a strong password for your account."
                : "Enter your email and we'll send a reset code"}
            </p>
          </div>

          {/* Step 1: Code verification */}
          {!verified && !hasRecoverySession && (
            <form onSubmit={verifyCode} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="reset-email" className="text-sm font-medium text-[#0C2340] block">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a5b78]" />
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="m.scott@dundermifflin.com"
                    className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm border border-[#0C2340]/15 outline-none transition-all focus:ring-2 focus:ring-[#FF6B1A]/25 focus:border-[#FF6B1A]/60"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={sendCode}
                disabled={sending || cooldown > 0}
                className="w-full h-11 rounded-xl text-sm font-semibold border border-[#0C2340]/15 bg-white text-[#0C2340] transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#F5F7FA]"
              >
                {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                {cooldown > 0 ? `Resend code in ${cooldown}s` : sending ? "Sending…" : "Send Reset Code"}
              </button>

              <div className="space-y-2">
                <label htmlFor="reset-code" className="text-sm font-medium text-[#0C2340] block">
                  Verification code
                </label>
                <input
                  id="reset-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
                  placeholder="000000"
                  className="w-full rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] border border-[#0C2340]/15 outline-none transition-all focus:ring-2 focus:ring-[#FF6B1A]/25 focus:border-[#FF6B1A]/60"
                />
              </div>

              {error && <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>}
              {info && <div className="rounded-xl px-4 py-3 text-sm bg-[#FF6B1A]/8 text-[#0C2340] border border-[#FF6B1A]/20">{info}</div>}

              <Btn variant="primary" type="submit" className="w-full h-11 text-sm" disabled={loading || code.length !== 6} loading={loading}>
                {loading ? "Verifying…" : "Verify code"}
              </Btn>
            </form>
          )}

          {/* Step 2: New password */}
          {verified && (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-medium text-[#0C2340] block">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Min. 8 characters, include a number"
                    autoComplete="new-password"
                    className="w-full rounded-xl px-3 py-2.5 pr-10 text-sm border border-[#0C2340]/15 outline-none transition-all focus:ring-2 focus:ring-[#FF6B1A]/25 focus:border-[#FF6B1A]/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5b78] hover:text-[#0C2340] transition-colors"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium text-[#0C2340] block">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className="w-full rounded-xl px-3 py-2.5 text-sm border border-[#0C2340]/15 outline-none transition-all focus:ring-2 focus:ring-[#FF6B1A]/25 focus:border-[#FF6B1A]/60"
                />
              </div>

              {error && <div className="rounded-xl px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>}
              {info && <div className="rounded-xl px-4 py-3 text-sm bg-[#FF6B1A]/8 text-[#0C2340] border border-[#FF6B1A]/20">{info}</div>}

              <Btn variant="primary" type="submit" className="w-full h-11 text-sm" disabled={loading} loading={loading}>
                {loading ? "Updating…" : "Update password"}
              </Btn>
            </form>
          )}

          {/* Spam info box */}
          {!verified && !hasRecoverySession && (
            <div className="mt-6 p-4 rounded-xl bg-[#F7F8FA] border border-[#0C2340]/8 flex gap-3 items-start">
              <Info className="w-5 h-5 text-[#4a5b78] shrink-0 mt-0.5" />
              <p className="text-sm text-[#4a5b78] leading-relaxed">
                Check your spam folder if you don't see the email within 2 minutes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

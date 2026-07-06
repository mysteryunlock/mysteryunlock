import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MailCheck, RefreshCw, ArrowLeft, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail } from "@/lib/validation";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { customerSignInFn, customerVerifyOtpFn } from "@/lib/customer-auth.functions";
import { parseServerValidationError } from "@/lib/utils";

export const Route = createFileRoute("/customer-auth")({
  head: () => ({
    meta: [
      { title: "Customer Sign In — Mystery Unlock" },
      { name: "description", content: "Sign in to view your prizes and spin history." },
    ],
  }),
  component: CustomerAuthPage,
});

type Step = "email" | "otp";

const RESEND_COOLDOWN = 30;

function CustomerAuthPage() {
  const navigate = useNavigate();
  const doSignIn = useServerFn(customerSignInFn);
  const doVerifyOtp = useServerFn(customerVerifyOtpFn);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    const interval = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const onSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");

    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setSendingOtp(true);
    try {
      await doSignIn({ data: { email: trimmed } });
      setEmail(trimmed);
      setStep("otp");
      startCooldown();
    } catch (err) {
      setError(parseServerValidationError(err) ?? "Could not send code. Please try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  const onResend = async () => {
    if (cooldown > 0) return;
    setError(""); setInfo("");
    setSendingOtp(true);
    try {
      await doSignIn({ data: { email } });
      setInfo("A new code was sent to your email.");
      startCooldown();
    } catch (err) {
      setError(parseServerValidationError(err) ?? "Could not resend code.");
    } finally {
      setSendingOtp(false);
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setError(""); setInfo(""); setLoading(true);
    try {
      const result = await doVerifyOtp({ data: { email, token: otpCode } });

      await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });

      navigate({ to: "/portal" });
    } catch (err) {
      setError(parseServerValidationError(err) ?? "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      {step === "email" ? (
        <>
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #2E3C48, #3D5066)" }}
            >
              <User className="w-7 h-7" style={{ color: "#E8DCC4" }} />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: "#1F2A37" }}>
              Customer sign in
            </h1>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              Enter your email to view your prizes and spin history. No password needed.
            </p>
          </div>

          <form onSubmit={onSendOtp} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">Email address</label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@example.com"
                className="w-full rounded-lg px-4 py-3 text-sm border border-gray-200 outline-none transition-all focus:border-[#6F8FA3] focus:ring-2 focus:ring-[#6F8FA3]/20"
                style={{ color: "#1F2A37" }}
                autoFocus
              />
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>
            )}

            <button
              type="submit"
              disabled={sendingOtp}
              className="w-full font-semibold h-11 rounded-lg text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: "#2E3C48", color: "#E8DCC4" }}
            >
              {sendingOtp && <Loader2 className="w-4 h-4 animate-spin" />}
              {sendingOtp ? "Sending…" : "Send code"}
            </button>

            <p className="text-xs text-gray-400 text-center">
              No account needed — we'll create one for you.
            </p>
          </form>
        </>
      ) : (
        <>
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #2E3C48, #3D5066)" }}
            >
              <MailCheck className="w-7 h-7" style={{ color: "#E8DCC4" }} />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: "#1F2A37" }}>
              Check your email
            </h1>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              We sent a 6-digit code to <strong className="text-gray-700">{email}</strong>.
            </p>
          </div>

          <form onSubmit={onVerify} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">Verification code</label>
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
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => { setStep("email"); setOtpCode(""); setError(""); setInfo(""); }}
                className="text-sm font-medium flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                style={{ color: "#2E3C48" }}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || sendingOtp}
                onClick={onResend}
                className="text-sm font-medium flex items-center gap-1.5 hover:opacity-70 transition-opacity disabled:opacity-40"
                style={{ color: "#6F8FA3" }}
              >
                {sendingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        </>
      )}

      <div className="mt-6 text-center">
        <Link to="/welcome" className="text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: "#6F8FA3" }}>
          ← Back
        </Link>
      </div>
    </Shell>
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

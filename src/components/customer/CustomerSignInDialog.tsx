import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, MailCheck, RefreshCw, X } from "lucide-react";
import { customerSignInFn, customerVerifyOtpFn } from "@/lib/customer-auth.functions";
import { createPrizeClaimFn } from "@/lib/prize-claims.functions";
import { supabase } from "@/integrations/supabase/client";
import { parseServerValidationError } from "@/lib/utils";

type Step = "email" | "otp";

type Props = {
  shopSlug:  string;
  open:      boolean;
  onOpenChange: (v: boolean) => void;
  /** If provided, a prize claim is created automatically after sign-in. */
  spinCode?: string;
  prizeWon?: string;
  onSuccess?: (customerId: string, claimSaved: boolean) => void;
};

export function CustomerSignInDialog({ shopSlug, open, onOpenChange, spinCode, prizeWon, onSuccess }: Props) {
  const doSignIn     = useServerFn(customerSignInFn);
  const doVerifyOtp  = useServerFn(customerVerifyOtpFn);
  const doCreateClaim = useServerFn(createPrizeClaimFn);

  const [step, setStep]           = useState<Step>("email");
  const [email, setEmail]         = useState("");
  const [otp, setOtp]             = useState("");
  const [error, setError]         = useState("");
  const [info, setInfo]           = useState("");
  const [loading, setLoading]     = useState(false);
  const [cooldown, setCooldown]   = useState(0);
  const cooldownRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setCooldown(60);
    const id = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(id); return 0; }
        return c - 1;
      });
    }, 1000);
    cooldownRef.current = id;
  };

  const reset = () => {
    setStep("email");
    setEmail("");
    setOtp("");
    setError("");
    setInfo("");
    setLoading(false);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCooldown(0);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) { setError("Enter a valid email address."); return; }
    setError(""); setInfo(""); setLoading(true);
    try {
      await doSignIn({ data: { email: trimmed, shopSlug } });
      setStep("otp");
      startCooldown();
    } catch (err) {
      setError(parseServerValidationError(err) ?? (err instanceof Error ? err.message : "Could not send code. Please try again."));
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setError(""); setInfo(""); setLoading(true);
    try {
      await doSignIn({ data: { email: email.trim().toLowerCase(), shopSlug } });
      setInfo("A new code was sent to your email.");
      startCooldown();
    } catch (err) {
      setError(parseServerValidationError(err) ?? "Could not resend code.");
    } finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otp.replace(/\D/g, "");
    if (token.length !== 6) { setError("Enter the 6-digit code from your email."); return; }
    setError(""); setInfo(""); setLoading(true);
    try {
      const result = await doVerifyOtp({
        data: { email: email.trim().toLowerCase(), token, shopSlug },
      });

      // Persist the session in the browser Supabase client.
      await supabase.auth.setSession({
        access_token:  result.access_token,
        refresh_token: result.refresh_token,
      });

      // If a spin code was provided, create the prize claim now that we're
      // authenticated. The attachSupabaseAuth middleware will pick up the
      // new session token automatically on the next useServerFn call.
      let claimSaved = false;
      if (spinCode && prizeWon) {
        try {
          await doCreateClaim({ data: { code: spinCode, shopSlug } });
          claimSaved = true;
        } catch (claimErr) {
          // Non-fatal: user is signed in but the claim could not be created.
          console.warn("[CustomerSignInDialog] prize claim creation failed:", claimErr);
        }
      }

      reset();
      onOpenChange(false);
      onSuccess?.(result.customer_id, claimSaved);
    } catch (err) {
      setError(parseServerValidationError(err) ?? (err instanceof Error ? err.message : "Invalid or expired code. Please try again."));
    } finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="w-full sm:max-w-sm bg-[#0F1115] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to save your prize"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl gradient-primary flex items-center justify-center">
              <MailCheck className="w-5 h-5 text-[#0F1115]" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">
                {step === "email" ? "Save your prize" : "Check your email"}
              </p>
              <p className="text-xs text-muted-foreground">
                {step === "email"
                  ? "Sign in to unlock your win history"
                  : `Code sent to ${email}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Prize context */}
        {prizeWon && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-[#1a1f2e] border border-white/8 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">You won</p>
            <p className="text-gold font-black text-lg">{prizeWon}</p>
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
                Email address
              </label>
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
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[#FF7A00] transition"
                autoFocus
              />
            </div>

            {error && <p className="text-destructive text-xs text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary text-[#0F1115] font-bold py-3.5 rounded-xl glow-orange transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Sending…" : "Send code"}
            </button>

            <p className="text-[11px] text-muted-foreground text-center">
              No account needed — we'll create one for you.
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
                6-digit code
              </label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                placeholder="000000"
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-center text-3xl font-mono tracking-[0.5em] text-foreground outline-none focus:border-[#FF7A00] transition"
                autoFocus
              />
            </div>

            {info  && <p className="text-blue-400 text-xs text-center">{info}</p>}
            {error && <p className="text-destructive text-xs text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full gradient-primary text-[#0F1115] font-bold py-3.5 rounded-xl glow-orange transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Verifying…" : "Verify & save prize"}
            </button>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => { setStep("email"); setOtp(""); setError(""); setInfo(""); }}
                className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || loading}
                onClick={handleResend}
                className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition disabled:opacity-40"
              >
                <RefreshCw className="w-3 h-3" />
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

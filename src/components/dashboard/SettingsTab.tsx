import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Settings as SettingsIcon, Building2, Upload, ShieldCheck, Mail, KeyRound, Eye, EyeOff,
  Shield, QrCode, ExternalLink, Bell, Phone,
  CreditCard, Sparkles, MessageSquare, Plug, Moon, Sun, Globe, LifeBuoy, LogOut, Trash2,
  ArrowLeft, ChevronRight, Megaphone,
} from "lucide-react";
import { Btn } from "@/components/ds";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { parseServerValidationError } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { updateMyShop } from "@/lib/shops.functions";
import { changeEmailFn, changePasswordFn, sendPasswordOtpFn, verifyOtpAndSetPasswordFn } from "@/lib/auth.functions";
import { InstallAppButton } from "@/components/InstallAppButton";
import { autoSlug, slugRe } from "./utils";
import { SettingsSection, SettingsRow, Toggle } from "./SettingsControls";
import type { Shop } from "./types";

export function SettingsTab({
  shop, onSaved, doUpdate, superAdmin, onSignOut, onNavigateToCampaigns,
}: {
  shop: Shop;
  onSaved: () => void;
  doUpdate: ReturnType<typeof useServerFn<typeof updateMyShop>>;
  superAdmin: boolean;
  onSignOut: () => void | Promise<void>;
  onNavigateToCampaigns?: () => void;
}) {
  const [name, setName] = useState(shop.name);
  const [slug, setSlug] = useState(shop.slug);
  const [logoUrl, setLogoUrl] = useState<string | null>(shop.logo_url);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");

  // Preferences (persisted locally)
  const [darkMode, setDarkMode] = useState<boolean>(() => typeof window !== "undefined" && localStorage.getItem("pref:darkMode") === "1");
  const [emailNotif, setEmailNotif] = useState<boolean>(() => typeof window !== "undefined" && localStorage.getItem("pref:emailNotif") !== "0");
  const [smsNotif, setSmsNotif] = useState<boolean>(() => typeof window !== "undefined" && localStorage.getItem("pref:smsNotif") === "1");
  const [language, setLanguage] = useState<string>(() => (typeof window !== "undefined" && localStorage.getItem("pref:lang")) || "en");

  // Change-password / forgot-password form
  const [showPwForm, setShowPwForm] = useState(() =>
    typeof window !== "undefined" && sessionStorage.getItem("mu_pw_reset") === "forgot-verify"
  );
  const [pwMode, setPwMode] = useState<"change" | "forgot-send" | "forgot-verify">(() =>
    typeof window !== "undefined" && sessionStorage.getItem("mu_pw_reset") === "forgot-verify"
      ? "forgot-verify"
      : "change"
  );
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [otp, setOtp] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwOk, setPwOk] = useState(false);
  const doChangePw = useServerFn(changePasswordFn);
  const doSendOtp = useServerFn(sendPasswordOtpFn);
  const doVerifyOtp = useServerFn(verifyOtpAndSetPasswordFn);

  // Change-email form
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");
  const [emailOk, setEmailOk] = useState(false);
  const doChangeEmail = useServerFn(changeEmailFn);

  const changeEmail = async () => {
    setEmailMsg(""); setEmailOk(false);
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailMsg("Please enter a valid email address."); return;
    }
    if (newEmail.toLowerCase() === email.toLowerCase()) {
      setEmailMsg("That's already your current email."); return;
    }
    setEmailBusy(true);
    try {
      await doChangeEmail({ data: { newEmail } });
      setEmailOk(true);
      setEmailMsg(`Confirmation sent to ${newEmail}. Check that inbox and click the link to confirm the change.`);
      setTimeout(() => { setShowEmailForm(false); setNewEmail(""); setEmailMsg(""); setEmailOk(false); }, 6000);
    } catch (e) {
      setEmailMsg(e instanceof Error ? e.message : "Failed to send confirmation.");
    } finally { setEmailBusy(false); }
  };

  const resetPwForm = () => {
    setOldPw(""); setNewPw(""); setOtp("");
    setShowOld(false); setShowNew(false);
    setPwMsg(""); setPwOk(false); setPwBusy(false);
    setPwMode("change");
    if (typeof window !== "undefined") sessionStorage.removeItem("mu_pw_reset");
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("pref:darkMode", darkMode ? "1" : "0"); }, [darkMode]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("pref:emailNotif", emailNotif ? "1" : "0"); }, [emailNotif]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("pref:smsNotif", smsNotif ? "1" : "0"); }, [smsNotif]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("pref:lang", language); }, [language]);

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setErr("Logo must be under 10 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.readAsDataURL(f);
  };

  const save = async () => {
    setErr(""); setMsg(""); setBusy(true);
    try {
      const patch: { id: string; name?: string; slug?: string; logo_url?: string | null } = { id: shop.id };
      if (name !== shop.name) patch.name = name.trim();
      if (slug !== shop.slug) {
        if (!slugRe.test(slug)) throw new Error("Slug can only contain lowercase letters, numbers and dashes");
        patch.slug = slug;
      }
      if (logoUrl !== shop.logo_url) patch.logo_url = logoUrl;
      await doUpdate({ data: patch });
      setMsg("Saved.");
      onSaved();
    } catch (e2) {
      setErr(parseServerValidationError(e2) ?? (e2 instanceof Error ? e2.message : "Save failed"));
    } finally { setBusy(false); }
  };

  const validateNewPw = (pw: string) => {
    if (pw.length < 8) return "New password must be at least 8 characters.";
    if (!/[a-zA-Z]/.test(pw)) return "Must contain at least one letter.";
    if (!/[0-9]/.test(pw)) return "Must contain at least one number.";
    return null;
  };

  const changePassword = async () => {
    setPwMsg(""); setPwOk(false);
    if (!oldPw) { setPwMsg("Please enter your current password."); return; }
    const pwErr = validateNewPw(newPw);
    if (pwErr) { setPwMsg(pwErr); return; }
    if (oldPw === newPw) { setPwMsg("New password must be different from the current one."); return; }
    setPwBusy(true);
    try {
      await doChangePw({ data: { currentPassword: oldPw, newPassword: newPw } });
      setPwOk(true);
      setPwMsg("Password updated successfully!");
      setTimeout(() => { setShowPwForm(false); resetPwForm(); }, 2000);
    } catch (e) {
      setPwMsg(e instanceof Error ? e.message : "Failed to update password.");
    } finally { setPwBusy(false); }
  };

  const sendOtp = async () => {
    setPwMsg(""); setPwOk(false); setPwBusy(true);
    try {
      await doSendOtp({ data: { email } });
      if (typeof window !== "undefined") sessionStorage.setItem("mu_pw_reset", "forgot-verify");
      setPwMode("forgot-verify");
      setPwMsg("Code sent! Check your email.");
      setPwOk(true);
    } catch (e) {
      setPwMsg(e instanceof Error ? e.message : "Failed to send code.");
    } finally { setPwBusy(false); }
  };

  const verifyOtpAndSet = async () => {
    setPwMsg(""); setPwOk(false);
    if (!otp.trim()) { setPwMsg("Please enter the code from your email."); return; }
    const pwErr = validateNewPw(newPw);
    if (pwErr) { setPwMsg(pwErr); return; }
    setPwBusy(true);
    try {
      await doVerifyOtp({ data: { email, otp: otp.trim(), newPassword: newPw } });
      if (typeof window !== "undefined") sessionStorage.removeItem("mu_pw_reset");
      setPwOk(true);
      setPwMsg("Password set successfully!");
      setTimeout(() => { setShowPwForm(false); resetPwForm(); }, 2000);
    } catch (e) {
      setPwMsg(e instanceof Error ? e.message : "Invalid or expired code.");
    } finally { setPwBusy(false); }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const requestDelete = () => {
    if (!showDeleteConfirm) { setShowDeleteConfirm(true); return; }
    setShowDeleteConfirm(false);
    const subject = encodeURIComponent(`Account deletion request — ${shop.name}`);
    const body = encodeURIComponent(`Please delete the account for ${email} (shop: ${shop.name}, id: ${shop.id}).`);
    window.location.href = `mailto:support@mysteryunlock.com?subject=${subject}&body=${body}`;
  };

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/s/${shop.slug}` : `/s/${shop.slug}`;
  const inputCls = "w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-xl px-4 py-3 outline-none focus:border-[#FF6B1A] focus:ring-2 focus:ring-[#FF6B1A]/15 transition";

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="pt-1 pb-2">
        <h1 className="text-xl font-display font-black text-[#0c2340]">Settings</h1>
        <p className="text-xs text-[#6b7a93] mt-0.5">Manage your shop, account and preferences</p>
      </div>

      {/* Business Profile */}
      <SettingsSection icon={Building2} title="Business Profile" subtitle="How your shop appears to customers">
        <div className="flex items-center gap-4">
          <img src={logoUrl || DEFAULT_LOGO} alt="" className="w-16 h-16 rounded-2xl object-cover border border-[#0c2340]/10 shadow-sm" />
          <div className="flex flex-col gap-1.5">
            <label className="cursor-pointer text-xs font-semibold px-3 py-2 rounded-lg bg-[#FF6B1A] text-white inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity min-h-[36px]">
              <Upload className="w-3.5 h-3.5" /> Upload logo
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
            {logoUrl && <button onClick={() => setLogoUrl(null)} className="text-[11px] text-[#6b7a93] text-left hover:text-[#0c2340] transition-colors">Remove logo</button>}
            <p className="text-[11px] text-[#6b7a93]">PNG/JPG, up to 10 MB.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-[#6b7a93] font-semibold">Shop name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputCls} />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-[#6b7a93] font-semibold">Public URL</label>
          <div className="flex items-center bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-4 py-3 focus-within:border-[#FF6B1A] focus-within:ring-2 focus-within:ring-[#FF6B1A]/15 transition">
            <span className="text-[#6b7a93] text-sm mr-1">/s/</span>
            <input value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} maxLength={40} className="flex-1 bg-transparent text-[#0c2340] outline-none" />
          </div>
          <p className="text-[11px] text-[#6b7a93] break-all">{publicUrl}</p>
        </div>

        {err && <p className="text-[#b3261e] text-sm">{err}</p>}
        {msg && <p className="text-sm text-emerald-600 font-semibold">{msg}</p>}
        <Btn variant="primary" className="w-full py-3 active:scale-[0.98]" onClick={save} disabled={busy} loading={busy}>
          {busy ? "Saving..." : "Save changes"}
        </Btn>
      </SettingsSection>

      {/* Account & Security */}
      <SettingsSection icon={ShieldCheck} title="Account & Security" subtitle="Email, password, and access" accent="#2563eb">
        <SettingsRow icon={Mail} label="Email" hint={email || "—"} onClick={() => { setShowEmailForm((v) => !v); setNewEmail(""); setEmailMsg(""); setEmailOk(false); }} />
        {showEmailForm && (
          <div className="space-y-3 pl-1 pt-1">
            <p className="text-sm text-[#4a5b78]">
              A confirmation will be sent to your new address — you must click the link there to complete the change.
            </p>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="New email address"
              autoComplete="email"
              className={inputCls}
              onKeyDown={(e) => e.key === "Enter" && changeEmail()}
            />
            {emailMsg && (
              <p className={`text-xs font-medium ${emailOk ? "text-emerald-600" : "text-[#b3261e]"}`}>{emailMsg}</p>
            )}
            <div className="flex gap-2">
              <Btn variant="primary" className="flex-1 py-2.5 text-sm active:scale-[0.98]" onClick={changeEmail} disabled={emailBusy || !newEmail.trim()} loading={emailBusy}>
                {emailBusy ? "Sending…" : "Send confirmation"}
              </Btn>
              <button onClick={() => { setShowEmailForm(false); setNewEmail(""); setEmailMsg(""); }}
                className="px-4 py-2.5 rounded-xl bg-[#F5F7FA] text-sm text-[#0c2340] font-medium hover:bg-[#ECEFF5] transition-colors min-h-[44px]">
                Cancel
              </button>
            </div>
          </div>
        )}
        <SettingsRow icon={KeyRound} label="Change password" hint="Update your sign-in password" onClick={() => { setShowPwForm((v) => !v); resetPwForm(); }} />
        {showPwForm && (
          <div className="space-y-3 pl-1 pt-1">

            {/* ── Mode: change with current password ── */}
            {pwMode === "change" && (
              <>
                <div className="relative">
                  <input
                    type={showOld ? "text" : "password"}
                    value={oldPw}
                    onChange={(e) => setOldPw(e.target.value)}
                    placeholder="Current password"
                    className={inputCls + " pr-11"}
                    onKeyDown={(e) => e.key === "Enter" && changePassword()}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowOld((v) => !v)}
                    aria-label={showOld ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7a93] hover:text-[#0c2340] transition-colors">
                    {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="New password (min 8 chars + number)"
                    className={inputCls + " pr-11"}
                    onKeyDown={(e) => e.key === "Enter" && changePassword()}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowNew((v) => !v)}
                    aria-label={showNew ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7a93] hover:text-[#0c2340] transition-colors">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {pwMsg && (
                  <p className={`text-xs font-medium ${pwOk ? "text-emerald-600" : "text-[#b3261e]"}`}>{pwMsg}</p>
                )}

                <div className="flex gap-2">
                  <Btn variant="primary" className="flex-1 py-2.5 text-sm active:scale-[0.98]" onClick={changePassword} disabled={pwBusy} loading={pwBusy}>
                    {pwBusy ? "Updating…" : "Update password"}
                  </Btn>
                  <button onClick={() => { setShowPwForm(false); resetPwForm(); }}
                    className="px-4 py-2.5 rounded-xl bg-[#F5F7FA] text-sm text-[#0c2340] font-medium hover:bg-[#ECEFF5] transition-colors min-h-[44px]">
                    Cancel
                  </button>
                </div>

                <button onClick={() => { resetPwForm(); setPwMode("forgot-send"); }}
                  className="text-xs text-[#FF6B1A] hover:underline font-medium">
                  Forgot password? Verify via email instead
                </button>
              </>
            )}

            {/* ── Mode: send OTP ── */}
            {pwMode === "forgot-send" && (
              <>
                <p className="text-sm text-[#4a5b78]">
                  We'll send a reset code to <span className="font-semibold text-[#0c2340]">{email}</span>.
                </p>

                {pwMsg && (
                  <p className={`text-xs font-medium ${pwOk ? "text-emerald-600" : "text-[#b3261e]"}`}>{pwMsg}</p>
                )}

                <div className="flex gap-2">
                  <Btn variant="primary" className="flex-1 py-2.5 text-sm active:scale-[0.98]" onClick={sendOtp} disabled={pwBusy} loading={pwBusy}>
                    {pwBusy ? "Sending…" : "Send verification code"}
                  </Btn>
                  <button onClick={() => { resetPwForm(); }}
                    className="px-4 py-2.5 rounded-xl bg-[#F5F7FA] text-sm text-[#0c2340] font-medium hover:bg-[#ECEFF5] transition-colors min-h-[44px]">
                    Back
                  </button>
                </div>
              </>
            )}

            {/* ── Mode: verify OTP + set new password ── */}
            {pwMode === "forgot-verify" && (
              <>
                <p className="text-sm text-[#4a5b78]">
                  Enter the code sent to <span className="font-semibold text-[#0c2340]">{email}</span> and your new password.
                </p>

                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Reset code from email"
                  maxLength={6}
                  className={inputCls + " tracking-[0.3em] text-center font-mono text-lg"}
                />

                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="New password (min 8 chars + number)"
                    className={inputCls + " pr-11"}
                    onKeyDown={(e) => e.key === "Enter" && verifyOtpAndSet()}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowNew((v) => !v)}
                    aria-label={showNew ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7a93] hover:text-[#0c2340] transition-colors">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {pwMsg && (
                  <p className={`text-xs font-medium ${pwOk ? "text-emerald-600" : "text-[#b3261e]"}`}>{pwMsg}</p>
                )}

                <div className="flex gap-2">
                  <Btn variant="primary" className="flex-1 py-2.5 text-sm active:scale-[0.98]" onClick={verifyOtpAndSet} disabled={pwBusy} loading={pwBusy}>
                    {pwBusy ? "Verifying…" : "Set new password"}
                  </Btn>
                  <button onClick={() => { resetPwForm(); setPwMode("forgot-send"); }}
                    className="px-4 py-2.5 rounded-xl bg-[#F5F7FA] text-sm text-[#0c2340] font-medium hover:bg-[#ECEFF5] transition-colors min-h-[44px]">
                    Resend
                  </button>
                </div>

                <button onClick={() => resetPwForm()}
                  className="inline-flex items-center gap-1 text-xs text-[#6b7a93] hover:underline">
                  <ArrowLeft className="w-3 h-3" /> Back to change password
                </button>
              </>
            )}
          </div>
        )}
        {superAdmin && (
          <SettingsRow icon={Shield} label="Super admin panel" hint="Manage platform & subscriptions" onClick={() => { window.location.href = "/super-admin"; }} />
        )}
      </SettingsSection>

      {/* Campaign Defaults */}
      <SettingsSection icon={Megaphone} title="Campaign Defaults" subtitle="Prizes, wheel, codes & rules" accent="#9333ea">
        <div className="rounded-xl bg-[#F5F7FA] border border-[#0c2340]/8 p-4 space-y-3">
          <p className="text-sm text-[#4a5b78] leading-relaxed">
            Manage your prizes, spin wheel design, access codes, and campaign rules from the Campaign Hub.
          </p>
          <div className="flex flex-wrap gap-2">
            {onNavigateToCampaigns && (
              <button
                onClick={onNavigateToCampaigns}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-bold hover:opacity-90 transition-opacity active:scale-[0.98] min-h-[44px]"
              >
                <Megaphone className="w-4 h-4" strokeWidth={1.75} />
                Open Campaign Hub
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            )}
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-[#0c2340]/10 text-sm font-semibold text-[#0c2340] hover:border-[#FF6B1A]/40 transition-colors min-h-[44px]"
            >
              <ExternalLink className="w-4 h-4" strokeWidth={1.75} />
              View public page
            </a>
          </div>
          <p className="text-[11px] text-[#9aa5b5] flex items-center gap-1">
            <QrCode className="w-3 h-3" /> {publicUrl}
          </p>
        </div>
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection icon={Bell} title="Notifications" subtitle="Choose how we reach you" accent="#0891b2">
        <SettingsRow icon={Mail} label="Email notifications" hint="Activity & weekly summary" right={<Toggle checked={emailNotif} onChange={setEmailNotif} />} />
        <SettingsRow icon={Phone} label="SMS alerts" hint="Important account events" right={<Toggle checked={smsNotif} onChange={setSmsNotif} />} />
      </SettingsSection>

      {/* Subscription & Billing */}
      <SettingsSection icon={CreditCard} title="Subscription & Billing" subtitle="Plan, renewal and invoices" accent="#16a34a">
        <SettingsRow
          icon={Sparkles}
          label="Current plan"
          hint={shop.is_active ? "Your campaign is live" : "Your campaign is paused"}
          right={
            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${shop.is_active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {shop.is_active ? "ACTIVE" : "PAUSED"}
            </span>
          }
        />
        <SettingsRow icon={CreditCard} label="Billing & plans" hint="View plans, renewal & invoices" onClick={() => { window.location.href = "/billing"; }} />
        <SettingsRow icon={MessageSquare} label="Renew or upgrade" hint="Chat with us on WhatsApp" onClick={() => window.open("https://wa.me/9779769402069?text=I%20want%20to%20renew%20my%20Mystery%20Unlock%20subscription", "_blank")} />
      </SettingsSection>

      {/* Integrations */}
      <SettingsSection icon={Plug} title="Integrations" subtitle="Connect external tools" accent="#db2777">
        <SettingsRow icon={MessageSquare} label="WhatsApp messaging" hint="Send winner messages" right={<span className="text-[11px] font-bold text-emerald-600">CONNECTED</span>} />
        <SettingsRow icon={Mail} label="Email sender" hint="Bulk customer emails" right={<span className="text-[11px] font-bold text-emerald-600">CONNECTED</span>} />
        <InstallAppButton variant="outline" size="sm" />
      </SettingsSection>

      {/* Preferences */}
      <SettingsSection icon={SettingsIcon} title="Preferences" subtitle="Personalize your experience" accent="#475569">
        <SettingsRow
          icon={darkMode ? Moon : Sun}
          label="Dark mode"
          hint="Switch to a darker theme"
          right={<Toggle checked={darkMode} onChange={setDarkMode} />}
        />
        <SettingsRow icon={Globe} label="Language" right={
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-[#F5F7FA] border border-[#0c2340]/10 rounded-lg px-2 py-1.5 text-sm text-[#0c2340] outline-none focus:border-[#FF6B1A]">
            <option value="en">English</option>
            <option value="ne">नेपाली</option>
            <option value="hi">हिन्दी</option>
          </select>
        } />
      </SettingsSection>

      {/* Support */}
      <SettingsSection icon={LifeBuoy} title="Support" subtitle="We're here to help" accent="#0ea5e9">
        <SettingsRow icon={MessageSquare} label="WhatsApp support" hint="+977 9769402069" onClick={() => window.open("https://wa.me/9779769402069", "_blank")} />
        <SettingsRow icon={Mail} label="Email support" hint="support@mysteryunlock.com" onClick={() => { window.location.href = "mailto:support@mysteryunlock.com"; }} />
      </SettingsSection>

      {/* Account Actions — clearly separated danger zone */}
      <div className="rounded-2xl border border-red-200/60 bg-red-50/50 overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100 text-red-600">
            <LogOut className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-[15px] font-bold text-red-800 leading-tight">Account Actions</h3>
            <p className="text-xs text-red-600/70 mt-0.5">Irreversible account operations</p>
          </div>
        </div>
        <div className="px-5 pb-5 space-y-2">
          <button
            onClick={() => onSignOut()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[#0c2340] hover:bg-white/60 transition-colors min-h-[44px]"
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/80">
              <LogOut className="w-4 h-4 text-[#4a5b78]" />
            </span>
            <div>
              <p className="text-sm font-semibold">Sign out</p>
              <p className="text-[11px] text-[#6b7a93]">End this session</p>
            </div>
          </button>

          <button
            onClick={requestDelete}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-red-700 hover:bg-red-100/60 transition-colors min-h-[44px]"
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100">
              <Trash2 className="w-4 h-4 text-red-600" />
            </span>
            <div>
              <p className="text-sm font-semibold">Delete account</p>
              <p className="text-[11px] text-red-500/80">Permanently remove your data</p>
            </div>
          </button>

          {showDeleteConfirm && (
            <div className="rounded-xl border border-red-200 bg-white p-4 space-y-3">
              <p className="text-sm font-semibold text-red-800">
                Are you sure? This will sign you out and email our team to permanently remove your data within 30 days.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 text-sm font-bold px-3 py-2.5 rounded-xl border border-red-200 bg-white text-red-800 hover:bg-red-50 transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={requestDelete}
                  className="flex-1 text-sm font-bold px-3 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors min-h-[44px]"
                >
                  Yes, delete account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-[11px] text-[#6b7a93] pt-1 pb-3">Mystery Unlock · v1.0</p>
    </div>
  );
}

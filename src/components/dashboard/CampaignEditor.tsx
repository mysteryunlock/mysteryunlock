import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Save, AlertTriangle, ChevronDown, Palette, RotateCcw, CreditCard } from "lucide-react";
import { createCampaign, updateCampaign } from "@/lib/campaigns.functions";
import { Btn } from "@/components/ds";
import { campaignNameSchema, slugSchema } from "@/lib/validation";
import { parseServerValidationError } from "@/lib/utils";

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type CampaignTheme = {
  accent?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  timezone?: string;
  max_spins?: number;
  max_winners?: number;
  daily_limit?: number;
  is_draft?: boolean;
  is_archived?: boolean;
  /** Prize-reveal mechanic: "spin" (default) | "scratch" */
  game_type?: "spin" | "scratch";
  /** Wheel designer fields */
  wheel_palette?:        string[];
  wheel_text_color?:     string;
  wheel_center_color?:   string;
  wheel_pointer_style?:  "classic" | "arrow" | "diamond" | "star";
  wheel_show_confetti?:  boolean;
  wheel_show_particles?: boolean;
  wheel_show_glow?:      boolean;
  wheel_preset?:         string;
  wheel_sound_enabled?:  boolean;
  wheel_text_bold?:      boolean;
  wheel_text_uppercase?: boolean;
  wheel_text_spacing?:   "normal" | "wide" | "wider";
  wheel_rim_color?:      string;
  wheel_rim_thickness?:  "thin" | "normal" | "thick";
  wheel_bg_style?:       "gradient" | "solid";
};

export type Campaign = {
  id: string;
  name: string;
  slug: string;
  theme: CampaignTheme | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
};

export type CampaignStatus = "active" | "paused" | "draft" | "archived";

export function campaignStatus(c: Campaign): CampaignStatus {
  if (c.theme?.is_archived) return "archived";
  if (c.theme?.is_draft) return "draft";
  if (c.is_active) return "active";
  return "paused";
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PRESET_ACCENTS = [
  "#1f3460", "#FF6B1A", "#16a34a", "#a21caf",
  "#dc2626", "#0891b2", "#ca8a04", "#0f172a",
];

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "Asia/Kathmandu", label: "Asia/Kathmandu (NPT +5:45)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +5:30)" },
  { value: "Asia/Dhaka", label: "Asia/Dhaka (BST +6:00)" },
  { value: "Asia/Colombo", label: "Asia/Colombo (SLST +5:30)" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok (ICT +7:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT +8:00)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST +8:00)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST +9:00)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST +10:00)" },
  { value: "Europe/London", label: "Europe/London (GMT +0:00)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET +1:00)" },
  { value: "America/New_York", label: "America/New_York (EST -5:00)" },
  { value: "America/Chicago", label: "America/Chicago (CST -6:00)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST -8:00)" },
];

// ─── Editor Component ─────────────────────────────────────────────────────────

interface CampaignEditorProps {
  /** null = creating a new campaign */
  campaign: Campaign | null;
  shopId: string;
  onSave: (updated: Campaign) => void;
  onClose: () => void;
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function numOrEmpty(v: number | undefined): string {
  return v !== undefined && v > 0 ? String(v) : "";
}

export function CampaignEditor({ campaign, shopId, onSave, onClose }: CampaignEditorProps) {
  const doCreate = useServerFn(createCampaign);
  const doUpdate = useServerFn(updateCampaign);

  const isNew = campaign === null;
  const initTheme = campaign?.theme ?? {};
  const initStatus: CampaignStatus = campaign ? campaignStatus(campaign) : "draft";

  // Form state
  const [name, setName] = useState(campaign?.name ?? "");
  const [slug, setSlug] = useState(campaign?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [description, setDescription] = useState(initTheme.description ?? "");
  const [accent, setAccent] = useState(initTheme.accent ?? "#FF6B1A");
  const [status, setStatus] = useState<CampaignStatus>(initStatus);
  const [startDate, setStartDate] = useState(initTheme.start_date ?? "");
  const [endDate, setEndDate] = useState(initTheme.end_date ?? "");
  const [timezone, setTimezone] = useState(initTheme.timezone ?? "Asia/Kathmandu");
  const [maxSpins, setMaxSpins] = useState(numOrEmpty(initTheme.max_spins));
  const [maxWinners, setMaxWinners] = useState(numOrEmpty(initTheme.max_winners));
  const [dailyLimit, setDailyLimit] = useState(numOrEmpty(initTheme.daily_limit));
  const [gameType, setGameType] = useState<"spin" | "scratch">(initTheme.game_type ?? "spin");

  // UI state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showUnsaved, setShowUnsaved] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  // Dirty detection
  const isDirty =
    name !== (campaign?.name ?? "") ||
    slug !== (campaign?.slug ?? "") ||
    description !== (initTheme.description ?? "") ||
    accent !== (initTheme.accent ?? "#FF6B1A") ||
    status !== initStatus ||
    startDate !== (initTheme.start_date ?? "") ||
    endDate !== (initTheme.end_date ?? "") ||
    timezone !== (initTheme.timezone ?? "Asia/Kathmandu") ||
    maxSpins !== numOrEmpty(initTheme.max_spins) ||
    maxWinners !== numOrEmpty(initTheme.max_winners) ||
    dailyLimit !== numOrEmpty(initTheme.daily_limit) ||
    gameType !== (initTheme.game_type ?? "spin");

  // Auto-slug from name if user hasn't manually typed a slug
  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  // Click outside to close color picker
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const tryClose = () => {
    if (isDirty) { setShowUnsaved(true); return; }
    onClose();
  };

  const handleSave = async () => {
    setError("");
    // Validate
    const nameResult = campaignNameSchema.safeParse(name);
    if (!nameResult.success) { setError(nameResult.error.issues[0]?.message ?? "Invalid name"); return; }
    const finalSlug = slug || slugify(name);
    const slugResult = slugSchema.safeParse(finalSlug);
    if (!slugResult.success) { setError(slugResult.error.issues[0]?.message ?? "Invalid slug"); return; }
    if (startDate && endDate && startDate > endDate) { setError("Start date must be before end date"); return; }

    // Build theme
    const theme: CampaignTheme = {
      accent,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(startDate ? { start_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {}),
      ...(timezone !== "UTC" ? { timezone } : {}),
      ...(maxSpins && Number(maxSpins) > 0 ? { max_spins: Number(maxSpins) } : {}),
      ...(maxWinners && Number(maxWinners) > 0 ? { max_winners: Number(maxWinners) } : {}),
      ...(dailyLimit && Number(dailyLimit) > 0 ? { daily_limit: Number(dailyLimit) } : {}),
      game_type: gameType,
      is_draft: status === "draft",
      is_archived: status === "archived",
    };

    const isActive = status === "active";

    setBusy(true);
    try {
      if (isNew) {
        const res = await doCreate({
          data: { shopId, name: nameResult.data, slug: slugResult.data, theme, is_active: isActive },
        });
        onSave((res as { campaign: Campaign }).campaign);
      } else {
        await doUpdate({
          data: { shopId, id: campaign!.id, name: nameResult.data, slug: slugResult.data, theme, is_active: isActive },
        });
        // Return merged campaign object
        const updated: Campaign = {
          ...campaign!,
          name: nameResult.data,
          slug: slugResult.data,
          theme,
          is_active: isActive,
        };
        onSave(updated);
      }
    } catch (e: any) {
      setError(parseServerValidationError(e) ?? e?.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const STATUS_OPTIONS: { value: CampaignStatus; label: string; desc: string; color: string }[] = [
    { value: "active", label: "Active", desc: "Live & accepting spins", color: "emerald" },
    { value: "paused", label: "Paused", desc: "Hidden from customers", color: "amber" },
    { value: "draft", label: "Draft", desc: "Work in progress", color: "indigo" },
    ...(campaign && !campaign.is_default
      ? [{ value: "archived" as CampaignStatus, label: "Archived", desc: "Inactive, kept for records", color: "gray" }]
      : []),
  ];

  const statusColors: Record<string, string> = {
    active: "border-emerald-300 bg-emerald-50 text-emerald-800",
    paused: "border-amber-300 bg-amber-50 text-amber-800",
    draft: "border-indigo-300 bg-indigo-50 text-indigo-800",
    archived: "border-gray-300 bg-gray-50 text-gray-700",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={tryClose}
      />

      {/* Drawer — bottom sheet on mobile, right panel on ≥lg */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white rounded-t-[28px] shadow-2xl max-h-[92dvh] lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:w-[480px] lg:rounded-none lg:rounded-l-[28px] lg:max-h-none lg:overflow-y-auto animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#0c2340]/8 shrink-0">
          <div>
            <h2 className="text-lg font-black text-[#0c2340]">
              {isNew ? "New Campaign" : "Edit Campaign"}
            </h2>
            {!isNew && (
              <p className="text-xs text-[#4a5b78] mt-0.5">Changes apply immediately on save</p>
            )}
          </div>
          <button
            onClick={tryClose}
            className="w-9 h-9 rounded-full bg-[#F5F7FA] hover:bg-[#ECEFF5] flex items-center justify-center text-[#0c2340]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 overscroll-contain">

          {/* ── Basic Info ─────────────────────────────────── */}
          <section>
            <h3 className="text-xs uppercase tracking-widest font-bold text-[#4a5b78] mb-3">Basic Info</h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-[#0c2340] mb-1 block">Campaign Name <span className="text-red-500">*</span></span>
                <input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Summer Dhamaka"
                  maxLength={60}
                  className="w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-3.5 py-2.5 text-[#0c2340] font-semibold placeholder:text-[#4a5b78]/50 focus:outline-none focus:border-[#FF6B1A]/50 focus:bg-white transition-colors"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#0c2340] mb-1 block">URL Slug <span className="text-red-500">*</span></span>
                <div className="flex items-center bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl overflow-hidden focus-within:border-[#FF6B1A]/50 focus-within:bg-white transition-colors">
                  <span className="px-3 py-2.5 text-xs text-[#4a5b78] font-medium whitespace-nowrap border-r border-[#0c2340]/10 select-none">/s/shop/</span>
                  <input
                    value={slug}
                    onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                    placeholder="summer-dhamaka"
                    maxLength={40}
                    className="flex-1 px-3 py-2.5 bg-transparent text-[#0c2340] font-mono text-sm focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-[#4a5b78] mt-1">Lowercase letters, numbers and dashes only</p>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#0c2340] mb-1 block">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this campaign…"
                  maxLength={500}
                  rows={3}
                  className="w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-3.5 py-2.5 text-[#0c2340] placeholder:text-[#4a5b78]/50 focus:outline-none focus:border-[#FF6B1A]/50 focus:bg-white transition-colors resize-none text-sm"
                />
              </label>
            </div>
          </section>

          {/* ── Game Type ──────────────────────────────────── */}
          <section>
            <h3 className="text-xs uppercase tracking-widest font-bold text-[#4a5b78] mb-3">Game Type</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Spin Wheel */}
              <button
                type="button"
                onClick={() => setGameType("spin")}
                className={`relative p-3.5 rounded-2xl border-2 text-left transition-all duration-150 ${
                  gameType === "spin"
                    ? "border-[#FF6B1A] bg-gradient-to-br from-orange-50 to-white shadow-[0_0_0_3px_rgba(255,107,26,0.10)]"
                    : "border-[#0C2340]/10 bg-[#F8FAFC] hover:border-[#0C2340]/20 hover:bg-white hover:shadow-sm"
                }`}
              >
                {gameType === "spin" && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#FF6B1A] flex items-center justify-center">
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
                <div className={`w-9 h-9 rounded-xl grid place-items-center mb-2.5 transition-colors ${
                  gameType === "spin" ? "bg-[#FF6B1A]/15" : "bg-[#E8ECF2]"
                }`}>
                  <RotateCcw className={`w-5 h-5 ${gameType === "spin" ? "text-[#FF6B1A]" : "text-[#4a5b78]"}`} strokeWidth={1.75} />
                </div>
                <p className={`text-[13px] font-bold ${gameType === "spin" ? "text-[#0C2340]" : "text-[#4a5b78]"}`}>
                  Spin Wheel
                </p>
                <p className="text-[11px] mt-0.5 leading-snug text-[#6b7a93]">
                  Prize wheel customers spin to reveal
                </p>
              </button>

              {/* Scratch Card */}
              <button
                type="button"
                onClick={() => setGameType("scratch")}
                className={`relative p-3.5 rounded-2xl border-2 text-left transition-all duration-150 ${
                  gameType === "scratch"
                    ? "border-[#FF6B1A] bg-gradient-to-br from-orange-50 to-white shadow-[0_0_0_3px_rgba(255,107,26,0.10)]"
                    : "border-[#0C2340]/10 bg-[#F8FAFC] hover:border-[#0C2340]/20 hover:bg-white hover:shadow-sm"
                }`}
              >
                {gameType === "scratch" && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#FF6B1A] flex items-center justify-center">
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
                <div className={`w-9 h-9 rounded-xl grid place-items-center mb-2.5 transition-colors ${
                  gameType === "scratch" ? "bg-[#FF6B1A]/15" : "bg-[#E8ECF2]"
                }`}>
                  <CreditCard className={`w-5 h-5 ${gameType === "scratch" ? "text-[#FF6B1A]" : "text-[#4a5b78]"}`} strokeWidth={1.75} />
                </div>
                <p className={`text-[13px] font-bold ${gameType === "scratch" ? "text-[#0C2340]" : "text-[#4a5b78]"}`}>
                  Scratch Card
                </p>
                <p className="text-[11px] mt-0.5 leading-snug text-[#6b7a93]">
                  Scratch panel to reveal the prize
                </p>
              </button>

              {/* Coming soon cards */}
              {[
                { label: "Mystery Box", desc: "Unwrap a mystery prize box",   icon: "📦" },
                { label: "Lucky Draw",  desc: "Enter a draw for big prizes",   icon: "🎰" },
                { label: "Coupons",     desc: "Distribute discount coupons",   icon: "🎟️" },
              ].map((cs) => (
                <div
                  key={cs.label}
                  className="relative p-3.5 rounded-2xl border-2 border-dashed border-[#0C2340]/10 bg-[#F8FAFC]/60 cursor-not-allowed text-left select-none"
                  aria-disabled="true"
                >
                  <div className="w-9 h-9 rounded-xl grid place-items-center mb-2.5 bg-[#EEF0F4]">
                    <span className="text-base opacity-40">{cs.icon}</span>
                  </div>
                  <p className="text-[13px] font-bold text-[#0C2340]/40">{cs.label}</p>
                  <p className="text-[11px] mt-0.5 leading-snug text-[#6b7a93]/50">{cs.desc}</p>
                  <span className="inline-block mt-2 text-[9px] font-black px-2 py-0.5 rounded-full bg-[#0C2340]/8 text-[#6b7a93]/70 uppercase tracking-widest">
                    Soon
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Appearance ─────────────────────────────────── */}
          <section>
            <h3 className="text-xs uppercase tracking-widest font-bold text-[#4a5b78] mb-3">
              {gameType === "scratch" ? "Card Color" : "Wheel Color"}
            </h3>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESET_ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccent(c)}
                  className="w-9 h-9 rounded-full border-2 transition-all"
                  style={{
                    background: c,
                    borderColor: accent === c ? "#0c2340" : "transparent",
                    boxShadow: accent === c ? "0 0 0 3px rgba(12,35,64,0.15)" : "none",
                  }}
                  aria-label={c}
                />
              ))}
              <div className="relative" ref={colorRef}>
                <button
                  type="button"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="w-9 h-9 rounded-full border-2 border-dashed border-[#0c2340]/25 flex items-center justify-center hover:border-[#FF6B1A]/50 transition-colors bg-[#F5F7FA]"
                >
                  <Palette className="w-4 h-4 text-[#4a5b78]" />
                </button>
                {showColorPicker && (
                  <div className="absolute left-0 top-12 z-10 bg-white border border-[#0c2340]/10 rounded-xl p-3 shadow-xl">
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      className="w-32 h-10 rounded cursor-pointer border-0"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 ml-1">
                <div className="w-6 h-6 rounded-full border border-[#0c2340]/10" style={{ background: accent }} />
                <span className="font-mono text-xs text-[#4a5b78]">{accent}</span>
              </div>
            </div>
          </section>

          {/* ── Status ─────────────────────────────────────── */}
          <section>
            <h3 className="text-xs uppercase tracking-widest font-bold text-[#4a5b78] mb-3">Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    status === opt.value
                      ? statusColors[opt.value]
                      : "border-[#0c2340]/10 bg-[#F5F7FA] text-[#4a5b78] hover:border-[#0c2340]/20"
                  }`}
                >
                  <p className="text-sm font-bold">{opt.label}</p>
                  <p className="text-[11px] mt-0.5 opacity-70">{opt.desc}</p>
                </button>
              ))}
            </div>
            {campaign?.is_default && status !== "active" && status !== "paused" && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Default campaign cannot be archived or set to draft.</p>
            )}
          </section>

          {/* ── Schedule ───────────────────────────────────── */}
          <section>
            <h3 className="text-xs uppercase tracking-widest font-bold text-[#4a5b78] mb-3">Schedule <span className="text-[#4a5b78]/50 font-medium normal-case tracking-normal">(optional)</span></h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[#0c2340] mb-1 block">Start Date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-3 py-2.5 text-[#0c2340] text-sm focus:outline-none focus:border-[#FF6B1A]/50 focus:bg-white transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[#0c2340] mb-1 block">End Date</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-3 py-2.5 text-[#0c2340] text-sm focus:outline-none focus:border-[#FF6B1A]/50 focus:bg-white transition-colors"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-[#0c2340] mb-1 block">Timezone</span>
                <div className="relative">
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full appearance-none bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-3.5 py-2.5 text-[#0c2340] text-sm focus:outline-none focus:border-[#FF6B1A]/50 focus:bg-white transition-colors pr-9"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a5b78] pointer-events-none" />
                </div>
              </label>
            </div>
          </section>

          {/* ── Limits ─────────────────────────────────────── */}
          <section>
            <h3 className="text-xs uppercase tracking-widest font-bold text-[#4a5b78] mb-3">Limits <span className="text-[#4a5b78]/50 font-medium normal-case tracking-normal">(0 = unlimited)</span></h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Max Spins", value: maxSpins, set: setMaxSpins, placeholder: "∞" },
                { label: "Max Winners", value: maxWinners, set: setMaxWinners, placeholder: "∞" },
                { label: "Daily Limit", value: dailyLimit, set: setDailyLimit, placeholder: "∞" },
              ].map(({ label, value, set, placeholder }) => (
                <label key={label} className="block">
                  <span className="text-xs font-semibold text-[#0c2340] mb-1 block">{label}</span>
                  <input
                    type="number"
                    min={0}
                    value={value}
                    onChange={(e) => set(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder={placeholder}
                    className="w-full bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl px-3 py-2.5 text-[#0c2340] text-sm font-mono focus:outline-none focus:border-[#FF6B1A]/50 focus:bg-white transition-colors"
                  />
                </label>
              ))}
            </div>
          </section>

        </div>

        {/* ── Footer (sticky) ───────────────────────────────── */}
        <div className="border-t border-[#0c2340]/8 px-5 pt-4 pb-5 shrink-0 space-y-3 bg-white">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Unsaved changes warning */}
          {showUnsaved && (
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-semibold">You have unsaved changes.</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setShowUnsaved(false)}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-800 hover:bg-amber-50"
                >
                  Keep editing
                </button>
                <button
                  onClick={onClose}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Btn
              variant="outline"
              className="flex-1 py-3 text-sm"
              onClick={tryClose}
              disabled={busy}
            >
              Cancel
            </Btn>
            <Btn
              variant="primary"
              className="flex-1 py-3 text-sm"
              onClick={handleSave}
              disabled={busy}
              loading={busy}
              leftIcon={busy ? undefined : <Save className="w-4 h-4" />}
            >
              {busy ? "Saving…" : isNew ? "Create Campaign" : "Save Changes"}
            </Btn>
          </div>
        </div>
      </div>
    </>
  );
}

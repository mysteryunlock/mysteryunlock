/**
 * WheelDesigner — Live wheel colour/style designer with 10 presets.
 * Saves design settings to campaign.theme JSONB via updateCampaign.
 */

import { useState, useMemo, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Save, RotateCcw, Check } from "lucide-react";
import { SpinWheel } from "@/components/SpinWheel";
import { rowToPrize } from "@/lib/spin-store";
import { updateCampaign } from "@/lib/campaigns.functions";
import { parseServerValidationError } from "@/lib/utils";
import { Btn } from "@/components/ds";
import { HubSectionHeader } from "./ui";
import type { Campaign } from "./CampaignEditor";
import type { Shop, Prize } from "./types";

// ─── Design state ─────────────────────────────────────────────────────────────

export interface WheelDesign {
  palette:       string[];
  textColor:     string;
  centerColor:   string;
  pointerStyle:  "classic" | "arrow" | "diamond" | "star";
  showConfetti:  boolean;
  showParticles: boolean;
  showGlow:      boolean;
  soundEnabled:  boolean;
  textBold:      boolean;
  textUppercase: boolean;
  preset?:       string;
}

export const DEFAULT_WHEEL_DESIGN: WheelDesign = {
  palette:       ["#1f3460", "#FF6B1A"],
  textColor:     "#FFFFFF",
  centerColor:   "#f5f7fb",
  pointerStyle:  "classic",
  showConfetti:  true,
  showParticles: true,
  showGlow:      true,
  soundEnabled:  true,
  textBold:      true,
  textUppercase: false,
};

// ─── Presets ──────────────────────────────────────────────────────────────────

interface Preset {
  name:   string;
  swatch: string[];
  design: Partial<WheelDesign>;
}

const PRESETS: Preset[] = [
  {
    name: "Classic",
    swatch: ["#1f3460", "#FF6B1A"],
    design: {
      palette: ["#1f3460", "#FF6B1A"],
      textColor: "#FFFFFF",
      centerColor: "#f5f7fb",
      pointerStyle: "classic",
      showConfetti: true,
      showParticles: true,
      showGlow: true,
    },
  },
  {
    name: "Casino Night",
    swatch: ["#8B0000", "#C8A000"],
    design: {
      palette: ["#8B0000", "#C8A000"],
      textColor: "#FFFFFF",
      centerColor: "#1a0800",
      pointerStyle: "classic",
      showConfetti: true,
      showParticles: true,
      showGlow: true,
    },
  },
  {
    name: "Ocean",
    swatch: ["#0077B6", "#00B4D8", "#90E0EF"],
    design: {
      palette: ["#0077B6", "#00B4D8", "#0096C7"],
      textColor: "#FFFFFF",
      centerColor: "#CAF0F8",
      pointerStyle: "diamond",
      showConfetti: true,
      showParticles: true,
      showGlow: true,
    },
  },
  {
    name: "Forest",
    swatch: ["#1B4332", "#52B788", "#D8F3DC"],
    design: {
      palette: ["#1B4332", "#52B788", "#2D6A4F"],
      textColor: "#FFFFFF",
      centerColor: "#D8F3DC",
      pointerStyle: "arrow",
      showConfetti: true,
      showParticles: true,
      showGlow: true,
    },
  },
  {
    name: "Sunset",
    swatch: ["#FF4D6D", "#FF7C43", "#FFA62B"],
    design: {
      palette: ["#FF4D6D", "#FF7C43", "#FFA62B"],
      textColor: "#FFFFFF",
      centerColor: "#FFF0E6",
      pointerStyle: "star",
      showConfetti: true,
      showParticles: true,
      showGlow: true,
    },
  },
  {
    name: "Royal",
    swatch: ["#6B2D8B", "#9D4EDD", "#C77DFF"],
    design: {
      palette: ["#6B2D8B", "#9D4EDD", "#5A189A"],
      textColor: "#FFFFFF",
      centerColor: "#E0AAFF",
      pointerStyle: "diamond",
      showConfetti: true,
      showParticles: true,
      showGlow: true,
    },
  },
  {
    name: "Candy Pop",
    swatch: ["#FF006E", "#8338EC", "#3A86FF"],
    design: {
      palette: ["#FF006E", "#8338EC", "#3A86FF", "#06D6A0"],
      textColor: "#FFFFFF",
      centerColor: "#FFF0F8",
      pointerStyle: "star",
      showConfetti: true,
      showParticles: true,
      showGlow: true,
    },
  },
  {
    name: "Neon",
    swatch: ["#FF006E", "#00F5D4", "#FFE600"],
    design: {
      palette: ["#FF006E", "#00F5D4", "#FFE600", "#9B5DE5"],
      textColor: "#0C2340",
      centerColor: "#0d0d1a",
      pointerStyle: "arrow",
      showConfetti: true,
      showParticles: true,
      showGlow: true,
    },
  },
  {
    name: "Midnight",
    swatch: ["#0F1923", "#1A3350", "#2E5F8A"],
    design: {
      palette: ["#0F1923", "#1A3350", "#2E5F8A", "#15293E"],
      textColor: "#C5CFDB",
      centerColor: "#060d14",
      pointerStyle: "classic",
      showConfetti: true,
      showParticles: false,
      showGlow: false,
    },
  },
  {
    name: "Minimal",
    swatch: ["#F0F2F5", "#0C2340"],
    design: {
      palette: ["#F0F2F5", "#0C2340"],
      textColor: "#0C2340",
      centerColor: "#FFFFFF",
      pointerStyle: "classic",
      showConfetti: false,
      showParticles: false,
      showGlow: false,
    },
  },
];

// ─── Colour options ───────────────────────────────────────────────────────────

const PALETTES = [
  { name: "Blue & Orange", colors: ["#1f3460", "#FF6B1A"] },
  { name: "Casino Gold",   colors: ["#8B0000", "#C8A000"] },
  { name: "Ocean",         colors: ["#0077B6", "#00B4D8", "#0096C7"] },
  { name: "Forest",        colors: ["#1B4332", "#52B788", "#2D6A4F"] },
  { name: "Sunset",        colors: ["#FF4D6D", "#FF7C43", "#FFA62B"] },
  { name: "Royal Purple",  colors: ["#6B2D8B", "#9D4EDD", "#5A189A"] },
  { name: "Candy Pop",     colors: ["#FF006E", "#8338EC", "#3A86FF", "#06D6A0"] },
  { name: "Neon",          colors: ["#FF006E", "#00F5D4", "#FFE600"] },
  { name: "Midnight",      colors: ["#0F1923", "#1A3350", "#2E5F8A"] },
  { name: "Minimal",       colors: ["#F0F2F5", "#0C2340"] },
];

const TEXT_COLORS = [
  { label: "White",  value: "#FFFFFF" },
  { label: "Dark",   value: "#0C2340" },
  { label: "Gold",   value: "#C8A000" },
  { label: "Orange", value: "#FF6B1A" },
];

const CENTER_COLORS = [
  { label: "Soft White", value: "#f5f7fb" },
  { label: "Pure White", value: "#FFFFFF" },
  { label: "Dark Navy",  value: "#0C2340" },
  { label: "Orange",     value: "#FF6B1A" },
];

const POINTER_OPTIONS: Array<{
  value: WheelDesign["pointerStyle"];
  label: string;
  desc:  string;
}> = [
  { value: "classic", label: "Classic",  desc: "Jeweled teardrop" },
  { value: "arrow",   label: "Arrow",    desc: "Sleek arrowhead"  },
  { value: "diamond", label: "Diamond",  desc: "Diamond gem"      },
  { value: "star",    label: "Star",     desc: "Golden star"      },
];

// ─── Theme reader ─────────────────────────────────────────────────────────────

function readDesignFromTheme(theme: Record<string, unknown> | null): WheelDesign {
  if (!theme) return { ...DEFAULT_WHEEL_DESIGN };
  return {
    palette:       Array.isArray(theme.wheel_palette) ? (theme.wheel_palette as string[]) : DEFAULT_WHEEL_DESIGN.palette,
    textColor:     typeof theme.wheel_text_color === "string"    ? theme.wheel_text_color    : DEFAULT_WHEEL_DESIGN.textColor,
    centerColor:   typeof theme.wheel_center_color === "string"  ? theme.wheel_center_color  : DEFAULT_WHEEL_DESIGN.centerColor,
    pointerStyle:  (["classic","arrow","diamond","star"].includes(theme.wheel_pointer_style as string)
      ? theme.wheel_pointer_style as WheelDesign["pointerStyle"]
      : DEFAULT_WHEEL_DESIGN.pointerStyle),
    showConfetti:  typeof theme.wheel_show_confetti === "boolean"  ? theme.wheel_show_confetti  : DEFAULT_WHEEL_DESIGN.showConfetti,
    showParticles: typeof theme.wheel_show_particles === "boolean" ? theme.wheel_show_particles : DEFAULT_WHEEL_DESIGN.showParticles,
    showGlow:      typeof theme.wheel_show_glow === "boolean"     ? theme.wheel_show_glow     : DEFAULT_WHEEL_DESIGN.showGlow,
    soundEnabled:  typeof theme.wheel_sound_enabled === "boolean"  ? theme.wheel_sound_enabled  : DEFAULT_WHEEL_DESIGN.soundEnabled,
    textBold:      typeof theme.wheel_text_bold === "boolean"      ? theme.wheel_text_bold      : DEFAULT_WHEEL_DESIGN.textBold,
    textUppercase: typeof theme.wheel_text_uppercase === "boolean" ? theme.wheel_text_uppercase : DEFAULT_WHEEL_DESIGN.textUppercase,
    preset:        typeof theme.wheel_preset === "string"          ? theme.wheel_preset         : undefined,
  };
}

// ─── WheelDesigner ────────────────────────────────────────────────────────────

interface Props {
  shop:     Shop;
  campaign: Campaign;
  prizes:   Prize[];
  onBack:   () => void;
  onSaved?: () => void;
}

export function WheelDesigner({ shop, campaign, prizes, onBack, onSaved }: Props) {
  const doUpdate = useServerFn(updateCampaign);

  const initial = useMemo(
    () => readDesignFromTheme(campaign.theme as Record<string, unknown> | null),
    [campaign.theme],
  );

  const [design,  setDesign]  = useState<WheelDesign>(initial);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  const isDirty = JSON.stringify(design) !== JSON.stringify(initial);

  const wheelPrizes = useMemo(
    () => prizes.slice(0, 10).map((p) => rowToPrize(p as any)),
    [prizes],
  );

  const patch = useCallback((partial: Partial<WheelDesign>) => {
    setDesign((d) => ({ ...d, ...partial }));
    setSaved(false);
  }, []);

  const applyPreset = useCallback((p: Preset) => {
    setDesign({ ...DEFAULT_WHEEL_DESIGN, ...p.design, preset: p.name });
    setSaved(false);
  }, []);

  const restore = useCallback(() => {
    setDesign({ ...DEFAULT_WHEEL_DESIGN });
    setSaved(false);
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const merged = {
        ...(campaign.theme as Record<string, unknown> ?? {}),
        wheel_palette:        design.palette,
        wheel_text_color:     design.textColor,
        wheel_center_color:   design.centerColor,
        wheel_pointer_style:  design.pointerStyle,
        wheel_show_confetti:  design.showConfetti,
        wheel_show_particles: design.showParticles,
        wheel_show_glow:      design.showGlow,
        wheel_sound_enabled:  design.soundEnabled,
        wheel_text_bold:      design.textBold,
        wheel_text_uppercase: design.textUppercase,
        wheel_preset:         design.preset,
      };
      await doUpdate({ data: { shopId: shop.id, id: campaign.id, theme: merged as any } });
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(parseServerValidationError(err) ?? "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <HubSectionHeader title="Wheel Designer" onBack={onBack} />

      {/* ── Presets ───────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-2.5">
          Presets
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-0.5 px-0.5" style={{ scrollbarWidth: "none" }}>
          {PRESETS.map((p) => {
            const active = design.preset === p.name;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className={`shrink-0 flex flex-col items-center gap-1.5 px-2.5 py-2 rounded-[14px] border-2 transition-all duration-150 min-w-[64px] ${
                  active
                    ? "border-[#FF6B1A] bg-orange-50 shadow-[0_0_0_3px_rgba(255,107,26,0.10)]"
                    : "border-[#0C2340]/10 bg-white hover:border-[#0C2340]/20 hover:bg-[#F8FAFC]"
                }`}
              >
                <div className="flex gap-0.5">
                  {p.swatch.slice(0, 3).map((c, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full border border-black/10"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <span
                  className={`text-[10px] font-bold leading-none whitespace-nowrap ${
                    active ? "text-[#FF6B1A]" : "text-[#4a5b78]"
                  }`}
                >
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main: preview + settings ───────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4">

        {/* Live preview */}
        <div className="w-full md:w-[210px] shrink-0">
          <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-2.5">
            Preview
          </p>
          <div className="rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
            {wheelPrizes.length === 0 ? (
              <div className="aspect-square flex items-center justify-center">
                <p className="text-xs text-[#6b7a93] text-center px-4">
                  Add prizes to preview the wheel
                </p>
              </div>
            ) : (
              <SpinWheel
                prizes={wheelPrizes}
                spinning={false}
                targetIndex={null}
                onComplete={() => {}}
                centerLogo={shop.logo_url ?? undefined}
                centerLabel={shop.name}
                segmentPalette={design.palette}
                textColor={design.textColor}
                centerColor={design.centerColor}
                pointerStyle={design.pointerStyle}
                showConfetti={false}
                showParticles={design.showParticles}
                showGlow={false}
                soundEnabled={false}
                textBold={design.textBold}
                textUppercase={design.textUppercase}
              />
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="flex-1 space-y-3 min-w-0">

          {/* Colour palette */}
          <div className="rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
            <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-3">
              Colour Palette
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PALETTES.map((pal) => {
                const active = JSON.stringify(design.palette) === JSON.stringify(pal.colors);
                return (
                  <button
                    key={pal.name}
                    type="button"
                    onClick={() => patch({ palette: pal.colors, preset: undefined })}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all duration-150 ${
                      active
                        ? "border-[#FF6B1A] bg-orange-50"
                        : "border-[#0C2340]/10 hover:border-[#0C2340]/20 hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <div className="flex gap-0.5 shrink-0">
                      {pal.colors.map((c, i) => (
                        <div
                          key={i}
                          className="w-3.5 h-6 first:rounded-l last:rounded-r border border-black/10"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] font-bold truncate leading-tight ${active ? "text-[#FF6B1A]" : "text-[#0C2340]"}`}>
                        {pal.name}
                      </p>
                      {active && <Check className="w-3 h-3 text-[#FF6B1A] mt-0.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text & hub color */}
          <div className="rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3.5">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-2">
                Label Color
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TEXT_COLORS.map((tc) => (
                  <button
                    key={tc.value}
                    type="button"
                    onClick={() => patch({ textColor: tc.value })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-[11px] font-bold transition-all duration-150 ${
                      design.textColor === tc.value
                        ? "border-[#FF6B1A] bg-orange-50 text-[#FF6B1A]"
                        : "border-[#0C2340]/10 text-[#4a5b78] hover:border-[#0C2340]/20"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                      style={{ background: tc.value }}
                    />
                    {tc.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-2">
                Hub Color
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CENTER_COLORS.map((cc) => (
                  <button
                    key={cc.value}
                    type="button"
                    onClick={() => patch({ centerColor: cc.value })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-[11px] font-bold transition-all duration-150 ${
                      design.centerColor === cc.value
                        ? "border-[#FF6B1A] bg-orange-50 text-[#FF6B1A]"
                        : "border-[#0C2340]/10 text-[#4a5b78] hover:border-[#0C2340]/20"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                      style={{ background: cc.value }}
                    />
                    {cc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pointer style */}
          <div className="rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
            <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-3">
              Pointer Style
            </p>
            <div className="grid grid-cols-4 gap-2">
              {POINTER_OPTIONS.map((po) => (
                <button
                  key={po.value}
                  type="button"
                  onClick={() => patch({ pointerStyle: po.value })}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all duration-150 ${
                    design.pointerStyle === po.value
                      ? "border-[#FF6B1A] bg-orange-50"
                      : "border-[#0C2340]/10 hover:border-[#0C2340]/20 hover:bg-[#F8FAFC]"
                  }`}
                >
                  <PointerSvg style={po.value} active={design.pointerStyle === po.value} />
                  <p className={`text-[10px] font-bold leading-none ${design.pointerStyle === po.value ? "text-[#FF6B1A]" : "text-[#4a5b78]"}`}>
                    {po.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Effects */}
          <div className="rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
            <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-3">
              Effects
            </p>
            <div className="divide-y divide-[#0C2340]/6">
              <EffectRow
                label="Confetti burst"
                desc="Party confetti shower on win"
                checked={design.showConfetti}
                onChange={(v) => patch({ showConfetti: v })}
              />
              <EffectRow
                label="Particle halo"
                desc="Floating glow particles around rim"
                checked={design.showParticles}
                onChange={(v) => patch({ showParticles: v })}
              />
              <EffectRow
                label="Win glow ring"
                desc="Orange pulse behind wheel on win"
                checked={design.showGlow}
                onChange={(v) => patch({ showGlow: v })}
              />
              <EffectRow
                label="Sound effects"
                desc="Spin, win, and lose sound effects"
                checked={design.soundEnabled}
                onChange={(v) => patch({ soundEnabled: v })}
              />
            </div>
          </div>

          {/* Text Formatting */}
          <div className="rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
            <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-3">
              Text Style
            </p>
            <div className="divide-y divide-[#0C2340]/6">
              <EffectRow
                label="Bold labels"
                desc="Prize names displayed in bold weight"
                checked={design.textBold}
                onChange={(v) => patch({ textBold: v })}
              />
              <EffectRow
                label="Uppercase labels"
                desc="Prize names displayed in ALL CAPS"
                checked={design.textUppercase}
                onChange={(v) => patch({ textUppercase: v })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-sm text-red-600 text-center rounded-xl bg-red-50 py-2 px-3">{error}</p>
      )}

      {/* ── Footer actions ────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={restore}
          className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-[#0C2340]/12 bg-white hover:bg-[#F5F7FA] text-[#4a5b78] text-sm font-bold transition-colors shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Defaults
        </button>
        <Btn
          variant="primary"
          className="flex-1 rounded-2xl py-3"
          onClick={save}
          disabled={saving || (!isDirty && saved)}
        >
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
        </Btn>
      </div>
    </div>
  );
}

// ─── PointerSvg — mini pointer thumbnail ──────────────────────────────────────

function PointerSvg({
  style,
  active,
}: {
  style:  WheelDesign["pointerStyle"];
  active: boolean;
}) {
  const body = active ? "#FF6B1A" : "#4a5b78";
  return (
    <svg width="24" height="28" viewBox="0 0 24 28">
      {style === "classic" && (
        <>
          <path d="M12 27 L3 11 Q12 3 21 11 Z" fill={body} opacity="0.85" />
          <circle cx="12" cy="10" r="4" fill="#FF6B1A" />
          <circle cx="10.5" cy="8.5" r="1.3" fill="rgba(255,255,255,0.6)" />
        </>
      )}
      {style === "arrow" && (
        <>
          <path d="M12 27 L1 10 L12 3 L23 10 Z" fill={body} opacity="0.85" />
          <path d="M12 27 L1 10 L12 16 L23 10 Z" fill="rgba(255,255,255,0.1)" />
          <circle cx="12" cy="9" r="3.5" fill="#FF6B1A" />
        </>
      )}
      {style === "diamond" && (
        <>
          <path d="M12 27 L1 14 L12 1 L23 14 Z" fill={body} opacity="0.85" />
          <path d="M12 27 L1 14 L12 17 L23 14 Z" fill="rgba(255,255,255,0.1)" />
          <circle cx="12" cy="7" r="3.5" fill="#FF6B1A" />
        </>
      )}
      {style === "star" && (
        <>
          <path
            d="M12 1.5 L14 8 L21 8 L15.5 12 L17.5 19 L12 15.5 L6.5 19 L8.5 12 L3 8 L10 8 Z"
            fill="#FF6B1A"
            opacity="0.9"
          />
          <path d="M11 20 L11 27 L13 27 L13 20 Z" fill={body} opacity="0.7" />
        </>
      )}
    </svg>
  );
}

// ─── EffectRow — toggle switch row ───────────────────────────────────────────

function EffectRow({
  label, desc, checked, onChange,
}: {
  label:    string;
  desc:     string;
  checked:  boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full py-2.5 text-left first:pt-0 last:pb-0"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#0C2340]">{label}</p>
        <p className="text-[11px] text-[#6b7a93] mt-0.5">{desc}</p>
      </div>
      <div
        className="relative shrink-0 ml-4 rounded-full transition-colors duration-200"
        style={{
          width: 38, height: 22,
          background: checked ? "#FF6B1A" : "#D0D5E0",
        }}
      >
        <div
          className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200"
          style={{ left: checked ? 18 : 3, width: 16, height: 16 }}
        />
      </div>
    </button>
  );
}

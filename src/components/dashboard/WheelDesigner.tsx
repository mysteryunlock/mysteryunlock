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
  textSpacing:   "normal" | "wide" | "wider";
  rimColor:      string;
  rimThickness:  "thin" | "normal" | "thick";
  bgStyle:       "gradient" | "solid";
  preset?:       string;
  // Scratch card back customisation
  cardBackStyle?:  "metallic" | "solid" | "gradient";
  cardBackColor?:  string;
  cardBackColor2?: string;
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
  textSpacing:   "normal",
  rimColor:      "#1f3460",
  rimThickness:  "normal",
  bgStyle:       "gradient",
  cardBackStyle:  "metallic",
  cardBackColor:  "#7A8FA8",
  cardBackColor2: "#C8DCF0",
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
      showConfetti: true, showParticles: true, showGlow: true,
      soundEnabled: true, textBold: true, textUppercase: false,
      textSpacing: "normal", rimColor: "#1f3460", rimThickness: "normal", bgStyle: "gradient",
    },
  },
  {
    name: "Casino",
    swatch: ["#8B0000", "#C8A000"],
    design: {
      palette: ["#8B0000", "#C8A000"],
      textColor: "#FFFFFF",
      centerColor: "#1a0800",
      pointerStyle: "classic",
      showConfetti: true, showParticles: true, showGlow: true,
      soundEnabled: true, textBold: true, textUppercase: true,
      textSpacing: "wide", rimColor: "#C8A000", rimThickness: "thick", bgStyle: "solid",
    },
  },
  {
    name: "Luxury Gold",
    swatch: ["#B8860B", "#FFD700", "#8B6914"],
    design: {
      palette: ["#B8860B", "#FFD700", "#8B6914", "#DAA520"],
      textColor: "#0C2340",
      centerColor: "#FFF8DC",
      pointerStyle: "star",
      showConfetti: true, showParticles: true, showGlow: true,
      soundEnabled: true, textBold: true, textUppercase: true,
      textSpacing: "wide", rimColor: "#B8860B", rimThickness: "thick", bgStyle: "gradient",
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
      showConfetti: false, showParticles: false, showGlow: false,
      soundEnabled: false, textBold: false, textUppercase: false,
      textSpacing: "normal", rimColor: "#0C2340", rimThickness: "thin", bgStyle: "gradient",
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
      showConfetti: true, showParticles: true, showGlow: true,
      soundEnabled: true, textBold: true, textUppercase: true,
      textSpacing: "wider", rimColor: "#FF006E", rimThickness: "normal", bgStyle: "solid",
    },
  },
  {
    name: "Dark Mode",
    swatch: ["#0F1923", "#1A3350", "#2E5F8A"],
    design: {
      palette: ["#0F1923", "#1A3350", "#2E5F8A", "#15293E"],
      textColor: "#C5CFDB",
      centerColor: "#060d14",
      pointerStyle: "classic",
      showConfetti: true, showParticles: false, showGlow: false,
      soundEnabled: true, textBold: true, textUppercase: false,
      textSpacing: "normal", rimColor: "#0F1923", rimThickness: "normal", bgStyle: "solid",
    },
  },
  {
    name: "Glass",
    swatch: ["#CAF0F8", "#90E0EF", "#0077B6"],
    design: {
      palette: ["#ADE8F4", "#CAF0F8", "#90E0EF", "#0096C7"],
      textColor: "#023E8A",
      centerColor: "#FFFFFF",
      pointerStyle: "diamond",
      showConfetti: true, showParticles: true, showGlow: true,
      soundEnabled: true, textBold: false, textUppercase: false,
      textSpacing: "normal", rimColor: "#0077B6", rimThickness: "thin", bgStyle: "gradient",
    },
  },
  {
    name: "Festival",
    swatch: ["#FF006E", "#FFBE0B", "#06D6A0"],
    design: {
      palette: ["#FF006E", "#FFBE0B", "#06D6A0", "#8338EC", "#FF7900"],
      textColor: "#FFFFFF",
      centerColor: "#FFF0F8",
      pointerStyle: "star",
      showConfetti: true, showParticles: true, showGlow: true,
      soundEnabled: true, textBold: true, textUppercase: false,
      textSpacing: "normal", rimColor: "#FF006E", rimThickness: "normal", bgStyle: "gradient",
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
      showConfetti: true, showParticles: true, showGlow: true,
      soundEnabled: true, textBold: true, textUppercase: false,
      textSpacing: "normal", rimColor: "#6B2D8B", rimThickness: "normal", bgStyle: "gradient",
    },
  },
  {
    name: "Modern",
    swatch: ["#0F4C75", "#1B262C", "#00B4D8"],
    design: {
      palette: ["#0F4C75", "#1B262C", "#00B4D8", "#0077B6"],
      textColor: "#FFFFFF",
      centerColor: "#E0F7FA",
      pointerStyle: "arrow",
      showConfetti: true, showParticles: true, showGlow: true,
      soundEnabled: true, textBold: true, textUppercase: false,
      textSpacing: "normal", rimColor: "#0F4C75", rimThickness: "normal", bgStyle: "gradient",
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

// ─── Card back presets ────────────────────────────────────────────────────────

interface CardBackPreset {
  name:    string;
  style:   "metallic" | "solid" | "gradient";
  color:   string;
  color2:  string;
  preview: string; // CSS background string for the thumbnail
}

const CARD_BACK_PRESETS: CardBackPreset[] = [
  {
    name: "Silver",
    style: "metallic", color: "#7A8FA8", color2: "#C8DCF0",
    preview: "linear-gradient(135deg,#7A8FA8 0%,#B8C8DC 16%,#4A6080 30%,#C8DCF0 44%,#7A8FA8 58%,#E8F0FA 72%,#7A8FA8 100%)",
  },
  {
    name: "Navy",
    style: "gradient", color: "#0c2340", color2: "#1f3060",
    preview: "linear-gradient(135deg,#0c2340 0%,#1f3060 55%,#0c2340 100%)",
  },
  {
    name: "Midnight",
    style: "gradient", color: "#1a0533", color2: "#6a1b9a",
    preview: "linear-gradient(135deg,#1a0533 0%,#6a1b9a 55%,#1a0533 100%)",
  },
  {
    name: "Rose",
    style: "gradient", color: "#8B0030", color2: "#E91E63",
    preview: "linear-gradient(135deg,#8B0030 0%,#E91E63 55%,#8B0030 100%)",
  },
  {
    name: "Emerald",
    style: "gradient", color: "#1B5E20", color2: "#4CAF50",
    preview: "linear-gradient(135deg,#1B5E20 0%,#4CAF50 55%,#1B5E20 100%)",
  },
  {
    name: "Sunset",
    style: "gradient", color: "#FF4500", color2: "#FF6B1A",
    preview: "linear-gradient(135deg,#FF4500 0%,#FF6B1A 55%,#FF4500 100%)",
  },
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
    textSpacing:   (["normal","wide","wider"].includes(theme.wheel_text_spacing as string) ? theme.wheel_text_spacing as WheelDesign["textSpacing"] : DEFAULT_WHEEL_DESIGN.textSpacing),
    rimColor:      typeof theme.wheel_rim_color === "string"       ? theme.wheel_rim_color      : DEFAULT_WHEEL_DESIGN.rimColor,
    rimThickness:  (["thin","normal","thick"].includes(theme.wheel_rim_thickness as string) ? theme.wheel_rim_thickness as WheelDesign["rimThickness"] : DEFAULT_WHEEL_DESIGN.rimThickness),
    bgStyle:       (["gradient","solid"].includes(theme.wheel_bg_style as string) ? theme.wheel_bg_style as WheelDesign["bgStyle"] : DEFAULT_WHEEL_DESIGN.bgStyle),
    preset:        typeof theme.wheel_preset === "string"          ? theme.wheel_preset         : undefined,
    cardBackStyle:  (["metallic","solid","gradient"].includes(theme.card_back_style as string) ? theme.card_back_style as WheelDesign["cardBackStyle"] : DEFAULT_WHEEL_DESIGN.cardBackStyle),
    cardBackColor:  typeof theme.card_back_color  === "string" ? theme.card_back_color  : DEFAULT_WHEEL_DESIGN.cardBackColor,
    cardBackColor2: typeof theme.card_back_color2 === "string" ? theme.card_back_color2 : DEFAULT_WHEEL_DESIGN.cardBackColor2,
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
        wheel_text_spacing:   design.textSpacing,
        wheel_rim_color:      design.rimColor,
        wheel_rim_thickness:  design.rimThickness,
        wheel_bg_style:       design.bgStyle,
        wheel_preset:         design.preset,
        card_back_style:      design.cardBackStyle,
        card_back_color:      design.cardBackColor,
        card_back_color2:     design.cardBackColor2,
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
                textSpacing={design.textSpacing}
                rimColor={design.rimColor}
                rimThickness={design.rimThickness}
                bgStyle={design.bgStyle}
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
          <div className="rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3.5">
            <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93]">
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
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-2">
                Letter Spacing
              </p>
              <div className="flex gap-1.5">
                {(["normal", "wide", "wider"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => patch({ textSpacing: s })}
                    className={`flex-1 py-2 rounded-xl border-2 text-[11px] font-bold capitalize transition-all ${
                      design.textSpacing === s
                        ? "border-[#FF6B1A] bg-orange-50 text-[#FF6B1A]"
                        : "border-[#0C2340]/10 text-[#4a5b78] hover:border-[#0C2340]/20"
                    }`}
                  >
                    {s === "normal" ? "Normal" : s === "wide" ? "Wide" : "Wider"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Border & Background */}
          <div className="rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-3.5">
            <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93]">
              Border & Background
            </p>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-2">
                Rim Thickness
              </p>
              <div className="flex gap-1.5">
                {(["thin", "normal", "thick"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => patch({ rimThickness: t })}
                    className={`flex-1 py-2 rounded-xl border-2 text-[11px] font-bold capitalize transition-all ${
                      design.rimThickness === t
                        ? "border-[#FF6B1A] bg-orange-50 text-[#FF6B1A]"
                        : "border-[#0C2340]/10 text-[#4a5b78] hover:border-[#0C2340]/20"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-2">
                Rim Color
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Navy",  value: "#1f3460" },
                  { label: "Dark",  value: "#0C2340" },
                  { label: "Gold",  value: "#C8A000" },
                  { label: "Orange",value: "#FF6B1A" },
                  { label: "Purple",value: "#6B2D8B" },
                  { label: "Black", value: "#000000" },
                ].map((rc) => (
                  <button
                    key={rc.value}
                    type="button"
                    onClick={() => patch({ rimColor: rc.value })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-[11px] font-bold transition-all ${
                      design.rimColor === rc.value
                        ? "border-[#FF6B1A] bg-orange-50 text-[#FF6B1A]"
                        : "border-[#0C2340]/10 text-[#4a5b78] hover:border-[#0C2340]/20"
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full border border-black/20 shrink-0" style={{ background: rc.value }} />
                    {rc.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-2">
                Background Style
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => patch({ bgStyle: "gradient" })}
                  className={`flex-1 py-2 rounded-xl border-2 text-[11px] font-bold transition-all ${
                    design.bgStyle === "gradient"
                      ? "border-[#FF6B1A] bg-orange-50 text-[#FF6B1A]"
                      : "border-[#0C2340]/10 text-[#4a5b78] hover:border-[#0C2340]/20"
                  }`}
                >
                  Gradient
                </button>
                <button
                  type="button"
                  onClick={() => patch({ bgStyle: "solid" })}
                  className={`flex-1 py-2 rounded-xl border-2 text-[11px] font-bold transition-all ${
                    design.bgStyle === "solid"
                      ? "border-[#FF6B1A] bg-orange-50 text-[#FF6B1A]"
                      : "border-[#0C2340]/10 text-[#4a5b78] hover:border-[#0C2340]/20"
                  }`}
                >
                  Solid Dark
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Card Back Style (scratch campaigns) ─────────────────────────────── */}
      <div>
        <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-2.5">
          Scratch Card Back
        </p>
        <div className="rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 space-y-4">

          {/* Style presets — each tile shows a mini card back preview */}
          <div>
            <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-2">
              Style
            </p>
            <div className="grid grid-cols-3 gap-2">
              {CARD_BACK_PRESETS.map((preset) => {
                const active =
                  design.cardBackStyle === preset.style &&
                  design.cardBackColor  === preset.color &&
                  design.cardBackColor2 === preset.color2;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      patch({
                        cardBackStyle:  preset.style,
                        cardBackColor:  preset.color,
                        cardBackColor2: preset.color2,
                      })
                    }
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-[14px] border-2 transition-all duration-150 ${
                      active
                        ? "border-[#FF6B1A] shadow-[0_0_0_3px_rgba(255,107,26,0.10)]"
                        : "border-[#0C2340]/10 hover:border-[#0C2340]/20"
                    }`}
                  >
                    {/* Mini card back thumbnail */}
                    <div
                      className="w-full h-10 rounded-lg overflow-hidden relative flex items-center justify-center"
                      style={{ background: preset.preview }}
                    >
                      {/* Shimmer lines */}
                      {[25, 50, 75].map((pct) => (
                        <div
                          key={pct}
                          className="absolute inset-x-0 h-px"
                          style={{ top: `${pct}%`, background: "rgba(255,255,255,0.18)" }}
                        />
                      ))}
                      {/* Sparkle dot */}
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.20)" }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                        </svg>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold leading-none whitespace-nowrap ${
                        active ? "text-[#FF6B1A]" : "text-[#4a5b78]"
                      }`}
                    >
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom colour pickers — shown when "Custom" or any gradient style active */}
          <div>
            <p className="text-[11px] uppercase tracking-widest font-bold text-[#6b7a93] mb-2">
              Custom Colours
            </p>
            <div className="flex gap-3 items-center">
              <label className="flex flex-col items-center gap-1 text-[10px] text-[#6b7a93] font-semibold cursor-pointer">
                <div className="relative">
                  <input
                    type="color"
                    value={design.cardBackColor ?? "#1a2744"}
                    onChange={(e) =>
                      patch({ cardBackStyle: design.cardBackStyle === "metallic" ? "solid" : design.cardBackStyle, cardBackColor: e.target.value })
                    }
                    className="sr-only"
                  />
                  <div
                    className="w-9 h-9 rounded-xl border-2 border-[#0C2340]/15 shadow-sm cursor-pointer"
                    style={{ background: design.cardBackColor ?? "#1a2744" }}
                    onClick={(e) => (e.currentTarget.previousElementSibling as HTMLInputElement | null)?.click()}
                  />
                </div>
                Primary
              </label>

              <label className="flex flex-col items-center gap-1 text-[10px] text-[#6b7a93] font-semibold cursor-pointer">
                <div className="relative">
                  <input
                    type="color"
                    value={design.cardBackColor2 ?? "#2d4a8a"}
                    onChange={(e) =>
                      patch({ cardBackStyle: "gradient", cardBackColor2: e.target.value })
                    }
                    className="sr-only"
                  />
                  <div
                    className="w-9 h-9 rounded-xl border-2 border-[#0C2340]/15 shadow-sm cursor-pointer"
                    style={{ background: design.cardBackColor2 ?? "#2d4a8a" }}
                    onClick={(e) => (e.currentTarget.previousElementSibling as HTMLInputElement | null)?.click()}
                  />
                </div>
                Secondary
              </label>

              <div className="flex-1">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => patch({ cardBackStyle: "solid" })}
                    className={`flex-1 py-1.5 rounded-lg border-2 text-[10px] font-bold transition-all ${
                      design.cardBackStyle === "solid"
                        ? "border-[#FF6B1A] bg-orange-50 text-[#FF6B1A]"
                        : "border-[#0C2340]/10 text-[#6b7a93] hover:border-[#0C2340]/20"
                    }`}
                  >
                    Solid
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ cardBackStyle: "gradient" })}
                    className={`flex-1 py-1.5 rounded-lg border-2 text-[10px] font-bold transition-all ${
                      design.cardBackStyle === "gradient"
                        ? "border-[#FF6B1A] bg-orange-50 text-[#FF6B1A]"
                        : "border-[#0C2340]/10 text-[#6b7a93] hover:border-[#0C2340]/20"
                    }`}
                  >
                    Gradient
                  </button>
                </div>
              </div>
            </div>

            {/* Live preview of the current card back */}
            <div className="mt-3 flex items-center gap-3">
              <div
                className="w-16 h-16 rounded-2xl overflow-hidden relative flex items-center justify-center shrink-0"
                style={{
                  background:
                    design.cardBackStyle === "solid"
                      ? (design.cardBackColor ?? "#1a2744")
                      : design.cardBackStyle === "gradient"
                      ? `linear-gradient(135deg, ${design.cardBackColor ?? "#1a2744"} 0%, ${design.cardBackColor2 ?? "#2d4a8a"} 55%, ${design.cardBackColor ?? "#1a2744"} 100%)`
                      : "linear-gradient(135deg,#7A8FA8 0%,#B8C8DC 16%,#4A6080 30%,#C8DCF0 44%,#7A8FA8 58%,#E8F0FA 72%,#7A8FA8 100%)",
                }}
              >
                {[25, 50, 75].map((pct) => (
                  <div
                    key={pct}
                    className="absolute inset-x-0 h-px"
                    style={{ top: `${pct}%`, background: "rgba(255,255,255,0.15)" }}
                  />
                ))}
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.20)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                    <path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/>
                  </svg>
                </div>
              </div>
              <p className="text-[11px] text-[#6b7a93] leading-relaxed">
                This is how the back of each mystery card will look during the shuffle.
                Changes apply to the Scratch &amp; Choose game only.
              </p>
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

import { useState, useMemo, memo } from "react";
import {
  UserPlus,
  Gift,
  QrCode,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Lock,
  Globe,
  Palette,
  ChevronRight,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SectionContainer } from "@/components/foundation/layout/SectionContainer";
import { FoundationCard } from "@/components/foundation/cards/Card";

// ─── Brand tokens ───────────────────────────────────────────────
const B = {
  dark: "#2A3E4B",
  mid: "#7FA6B8",
  light: "#D6E6EF",
  bg: "#F7FBFD",
  accent: "#FF6B1A",
};

// ─── Step data — extend to add more steps ───────────────────────
type Step = {
  number: number;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  duration: string;
  preview: React.ReactNode;
};

// ─── Step preview panels ────────────────────────────────────────

function SignupPreview() {
  return (
    <div className="flex flex-col gap-3">
      {/* Mock signup form */}
      <div className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-7 h-7 rounded-lg grid place-items-center text-white text-[10px] font-black"
            style={{ background: `linear-gradient(135deg, ${B.dark}, ${B.mid})` }}
          >
            M
          </div>
          <span className="text-xs font-bold text-[#2A3E4B]">Mystery Unlock</span>
        </div>
        <p className="text-sm font-bold text-[#2A3E4B] mb-3">Create your account</p>
        <div className="space-y-2.5">
          {["Shop name", "Email address", "Password"].map((label) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-[#4a5b78] mb-1">{label}</p>
              <div className="h-8 rounded-lg border border-[#2A3E4B]/12 bg-[#F7FBFD] px-3 flex items-center">
                <div className="h-2 rounded-full bg-[#D6E6EF]" style={{ width: label === "Shop name" ? "60%" : label === "Email address" ? "75%" : "45%" }} />
              </div>
            </div>
          ))}
        </div>
        <div
          className="mt-4 w-full py-2.5 rounded-xl text-white text-xs font-bold text-center"
          style={{ background: `linear-gradient(135deg, ${B.dark}, ${B.mid})` }}
        >
          Start Free — No card needed
        </div>
      </div>
      <div className="flex items-center gap-2 px-1">
        <Lock className="size-3 text-emerald-500" />
        <span className="text-[10px] text-[#4a5b78]">Secure signup · no credit card required</span>
      </div>
    </div>
  );
}

function BuildPreview() {
  const prizes = [
    { name: "Rs.500 Cash", color: "bg-amber-100 text-amber-700", weight: 10 },
    { name: "Free Coffee", color: "bg-emerald-100 text-emerald-700", weight: 30 },
    { name: "10% Off", color: "bg-blue-100 text-blue-700", weight: 35 },
    { name: "Try Again", color: "bg-slate-100 text-slate-600", weight: 25 },
  ];

  return (
    <div className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2A3E4B]/6 flex items-center gap-2">
        <Gift className="size-3.5 text-[#FF6B1A]" />
        <span className="text-xs font-bold text-[#2A3E4B]">Campaign Builder</span>
        <span className="ml-auto text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
          Live Preview
        </span>
      </div>
      {/* Campaign name */}
      <div className="px-4 py-3 border-b border-[#2A3E4B]/6">
        <p className="text-[10px] text-[#4a5b78] mb-1">Campaign name</p>
        <p className="text-sm font-bold text-[#2A3E4B]">Summer Spin Bonanza ✨</p>
      </div>
      {/* Prizes */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-[10px] font-semibold text-[#4a5b78] uppercase tracking-wide">Prizes & Odds</p>
        {prizes.map((p) => (
          <div key={p.name} className="flex items-center gap-2.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${p.color}`}>
              {p.name}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-[#D6E6EF] overflow-hidden">
              <div className="h-full rounded-full bg-[#2A3E4B]/30" style={{ width: `${p.weight * 2}%` }} />
            </div>
            <span className="text-[10px] font-semibold text-[#4a5b78] w-7 text-right">{p.weight}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrandPreview() {
  return (
    <div className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2A3E4B]/6 flex items-center gap-2">
        <Palette className="size-3.5 text-[#FF6B1A]" />
        <span className="text-xs font-bold text-[#2A3E4B]">Brand Settings</span>
      </div>
      <div className="p-4 space-y-3">
        {/* Slug */}
        <div>
          <p className="text-[10px] text-[#4a5b78] mb-1">Your spin page URL</p>
          <div className="rounded-lg border border-[#2A3E4B]/12 px-3 py-2 flex items-center gap-1.5 bg-[#F7FBFD]">
            <Globe className="size-3 text-[#4a5b78]" />
            <span className="text-[11px] text-[#4a5b78]">mysteryunlock.com/</span>
            <span className="text-[11px] font-bold text-[#2A3E4B]">anishas-boutique</span>
          </div>
        </div>
        {/* Colors */}
        <div>
          <p className="text-[10px] text-[#4a5b78] mb-1.5">Brand colours</p>
          <div className="flex gap-2">
            {[B.dark, B.accent, B.mid, "#10b981"].map((c) => (
              <div key={c} className="w-8 h-8 rounded-lg border-2 border-white shadow-sm" style={{ background: c }} />
            ))}
            <div className="w-8 h-8 rounded-lg border-2 border-dashed border-[#2A3E4B]/20 grid place-items-center">
              <span className="text-[14px] text-[#4a5b78]">+</span>
            </div>
          </div>
        </div>
        {/* Logo upload */}
        <div className="rounded-lg border border-dashed border-[#2A3E4B]/20 p-3 text-center">
          <p className="text-[10px] font-semibold text-[#4a5b78]">Upload logo</p>
          <p className="text-[9px] text-[#4a5b78]/60">PNG, SVG · Max 2MB</p>
        </div>
      </div>
    </div>
  );
}

function QrPreview() {
  // Simple SVG QR-code approximation — deterministic so it's stable across renders and SSR
  const grid = useMemo(() =>
    Array.from({ length: 7 }, (_, r) =>
      Array.from({ length: 7 }, (_, c) => {
        // Corner finders
        if ((r < 2 && c < 2) || (r < 2 && c > 4) || (r > 4 && c < 2)) return true;
        // Deterministic fill based on position (no Math.random)
        return ((r * 7 + c) * 2654435761) % 97 > 43;
      })
    )
  , []);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm p-4 flex flex-col items-center gap-4">
        {/* QR mock */}
        <div className="p-3 rounded-xl bg-white border-2 border-[#2A3E4B]/10 shadow-sm">
          <svg width="80" height="80" viewBox="0 0 70 70" aria-label="QR code preview">
            {grid.map((row, r) =>
              row.map((filled, c) =>
                filled ? (
                  <rect
                    key={`${r}-${c}`}
                    x={c * 10}
                    y={r * 10}
                    width={9}
                    height={9}
                    rx={1.5}
                    fill={B.dark}
                  />
                ) : null
              )
            )}
          </svg>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-[#2A3E4B]">Your campaign is live</p>
          <p className="text-[10px] text-[#4a5b78] mt-0.5">Print · Display · Share on WhatsApp</p>
        </div>
        <div className="flex gap-2 w-full">
          {["Print PDF", "Download PNG", "Share Link"].map((action) => (
            <div
              key={action}
              className="flex-1 text-center text-[9px] font-bold py-1.5 rounded-lg"
              style={{ background: `${B.light}80`, color: B.dark }}
            >
              {action}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardMiniPreview() {
  const metrics = [
    { label: "Spins Today", value: "142", color: "text-[#FF6B1A]" },
    { label: "New Winners", value: "38", color: "text-emerald-600" },
    { label: "Revenue ↑", value: "+24%", color: "text-blue-600" },
  ];

  return (
    <div className="rounded-xl bg-white border border-[#2A3E4B]/8 shadow-sm overflow-hidden">
      {/* Mini browser bar */}
      <div className="px-3 py-2 bg-[#F0F4F8] border-b border-[#2A3E4B]/8 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
        <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
        <div className="w-2 h-2 rounded-full bg-[#28c840]" />
        <div className="flex-1 mx-2 bg-white rounded px-2 py-0.5 text-[9px] text-[#4a5b78]">
          app.mysteryunlock.com/dashboard
        </div>
      </div>
      <div className="p-3 space-y-2.5">
        {/* Stat pills */}
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-lg bg-[#F7FBFD] border border-[#2A3E4B]/6 p-2 text-center">
              <p className={`font-display text-base font-black ${m.color}`}>{m.value}</p>
              <p className="text-[9px] text-[#4a5b78] mt-0.5 leading-tight">{m.label}</p>
            </div>
          ))}
        </div>
        {/* Mini chart bars */}
        <div className="flex items-end gap-1 h-10 px-1">
          {[40, 60, 45, 80, 65, 90, 75].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t"
              style={{
                height: `${h}%`,
                background: i === 5
                  ? `linear-gradient(180deg, ${B.accent}, ${B.dark})`
                  : `${B.light}`,
              }}
            />
          ))}
        </div>
        {/* Recent winner row */}
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5">
          <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
          <span className="text-[10px] font-semibold text-emerald-700">Priya Karki just won Free Coffee!</span>
        </div>
      </div>
    </div>
  );
}

// ─── Step definitions ───────────────────────────────────────────
const STEPS: Step[] = [
  {
    number: 1,
    icon: <UserPlus className="size-5" />,
    title: "Create your account",
    subtitle: "No credit card, no setup fee",
    duration: "30 sec",
    preview: <SignupPreview />,
  },
  {
    number: 2,
    icon: <Gift className="size-5" />,
    title: "Build your campaign",
    subtitle: "Name it, set prizes, adjust the odds",
    duration: "45 sec",
    preview: <BuildPreview />,
  },
  {
    number: 3,
    icon: <Palette className="size-5" />,
    title: "Add your branding",
    subtitle: "Upload logo, pick colors, set your slug",
    duration: "20 sec",
    preview: <BrandPreview />,
  },
  {
    number: 4,
    icon: <QrCode className="size-5" />,
    title: "Share your QR code",
    subtitle: "Print, display, or share on WhatsApp",
    duration: "10 sec",
    preview: <QrPreview />,
  },
  {
    number: 5,
    icon: <BarChart3 className="size-5" />,
    title: "Watch results roll in",
    subtitle: "Real-time dashboard, every spin tracked",
    duration: "Ongoing",
    preview: <DashboardMiniPreview />,
  },
];

// ─── Step selector tab ──────────────────────────────────────────
function StepTab({
  step,
  isActive,
  isDone,
  onClick,
}: {
  step: Step;
  isActive: boolean;
  isDone: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls="step-panel"
      id={`step-tab-${step.number}`}
      onClick={onClick}
      className={`group w-full flex items-start gap-3 p-3.5 rounded-xl text-left transition-all duration-200 ${
        isActive
          ? "bg-white shadow-md border border-[#2A3E4B]/8"
          : "hover:bg-white/60"
      }`}
    >
      {/* Number badge */}
      <div
        className={`w-8 h-8 rounded-full grid place-items-center shrink-0 text-xs font-black transition-all ${
          isDone
            ? "bg-emerald-500 text-white"
            : isActive
            ? "text-white"
            : "bg-[#D6E6EF] text-[#2A3E4B]"
        }`}
        style={isActive && !isDone ? { background: `linear-gradient(135deg, ${B.dark}, ${B.mid})` } : {}}
      >
        {isDone ? <CheckCircle2 className="size-4" /> : step.number}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-sm font-bold leading-tight ${
              isActive ? "text-[#2A3E4B]" : "text-[#4a5b78] group-hover:text-[#2A3E4B]"
            }`}
          >
            {step.title}
          </p>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
              isActive
                ? "bg-[#FF6B1A]/15 text-[#FF6B1A]"
                : "bg-[#D6E6EF]/80 text-[#4a5b78]"
            }`}
          >
            {step.duration}
          </span>
        </div>
        <p className={`text-[11px] mt-0.5 ${isActive ? "text-[#4a5b78]" : "text-[#4a5b78]/70"}`}>
          {step.subtitle}
        </p>
      </div>

      {isActive && <ChevronRight className="size-4 text-[#FF6B1A] shrink-0 self-center" />}
    </button>
  );
}

// ─── CMS settings shape ─────────────────────────────────────────
export interface HowToLaunchSettings {
  heading?: string;
  subtitle?: string;
  steps?: { title: string; subtitle: string }[];
}

// ─── Main export ────────────────────────────────────────────────
export const HowToLaunch = memo(function HowToLaunch({ settings }: { settings?: HowToLaunchSettings }) {
  const resolvedSteps = STEPS.map((step, i) => ({
    ...step,
    title: settings?.steps?.[i]?.title ?? step.title,
    subtitle: settings?.steps?.[i]?.subtitle ?? step.subtitle,
  }));

  const [activeStep, setActiveStep] = useState(0);
  const step = resolvedSteps[activeStep];

  // Total time label — STEPS is module-scope, so [] deps is correct
  const totalSeconds = useMemo(
    () =>
      STEPS.slice(0, -1).reduce((acc, s) => {
        const n = parseInt(s.duration);
        return acc + (isNaN(n) ? 0 : n);
      }, 0),
    [],
  );

  return (
    <SectionContainer
      as="section"
      id="how-to-launch"
      maxWidth="xl"
      spacing="none"
      className="py-20 lg:py-28"
      aria-labelledby="how-to-launch-heading"
    >
      {/* Section header */}
      <div className="max-w-2xl mx-auto text-center mb-14">
        <span
          className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full mb-4"
          style={{ background: B.light, color: B.dark }}
        >
          Setup
        </span>
        <h2
          id="how-to-launch-heading"
          className="font-display text-3xl md:text-4xl font-bold leading-tight"
          style={{ color: B.dark }}
        >
          {settings?.heading ?? "Up and running in under 2 minutes."}
        </h2>
        <p className="mt-4 text-base md:text-lg" style={{ color: `${B.dark}cc` }}>
          {settings?.subtitle ?? "No developer. No agency. No waiting. Five steps and your first campaign is live."}
        </p>

        {/* Total time badge */}
        <div className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full border"
          style={{ borderColor: `${B.accent}40`, background: `${B.accent}10` }}
        >
          <Zap className="size-3.5" style={{ color: B.accent }} />
          <span className="text-sm font-semibold" style={{ color: B.dark }}>
            Total setup time: ~{Math.ceil(totalSeconds / 60)} minute{Math.ceil(totalSeconds / 60) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Main interactive layout */}
      <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* Left: step list */}
        <div
          className="rounded-2xl p-3 flex flex-col gap-1"
          style={{ background: `${B.light}40` }}
          role="tablist"
          aria-label="Setup steps"
          aria-orientation="vertical"
        >
          {resolvedSteps.map((s, i) => (
            <StepTab
              key={s.number}
              step={s}
              isActive={activeStep === i}
              isDone={i < activeStep}
              onClick={() => setActiveStep(i)}
            />
          ))}
        </div>

        {/* Right: preview panel */}
        <div
          role="tabpanel"
          id="step-panel"
          aria-labelledby={`step-tab-${step.number}`}
        >
          <FoundationCard elevation="md" padding="none" className="overflow-hidden h-full">
            {/* Panel header */}
            <div
              className="px-6 py-5 border-b border-[#2A3E4B]/6 flex items-center gap-4"
              style={{ background: `${B.bg}` }}
            >
              <div
                className="w-10 h-10 rounded-xl grid place-items-center text-white shrink-0"
                style={{ background: `linear-gradient(135deg, ${B.dark}, ${B.mid})` }}
              >
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[#4a5b78]">Step {step.number} of {STEPS.length}</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${B.accent}15`, color: B.accent }}
                  >
                    {step.duration}
                  </span>
                </div>
                <p className="font-bold text-base mt-0.5" style={{ color: B.dark }}>
                  {step.title}
                </p>
                <p className="text-xs" style={{ color: `${B.dark}80` }}>{step.subtitle}</p>
              </div>
              <Sparkles className="size-4 shrink-0" style={{ color: B.accent }} />
            </div>

            {/* Preview content */}
            <div className="p-6">
              <div key={activeStep} className="animate-fade-in">
                {step.preview}
              </div>
            </div>

            {/* Step navigation footer */}
            <div
              className="px-4 sm:px-6 py-3 border-t border-[#2A3E4B]/6 flex items-center justify-between gap-2 flex-wrap"
              style={{ background: `${B.bg}` }}
            >
              <button
                type="button"
                disabled={activeStep === 0}
                onClick={() => setActiveStep((v) => Math.max(0, v - 1))}
                className="text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-1.5"
                style={{ color: B.dark, background: `${B.light}` }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6"/></svg>
                Previous
              </button>

              {/* Dot progress */}
              <div className="flex items-center" role="group" aria-label="Step navigation">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveStep(i)}
                    className="flex items-center justify-center w-9 h-9"
                    aria-label={`Go to step ${i + 1}`}
                  >
                    <span
                      className="transition-all rounded-full block"
                      style={{
                        width: i === activeStep ? 20 : 6,
                        height: 6,
                        background: i < activeStep
                          ? "#10b981"
                          : i === activeStep
                          ? B.accent
                          : `${B.light}`,
                      }}
                    />
                  </button>
                ))}
              </div>

              {activeStep < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep((v) => Math.min(STEPS.length - 1, v + 1))}
                  className="text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 text-white min-h-[44px]"
                  style={{ background: B.dark }}
                >
                  Next step <ArrowRight className="size-3" />
                </button>
              ) : (
                <Link
                  to="/auth"
                  className="text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5 text-white transition-all hover:opacity-90 min-h-[44px]"
                  style={{ background: B.accent }}
                >
                  Start free <ArrowRight className="size-3" />
                </Link>
              )}
            </div>
          </FoundationCard>
        </div>
      </div>
    </SectionContainer>
  );
});

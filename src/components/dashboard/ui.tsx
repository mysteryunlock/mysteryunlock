import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, ChevronLeft, CircleDot } from "lucide-react";
import { Btn } from "@/components/ds";

// ──────────────────────────────────────────────
// DashCard — standard white card wrapper
// ──────────────────────────────────────────────
export function DashCard({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const base =
    "rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)]";
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${base} text-left w-full hover:border-[#FF6B1A]/40 hover:shadow-[0_8px_24px_-8px_rgba(255,107,26,0.2)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 ${className}`}
      >
        {children}
      </button>
    );
  }
  return <div className={`${base} ${className}`}>{children}</div>;
}

// ──────────────────────────────────────────────
// KpiCard — metric card with optional trend delta
// ──────────────────────────────────────────────
export function KpiCard({
  label,
  value,
  icon: Icon,
  accentClass,
  delta,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accentClass: string;
  delta?: number;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className={`w-9 h-9 rounded-xl grid place-items-center ${accentClass}`}>
        <Icon className="w-4 h-4" strokeWidth={2.2} />
      </div>
      <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] mt-3 font-semibold leading-tight">
        {label}
      </p>
      <div className="flex items-end justify-between gap-1 mt-0.5">
        <p className="text-2xl font-black text-[#0c2340] leading-none">{value}</p>
        {delta !== undefined && (
          <span
            className={`mb-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
              delta > 0
                ? "bg-emerald-50 text-emerald-700"
                : delta < 0
                  ? "bg-red-50 text-red-600"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "—"}
            {delta !== 0 ? `${Math.abs(delta)}%` : ""}
          </span>
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 text-left hover:border-[#FF6B1A]/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 w-full"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4">
      {inner}
    </div>
  );
}

// ──────────────────────────────────────────────
// EmptyState — illustrated placeholder
// ──────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-[#FF6B1A]/8 grid place-items-center mb-4 shrink-0">
        <Icon className="w-7 h-7 text-[#FF6B1A]" strokeWidth={1.5} />
      </div>
      <p className="text-[#0c2340] font-bold">{title}</p>
      <p className="text-sm text-[#4a5b78] mt-1.5 max-w-xs leading-relaxed">{description}</p>
      {action && (
        <Btn variant="primary" size="sm" className="mt-5 rounded-xl" onClick={action.onClick}>
          {action.label}
        </Btn>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Skeleton components
// ──────────────────────────────────────────────
export function SkeletonKpiCard() {
  return (
    <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 animate-pulse">
      <div className="w-9 h-9 rounded-xl bg-[#F0F2F5]" />
      <div className="h-2 w-20 rounded-full bg-[#F0F2F5] mt-4" />
      <div className="h-7 w-14 rounded-lg bg-[#F0F2F5] mt-2" />
    </div>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] animate-pulse ${className}`}
    />
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2.5 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-[#F0F2F5] shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-2.5 w-2/3 rounded-full bg-[#F0F2F5]" />
        <div className="h-2 w-1/2 rounded-full bg-[#F0F2F5]" />
      </div>
      <div className="h-5 w-10 rounded-full bg-[#F0F2F5] shrink-0" />
    </div>
  );
}

// ──────────────────────────────────────────────
// SectionHead — section heading with optional right element
// ──────────────────────────────────────────────
export function SectionHead({
  title,
  right,
  className = "",
}: {
  title: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <h3 className="text-sm font-bold text-[#0c2340]">{title}</h3>
      {right}
    </div>
  );
}

// ══════════════════════════════════════════════
// Merchant Control Center — Reusable Components
// ══════════════════════════════════════════════

// ──────────────────────────────────────────────
// StatusBadge — campaign active / paused indicator
// ──────────────────────────────────────────────
export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
      }`}
    >
      <CircleDot className={`w-3 h-3 ${active ? "text-emerald-500" : "text-amber-500"}`} />
      {active ? "Active" : "Paused"}
    </span>
  );
}

// ──────────────────────────────────────────────
// MerchantStat — compact key-stat for overview card
// ──────────────────────────────────────────────
export function MerchantStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-2xl bg-[#F8FAFC] border border-[#0c2340]/8 p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold text-[#6b7a93]">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <p className="text-2xl font-black text-[#0c2340] leading-none mt-1.5">{value}</p>
    </div>
  );
}

// ──────────────────────────────────────────────
// MerchantHubCard — navigation card for the Control Center
// ──────────────────────────────────────────────
export function MerchantHubCard({
  emoji,
  icon: Icon,
  title,
  description,
  stat,
  onClick,
  comingSoon = false,
  className = "",
}: {
  /** @deprecated Pass `icon` (LucideIcon) instead of emoji string */
  emoji?: string;
  icon?: LucideIcon;
  title: string;
  description: string;
  /** Optional secondary stat line shown below description, e.g. "5 prizes · 120 codes" */
  stat?: string;
  onClick?: () => void;
  comingSoon?: boolean;
  className?: string;
}) {
  const inner = (
    <div className="flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-2xl grid place-items-center shrink-0 transition-colors duration-150 ${
          comingSoon
            ? "bg-[#F5F7FA] text-[#9aa5b5]"
            : "bg-[#F5F7FA] text-[#4a5b78] group-hover:bg-[#FF6B1A]/10 group-hover:text-[#FF6B1A]"
        }`}
      >
        {Icon
          ? <Icon className="w-5 h-5" strokeWidth={1.75} />
          : <span className="text-[22px]" aria-hidden>{emoji}</span>
        }
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3
            className={`text-[15px] font-bold leading-tight ${
              comingSoon ? "text-[#9aa5b5]" : "text-[#0c2340]"
            }`}
          >
            {title}
          </h3>
          {comingSoon && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#0c2340]/8 text-[#6b7a93] uppercase tracking-widest shrink-0">
              Coming Soon
            </span>
          )}
        </div>
        <p
          className={`text-[13px] mt-0.5 leading-snug ${
            comingSoon ? "text-[#b8c2cc]" : "text-[#6b7a93]"
          }`}
        >
          {description}
        </p>
        {stat && !comingSoon && (
          <p className="text-[11px] font-bold text-[#FF6B1A] mt-1 tracking-wide">
            {stat}
          </p>
        )}
      </div>
      <ChevronRight
        className={`w-5 h-5 shrink-0 transition-transform duration-150 ${
          comingSoon
            ? "text-[#dce1e8]"
            : "text-[#4a5b78] group-hover:translate-x-0.5"
        }`}
      />
    </div>
  );

  if (comingSoon) {
    return (
      <div
        className={`w-full rounded-[20px] bg-white border border-[#0c2340]/5 p-4 cursor-not-allowed select-none ${className}`}
        aria-disabled="true"
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative group w-full text-left rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_2px_12px_-4px_rgba(12,35,64,0.07)] p-4 hover:border-[#FF6B1A]/35 hover:shadow-[0_6px_20px_-6px_rgba(255,107,26,0.18)] hover:-translate-y-0.5 active:translate-y-0 hover:scale-[1.005] active:scale-[0.997] transition-all duration-150 min-h-[72px] overflow-hidden ${className}`}
    >
      <span
        aria-hidden
        className="absolute left-0 inset-y-3 w-[3px] rounded-full bg-[#FF6B1A] opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      />
      {inner}
    </button>
  );
}

// ──────────────────────────────────────────────
// HubSectionHeader — breadcrumb back-nav for sub-sections
// ──────────────────────────────────────────────
export function HubSectionHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0c2340] min-h-[44px] px-3 py-2 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5] transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Hub
      </button>
      <ChevronRight className="w-3.5 h-3.5 text-[#c4ccd9]" aria-hidden />
      <h2 className="text-[17px] font-black text-[#0c2340] truncate">{title}</h2>
    </div>
  );
}

// ──────────────────────────────────────────────
// HubOverviewSkeleton — shimmer skeleton for hub overview loading state
// ──────────────────────────────────────────────
function ShimmerBar({ className }: { className: string }) {
  return (
    <div className={`relative overflow-hidden bg-[#EEF1F6] rounded-full ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-skeleton-shimmer" />
    </div>
  );
}

export function HubOverviewSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* Overview card skeleton */}
      <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2.5 flex-1">
            <ShimmerBar className="h-2.5 w-16" />
            <ShimmerBar className="h-6 w-44" />
            <div className="flex gap-2 mt-1">
              <ShimmerBar className="h-6 w-16 rounded-full" />
              <ShimmerBar className="h-6 w-14 rounded-full" />
            </div>
            <ShimmerBar className="h-3 w-32" />
          </div>
          <ShimmerBar className="h-9 w-20 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#0c2340]/8 p-3.5 space-y-2">
            <ShimmerBar className="h-2 w-20" />
            <ShimmerBar className="h-7 w-8" />
          </div>
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#0c2340]/8 p-3.5 space-y-2">
            <ShimmerBar className="h-2 w-16" />
            <ShimmerBar className="h-7 w-6" />
          </div>
        </div>
      </div>
      {/* Card skeletons */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_2px_12px_-4px_rgba(12,35,64,0.07)] p-4"
        >
          <div className="flex items-center gap-4">
            <ShimmerBar className="w-12 h-12 rounded-2xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <ShimmerBar className="h-3.5 w-28" />
              <ShimmerBar className="h-2.5 w-44" />
            </div>
            <ShimmerBar className="w-5 h-5 rounded-full flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

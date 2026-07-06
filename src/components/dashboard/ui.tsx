import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

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
        className={`${base} text-left w-full hover:border-[#FF6B00]/40 hover:shadow-[0_8px_24px_-8px_rgba(255,107,0,0.2)] transition-all ${className}`}
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
        className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 text-left hover:border-[#FF6B00]/40 transition-all w-full"
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
      <div className="w-16 h-16 rounded-2xl bg-[#FF6B00]/8 grid place-items-center mb-4 shrink-0">
        <Icon className="w-7 h-7 text-[#FF6B00]" strokeWidth={1.5} />
      </div>
      <p className="text-[#0c2340] font-bold">{title}</p>
      <p className="text-sm text-[#4a5b78] mt-1.5 max-w-xs leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-5 py-2.5 rounded-xl bg-[#FF6B00] text-white text-sm font-bold shadow-sm hover:bg-[#e85f00] transition-colors"
        >
          {action.label}
        </button>
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

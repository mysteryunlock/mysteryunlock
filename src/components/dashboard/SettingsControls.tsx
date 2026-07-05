import { type ReactNode } from "react";
import { Settings as SettingsIcon, ChevronRight } from "lucide-react";

export function SettingsSection({ icon: Icon, title, subtitle, accent = "#FF6B00", children }: { icon: typeof SettingsIcon; title: string; subtitle?: string; accent?: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(12,35,64,0.06)] border border-[#0c2340]/5 overflow-hidden">
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accent}14`, color: accent }}>
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-[#0c2340] leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-[#6b7a93] mt-0.5">{subtitle}</p>}
        </div>
      </header>
      <div className="px-5 pb-5 space-y-3">{children}</div>
    </section>
  );
}

export function SettingsRow({ icon: Icon, label, hint, right, onClick, danger }: { icon: typeof SettingsIcon; label: string; hint?: string; right?: ReactNode; onClick?: () => void; danger?: boolean }) {
  const Cmp = onClick ? "button" : "div";
  return (
    <Cmp
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${onClick ? "hover:bg-[#F5F7FA] active:bg-[#ECEFF5]" : ""} ${danger ? "text-[#b3261e]" : "text-[#0c2340]"}`}
    >
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${danger ? "bg-[#fde8e6]" : "bg-[#F5F7FA]"}`}>
        <Icon className={`w-4 h-4 ${danger ? "text-[#b3261e]" : "text-[#4a5b78]"}`} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        {hint && <p className="text-[11px] text-[#6b7a93] mt-0.5 truncate">{hint}</p>}
      </div>
      {right ?? (onClick && <ChevronRight className="w-4 h-4 text-[#6b7a93]" />)}
    </Cmp>
  );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`relative w-11 h-6 rounded-full transition ${checked ? "bg-[#FF6B00]" : "bg-[#d6dbe5]"}`}
      aria-pressed={checked}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

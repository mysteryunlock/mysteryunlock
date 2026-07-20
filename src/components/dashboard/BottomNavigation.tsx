import {
  LayoutDashboard, Megaphone, Users, BarChart3, Settings,
} from "lucide-react";
import type { TabKey } from "./types";

// ── Exactly 5 primary slots ───────────────────────────────────────────────────

const PRIMARY = [
  { key: "overview"  as TabKey, label: "Dashboard", icon: LayoutDashboard },
  { key: "campaign"  as TabKey, label: "Campaigns", icon: Megaphone       },
  { key: "customers" as TabKey, label: "Customers", icon: Users           },
  { key: "analytics" as TabKey, label: "Analytics", icon: BarChart3       },
  { key: "settings"  as TabKey, label: "Settings",  icon: Settings        },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function BottomNavigation({
  tab,
  onSelect,
}: {
  tab: TabKey;
  onSelect: (t: TabKey) => void;
}) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#0C2340]/8 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="grid grid-cols-5">
        {PRIMARY.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px]"
              aria-current={active ? "page" : undefined}
              aria-label={label}
            >
              <div
                className={`w-12 h-7 rounded-full grid place-items-center transition-all duration-200 ${
                  active ? "bg-[#FF6B1A]/12" : ""
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-colors duration-200 ${
                    active ? "text-[#FF6B1A]" : "text-[#4a5b78]"
                  }`}
                  strokeWidth={active ? 2.25 : 1.75}
                />
              </div>
              <span
                className={`text-[10px] leading-none transition-colors duration-200 ${
                  active ? "text-[#FF6B1A] font-bold" : "text-[#4a5b78] font-medium"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

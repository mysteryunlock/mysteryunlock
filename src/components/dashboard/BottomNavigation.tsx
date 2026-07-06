import {
  LayoutDashboard, Megaphone, Users, BarChart3, Settings as SettingsIcon,
} from "lucide-react";
import type { TabKey } from "./types";

const navItems: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard },
  { key: "campaign", label: "Campaign", icon: Megaphone },
  { key: "customers", label: "Customers", icon: Users },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

export function BottomNavigation({ tab, onSelect }: { tab: TabKey; onSelect: (t: TabKey) => void }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-[#0c2340]/8 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-5xl mx-auto grid grid-cols-5">
        {navItems.map(({ key, label, icon: Icon }) => {
          const active =
            tab === key ||
            (key === "overview" && (tab === "codes" || tab === "qr" || tab === "messages"));
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className="flex flex-col items-center justify-center gap-1 py-2 transition-colors"
              aria-current={active ? "page" : undefined}
            >
              {/* Pill indicator wraps the icon */}
              <div
                className={`w-12 h-7 rounded-full grid place-items-center transition-all duration-200 ${
                  active ? "bg-[#FF6B00]/12" : "bg-transparent"
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-all duration-200 ${
                    active ? "text-[#FF6B00] stroke-[2.4]" : "text-[#4a5b78]"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] transition-all duration-200 ${
                  active ? "text-[#FF6B00] font-bold" : "text-[#4a5b78] font-semibold"
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

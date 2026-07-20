import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  BarChart3,
  Settings,
  QrCode,
  Hash,
  MessageSquare,
  Trophy,
  LogOut,
  Shield,
  CreditCard,
} from "lucide-react";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { greeting } from "./utils";
import type { Shop, TabKey } from "./types";

// ── Navigation config ─────────────────────────────────────────────────────────

type NavItem =
  | { kind: "tab"; key: TabKey; label: string; icon: typeof LayoutDashboard }
  | { kind: "link"; href: string; label: string; icon: typeof LayoutDashboard };

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { kind: "tab", key: "overview", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Campaigns",
    items: [
      { kind: "tab", key: "campaign",  label: "Campaigns",    icon: Megaphone    },
      { kind: "tab", key: "codes",     label: "Access Codes", icon: Hash         },
      { kind: "tab", key: "qr",        label: "QR Codes",     icon: QrCode       },
    ],
  },
  {
    label: "Customers",
    items: [
      { kind: "tab", key: "customers", label: "Customers",    icon: Users  },
      { kind: "tab", key: "claims",    label: "Prize Claims", icon: Trophy },
    ],
  },
  {
    label: "Analytics",
    items: [
      { kind: "tab", key: "analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Marketing",
    items: [
      { kind: "tab", key: "messages", label: "Marketing", icon: MessageSquare },
    ],
  },
  {
    label: "Business",
    items: [
      { kind: "tab",  key: "settings",      label: "Shop Settings", icon: Settings   },
      { kind: "link", href: "/billing",      label: "Subscription",  icon: CreditCard },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  shop: Shop;
  ownerName: string;
  superAdmin: boolean;
  tab: TabKey;
  onSelect: (t: TabKey) => void;
  onSignOut: () => void;
}

export function LeftSidebar({ shop, ownerName, superAdmin, tab, onSelect, onSignOut }: Props) {
  return (
    <aside
      className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-[260px] bg-white border-r border-[#0C2340]/8 z-30 overflow-y-auto"
      aria-label="Main navigation"
    >
      {/* ── Shop identity ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 border-b border-[#0C2340]/8 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src={shop.logo_url || DEFAULT_LOGO}
            alt={shop.name}
            className="w-10 h-10 rounded-xl object-cover border border-[#0C2340]/10 shadow-sm shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-[#9aa5b5] font-semibold leading-none mb-1 truncate">
              {greeting()}{ownerName ? `, ${ownerName.split(" ")[0]}` : ""}
            </p>
            <p className="text-[14px] font-display font-black text-[#0C2340] truncate leading-tight">
              {shop.name}
            </p>
          </div>
        </div>
        <span
          className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
            shop.is_active
              ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
              : "bg-amber-50 text-amber-700 border-amber-200/60"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              shop.is_active ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          {shop.is_active ? "Campaign Active" : "Paused"}
        </span>
      </div>

      {/* ── Navigation sections ───────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-4">
        {NAV.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#9aa5b5] px-3 mb-1">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.kind === "tab" && tab === item.key;
                const Icon = item.icon;
                const cls = `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 min-h-[44px] text-left ${
                  active
                    ? "bg-[#FF6B1A]/10 text-[#FF6B1A]"
                    : "text-[#4a5b78] hover:bg-[#0C2340]/5 hover:text-[#0C2340]"
                }`;

                if (item.kind === "link") {
                  return (
                    <li key={item.href}>
                      <Link to={item.href as any} className={cls}>
                        <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                        {item.label}
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={item.key}>
                    <button
                      onClick={() => onSelect(item.key)}
                      aria-current={active ? "page" : undefined}
                      className={cls}
                    >
                      <Icon
                        className="w-[18px] h-[18px] shrink-0"
                        strokeWidth={active ? 2.25 : 1.75}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B1A] shrink-0" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="px-3 pb-5 pt-3 border-t border-[#0C2340]/8 space-y-0.5 shrink-0">
        {superAdmin && (
          <Link
            to="/super-admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-[#4a5b78] hover:bg-[#0C2340]/5 hover:text-[#0C2340] transition-colors min-h-[44px]"
          >
            <Shield className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            Super Admin
          </Link>
        )}
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-[#4a5b78] hover:bg-red-50 hover:text-red-600 transition-colors min-h-[44px]"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard, Megaphone, Users, BarChart3,
  MoreHorizontal, Hash, QrCode, Trophy, MessageSquare,
  Settings, CreditCard, LogOut, Shield, X,
} from "lucide-react";
import type { TabKey } from "./types";

// ── 4 primary visible slots ───────────────────────────────────────────────────

const PRIMARY = [
  { key: "overview"  as TabKey, label: "Dashboard", icon: LayoutDashboard },
  { key: "campaign"  as TabKey, label: "Campaigns", icon: Megaphone       },
  { key: "customers" as TabKey, label: "Customers", icon: Users           },
  { key: "analytics" as TabKey, label: "Analytics", icon: BarChart3       },
] as const;

// ── Secondary items in the More drawer (Settings is prominent/first) ──────────

const MORE_TABS: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "settings", label: "Settings",      icon: Settings      },
  { key: "codes",    label: "Access Codes",  icon: Hash          },
  { key: "qr",       label: "QR Codes",      icon: QrCode        },
  { key: "claims",   label: "Prize Claims",  icon: Trophy        },
  { key: "messages", label: "Marketing",     icon: MessageSquare },
];

const MORE_KEYS: TabKey[] = MORE_TABS.map((m) => m.key);

// ── Component ─────────────────────────────────────────────────────────────────

export function BottomNavigation({
  tab,
  onSelect,
  onSignOut,
  superAdmin,
}: {
  tab: TabKey;
  onSelect: (t: TabKey) => void;
  onSignOut?: () => void;
  superAdmin?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_KEYS.includes(tab);

  const pick = (key: TabKey) => { onSelect(key); setMoreOpen(false); };

  return (
    <>
      {/* ── More drawer ───────────────────────────────────────────────────── */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-[0_-8px_40px_-8px_rgba(12,35,64,0.20)] pb-[env(safe-area-inset-bottom)]">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#0C2340]/15" aria-hidden />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9aa5b5]">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F5F7FA] grid place-items-center text-[#4a5b78] hover:bg-[#ECEFF5] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
            {/* Tab items */}
            <ul className="px-4 pb-1 space-y-0.5">
              {MORE_TABS.map(({ key, label, icon: Icon }) => {
                const active = tab === key;
                return (
                  <li key={key}>
                    <button
                      onClick={() => pick(key)}
                      aria-current={active ? "page" : undefined}
                      className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] font-semibold transition-colors min-h-[52px] ${
                        active
                          ? "bg-[#FF6B1A]/10 text-[#FF6B1A]"
                          : "text-[#0C2340] hover:bg-[#F5F7FA]"
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
            {/* Divider */}
            <div className="mx-4 my-2 h-px bg-[#0C2340]/8" />
            {/* Extra links + sign out */}
            <ul className="px-4 pb-4 space-y-0.5">
              <li>
                <Link
                  to="/billing"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] font-semibold text-[#0C2340] hover:bg-[#F5F7FA] transition-colors min-h-[52px]"
                >
                  <CreditCard className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                  Subscription
                </Link>
              </li>
              {superAdmin && (
                <li>
                  <Link
                    to="/super-admin"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] font-semibold text-[#0C2340] hover:bg-[#F5F7FA] transition-colors min-h-[52px]"
                  >
                    <Shield className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                    Super Admin
                  </Link>
                </li>
              )}
              {onSignOut && (
                <li>
                  <button
                    onClick={() => { setMoreOpen(false); onSignOut(); }}
                    className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] font-semibold text-red-600 hover:bg-red-50 transition-colors min-h-[52px]"
                  >
                    <LogOut className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                    Sign Out
                  </button>
                </li>
              )}
            </ul>
          </div>
        </>
      )}

      {/* ── Bottom bar — exactly 5 slots: 4 primary + More ───────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#0C2340]/8 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 pb-[env(safe-area-inset-bottom)]"
        aria-label="Main navigation"
      >
        <div className="grid grid-cols-5">
          {/* 4 primary items */}
          {PRIMARY.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => { setMoreOpen(false); onSelect(key); }}
                className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px]"
                aria-current={active ? "page" : undefined}
                aria-label={label}
              >
                <div className={`w-12 h-7 rounded-full grid place-items-center transition-all duration-200 ${active ? "bg-[#FF6B1A]/12" : ""}`}>
                  <Icon
                    className={`w-5 h-5 transition-colors duration-200 ${active ? "text-[#FF6B1A]" : "text-[#4a5b78]"}`}
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                </div>
                <span className={`text-[10px] leading-none transition-colors duration-200 ${active ? "text-[#FF6B1A] font-bold" : "text-[#4a5b78] font-medium"}`}>
                  {label}
                </span>
              </button>
            );
          })}

          {/* More overflow — 5th slot */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px]"
            aria-label="More options"
            aria-expanded={moreOpen}
          >
            <div className={`w-12 h-7 rounded-full grid place-items-center transition-all duration-200 ${(moreActive || moreOpen) ? "bg-[#FF6B1A]/12" : ""}`}>
              <MoreHorizontal
                className={`w-5 h-5 transition-colors duration-200 ${(moreActive || moreOpen) ? "text-[#FF6B1A]" : "text-[#4a5b78]"}`}
                strokeWidth={(moreActive || moreOpen) ? 2.25 : 1.75}
              />
            </div>
            <span className={`text-[10px] leading-none transition-colors duration-200 ${(moreActive || moreOpen) ? "text-[#FF6B1A] font-bold" : "text-[#4a5b78] font-medium"}`}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

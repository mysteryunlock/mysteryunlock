import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { History, LayoutDashboard, LogOut, Trophy, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Tab = "portal" | "history" | "prizes" | "profile";

type Props = {
  customer: { name: string | null; email: string };
  activeTab: Tab;
  unclaimedCount?: number;
};

export function CustomerPortalHeader({ customer, activeTab, unclaimedCount }: Props) {
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const displayName = customer.name || customer.email.split("@")[0];

  const tabs: { key: Tab; label: string; icon: ReactNode; to: string }[] = [
    { key: "portal",   label: "Home",    icon: <LayoutDashboard className="w-5 h-5" />, to: "/portal" },
    { key: "history",  label: "History", icon: <History className="w-5 h-5" />,         to: "/portal/history" },
    { key: "prizes",   label: "Prizes",  icon: <Trophy className="w-5 h-5" />,          to: "/portal/prizes" },
    { key: "profile",  label: "Profile", icon: <User className="w-5 h-5" />,            to: "/portal/profile" },
  ];

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="max-w-lg mx-auto px-4">
        {/* Top bar */}
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5 truncate">
                {customer.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="relative z-10 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-2 px-3 rounded-lg hover:bg-muted shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        {/* Tab navigation */}
        <nav className="flex border-t border-border" aria-label="Customer portal navigation">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            const showBadge = t.key === "prizes" && unclaimedCount != null && unclaimedCount > 0;
            return (
              <Link
                key={t.key}
                to={t.to}
                className={`relative z-10 flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-[11px] font-semibold tracking-wide transition-colors ${
                  active
                    ? "text-gold border-b-2 border-gold -mb-px"
                    : "text-muted-foreground hover:text-foreground active:bg-muted"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative">
                  {t.icon}
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-gold text-white font-bold text-[9px] rounded-full flex items-center justify-center leading-none shadow-sm">
                      {unclaimedCount! > 9 ? "9+" : unclaimedCount}
                    </span>
                  )}
                </span>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

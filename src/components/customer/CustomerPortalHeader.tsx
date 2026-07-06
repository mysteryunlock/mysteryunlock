import { Link, useNavigate } from "@tanstack/react-router";
import { History, LayoutDashboard, LogOut, Trophy, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Tab = "portal" | "history" | "prizes" | "profile";

type Props = {
  customer: { name: string | null; email: string };
  activeTab: Tab;
};

export function CustomerPortalHeader({ customer, activeTab }: Props) {
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; to: string }[] = [
    { key: "portal",   label: "Home",    icon: <LayoutDashboard className="w-4 h-4" />, to: "/portal" },
    { key: "history",  label: "History", icon: <History className="w-4 h-4" />,         to: "/portal/history" },
    { key: "prizes",   label: "Prizes",  icon: <Trophy className="w-4 h-4" />,          to: "/portal/prizes" },
    { key: "profile",  label: "Profile", icon: <User className="w-4 h-4" />,            to: "/portal/profile" },
  ];

  const displayName = customer.name || customer.email.split("@")[0];

  return (
    <header className="sticky top-0 z-30 bg-[#0F1115]/95 backdrop-blur border-b border-white/8">
      <div className="max-w-lg mx-auto px-4">
        {/* Top bar */}
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-[#0F1115] font-black text-xs">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground leading-none">{displayName}</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{customer.email}</p>
            </div>
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition py-1.5 px-3 rounded-lg hover:bg-white/5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>

        {/* Tab navigation */}
        <nav className="flex border-t border-white/8" aria-label="Customer portal navigation">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            return (
              <Link
                key={t.key}
                to={t.to}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                  active
                    ? "text-[#FF7A00] border-b-2 border-[#FF7A00] -mb-px"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {t.icon}
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

import { Link } from "@tanstack/react-router";
import { Megaphone, Shield, LogOut } from "lucide-react";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { greeting } from "./utils";
import type { Shop } from "./types";

export function DashboardHeader({
  shop,
  ownerName,
  superAdmin,
  onSignOut,
}: {
  shop: Shop;
  ownerName: string;
  superAdmin: boolean;
  onSignOut: () => void;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 mb-4">
      {/* Left — greeting + shop name + status */}
      <div className="min-w-0">
        <p className="text-[13px] text-[#4a5b78] font-medium">
          {greeting()}
          {ownerName ? `, ${ownerName}` : ""}
        </p>
        <h1 className="truncate text-xl sm:text-2xl font-display font-black text-[#0C2340] mt-0.5 leading-tight">
          {shop.name}
        </h1>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              shop.is_active
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                : "bg-amber-50 text-amber-700 border border-amber-200/60"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                shop.is_active ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
              aria-hidden="true"
            />
            {shop.is_active ? "Campaign Active" : "Paused"}
          </span>
        </div>
      </div>

      {/* Right — logo + action buttons */}
      <div className="flex flex-col items-end gap-2">
        <img
          src={shop.logo_url || DEFAULT_LOGO}
          alt={shop.name}
          className="w-11 h-11 rounded-2xl object-cover border border-[#0C2340]/10 shadow-sm"
        />
        <div className="flex gap-1">
          <Link
            to="/campaigns"
            className="w-9 h-9 rounded-xl bg-[#0C2340]/6 hover:bg-[#0C2340]/10 text-[#0C2340] grid place-items-center transition-colors"
            title="Manage campaigns"
            aria-label="Manage campaigns"
          >
            <Megaphone className="w-4 h-4" strokeWidth={1.75} />
          </Link>
          {superAdmin && (
            <Link
              to="/super-admin"
              className="w-9 h-9 rounded-xl bg-[#0C2340]/6 hover:bg-[#0C2340]/10 text-[#0C2340] grid place-items-center transition-colors"
              title="Super admin panel"
              aria-label="Super admin panel"
            >
              <Shield className="w-4 h-4" strokeWidth={1.75} />
            </Link>
          )}
          <button
            onClick={onSignOut}
            className="w-9 h-9 rounded-xl bg-[#0C2340]/6 hover:bg-red-50 hover:text-red-600 text-[#0C2340] grid place-items-center transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}

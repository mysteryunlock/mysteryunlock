import { Link } from "@tanstack/react-router";
import { Megaphone, Shield, LogOut } from "lucide-react";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { greeting } from "./utils";
import type { Shop } from "./types";

export function DashboardHeader({ shop, ownerName, superAdmin, onSignOut }: { shop: Shop; ownerName: string; superAdmin: boolean; onSignOut: () => void }) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 mb-4">
      <div className="min-w-0">
        <p className="text-sm text-[#4a5b78]">
          {greeting()}{ownerName ? `, ${ownerName}` : ""} <span aria-hidden>👋</span>
        </p>
        <h1 className="truncate text-xl sm:text-2xl font-black text-[#0c2340] mt-0.5">{shop.name}</h1>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${shop.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${shop.is_active ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            {shop.is_active ? "Campaign Active" : "Paused"}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <img src={shop.logo_url || DEFAULT_LOGO} alt="" className="w-11 h-11 rounded-2xl object-cover border border-[#0c2340]/10 shadow-sm" />
        <div className="flex gap-1.5">
          <Link to="/campaigns" className="p-2 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5] text-[#0c2340]" title="Manage campaigns">
            <Megaphone className="w-4 h-4" />
          </Link>
          {superAdmin && (
            <Link to="/super-admin" className="p-2 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5] text-[#0c2340]" title="Super admin">
              <Shield className="w-4 h-4" />
            </Link>
          )}
          <button onClick={onSignOut} className="p-2 rounded-xl bg-[#F5F7FA] hover:bg-[#ECEFF5] text-[#0c2340]" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

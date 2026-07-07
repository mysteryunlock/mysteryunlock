import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { Search, Users, X } from "lucide-react";
import { getMyShopConnectInfoFn, getShopCustomersFn } from "@/lib/shop-connections.functions";
import { DashCard, EmptyState, SectionHead, SkeletonBlock, SkeletonRow } from "./ui";
import type { Shop } from "./types";

type Member = {
  customerId: string;
  name: string | null;
  phone: string | null;
  email: string;
  status: string;
  lastVisit: string | null;
  connectedAt: string;
};

function fmtRelative(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function initials(name: string | null, fallback: string): string {
  const s = (name || "").trim();
  if (!s) return fallback.slice(0, 1).toUpperCase();
  const parts = s.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || s[0].toUpperCase();
}

export function ShopConnectionsTab({ shop }: { shop: Shop }) {
  const fetchConnectInfo = useServerFn(getMyShopConnectInfoFn);
  const fetchMembers = useServerFn(getShopCustomersFn);

  const [connectCode, setConnectCode] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState<string | null>(null);

  useEffect(() => {
    fetchConnectInfo({ data: { shopId: shop.id } })
      .then((r) => setConnectCode(r.connectCode))
      .catch(() => {})
      .finally(() => setConnectLoading(false));
  }, [fetchConnectInfo, shop.id]);

  const loadMembers = useCallback(
    async (phoneQuery?: string) => {
      setMembersLoading(true);
      setPhoneErr(null);
      try {
        const res = await fetchMembers({ data: { shopId: shop.id, phone: phoneQuery || undefined } });
        setMembers(res.members as Member[]);
      } catch (err) {
        setPhoneErr(err instanceof Error ? err.message : "Search failed. Try a simpler query.");
      } finally {
        setMembersLoading(false);
      }
    },
    [fetchMembers, shop.id],
  );

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const connectUrl = connectCode ? `${origin}/connect/${connectCode}` : "";

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadMembers(phone.trim() || undefined);
  };

  const clearSearch = () => {
    setPhone("");
    loadMembers();
  };

  return (
    <div className="space-y-5">
      {/* Shop QR + access code */}
      <DashCard className="p-5">
        <SectionHead title="Shop QR & Access Code" />
        <p className="text-sm text-[#4a5b78] mt-1.5">
          Customers scan this to view your shop profile and connect as a member — no purchase or spin required.
        </p>
        {connectLoading ? (
          <SkeletonBlock className="h-48 mt-4" />
        ) : connectCode ? (
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-5">
            <div className="p-4 bg-white rounded-xl border border-[#0c2340]/8 shrink-0">
              <QRCodeSVG value={connectUrl} size={160} level="M" includeMargin={false} />
            </div>
            <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] font-semibold">Access Code</p>
                <p className="text-2xl font-black text-[#0c2340] tracking-widest">{connectCode}</p>
              </div>
              <p className="text-xs text-[#4a5b78] break-all">{connectUrl}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-600 mt-4">Could not load your connect code. Please refresh.</p>
        )}
      </DashCard>

      {/* Connected members */}
      <DashCard className="p-5">
        <SectionHead
          title="Connected Members"
          right={<span className="text-xs font-semibold text-[#4a5b78]">{members.length}</span>}
        />

        <form onSubmit={onSearch} className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a5b78]" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Search by phone number…"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-[#0c2340]/10 text-sm text-[#0c2340] placeholder:text-[#4a5b78]/60 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30"
            />
            {phone && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4a5b78] hover:text-[#0c2340]"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-[#FF6B00] text-white text-sm font-bold shadow-sm hover:bg-[#e85f00] transition-colors shrink-0"
          >
            Search
          </button>
        </form>
        {phoneErr && <p className="text-xs text-red-600 mt-2">{phoneErr}</p>}

        <div className="mt-4 divide-y divide-[#0c2340]/6">
          {membersLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No connected members yet"
              description="Share your shop QR or access code so customers can connect."
            />
          ) : (
            members.map((m) => (
              <div key={m.customerId} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] font-bold text-xs grid place-items-center shrink-0">
                  {initials(m.name, m.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0c2340] truncate">{m.name || m.email}</p>
                  <p className="text-xs text-[#4a5b78] truncate">{m.phone || m.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      m.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {m.status}
                  </span>
                  <p className="text-[11px] text-[#4a5b78] mt-1">{fmtRelative(m.lastVisit)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </DashCard>
    </div>
  );
}

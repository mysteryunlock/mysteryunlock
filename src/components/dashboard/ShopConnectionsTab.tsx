import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Search, Users, X, ExternalLink } from "lucide-react";
import { Btn } from "@/components/ds";
import { getShopCustomersFn } from "@/lib/shop-connections.functions";
import { MemberPurchasesSection } from "./MemberPurchasesSection";
import { DashCard, EmptyState, SectionHead, SkeletonRow } from "./ui";
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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

type SelectedMember = Member & { expanded: boolean };

export function ShopConnectionsTab({ shop }: { shop: Shop }) {
  const fetchMembers = useServerFn(getShopCustomersFn);

  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedMember | null>(null);

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

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-[#0c2340]/8 rounded-[20px] p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] font-semibold">Total Members</p>
          <p className="text-3xl font-black text-[#0c2340] mt-1">
            {membersLoading ? "—" : members.length}
          </p>
        </div>
        <div className="bg-white border border-[#0c2340]/8 rounded-[20px] p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-[#4a5b78] font-semibold">Active</p>
          <p className="text-3xl font-black text-[#FF6B1A] mt-1">
            {membersLoading ? "—" : members.filter((m) => m.status === "active").length}
          </p>
        </div>
      </div>

      {/* ── Search by phone ───────────────────────────────────────────────── */}
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
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-[#0c2340]/10 text-sm text-[#0c2340] placeholder:text-[#4a5b78]/60 focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]/30"
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
          <Btn variant="primary" size="sm" className="rounded-xl shrink-0 py-2.5" type="submit">
            Search
          </Btn>
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
              <div key={m.customerId}>
                <button
                  type="button"
                  onClick={() =>
                    setSelected((prev) =>
                      prev?.customerId === m.customerId
                        ? null
                        : { ...m, expanded: true },
                    )
                  }
                  className="w-full flex items-center gap-3 py-3 text-left hover:bg-[#F5F7FA] -mx-5 px-5 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-[#FF6B1A]/10 text-[#FF6B1A] font-bold text-xs grid place-items-center shrink-0">
                    {initials(m.name, m.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0c2340] truncate">
                      {m.name || m.email}
                    </p>
                    <p className="text-xs text-[#4a5b78] truncate">{m.phone || m.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        m.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {m.status}
                    </span>
                    <p className="text-[11px] text-[#4a5b78] mt-1">{fmtRelative(m.lastVisit)}</p>
                  </div>
                </button>

                {/* Expanded profile */}
                {selected?.customerId === m.customerId && (
                  <div className="mx-0 mb-3 rounded-xl border border-[#0c2340]/10 bg-[#F9FAFB] p-4 space-y-2 text-sm">
                    {m.name && (
                      <div className="flex justify-between">
                        <span className="text-[#4a5b78]">Name</span>
                        <span className="font-semibold text-[#0c2340]">{m.name}</span>
                      </div>
                    )}
                    {m.email && (
                      <div className="flex justify-between gap-4">
                        <span className="text-[#4a5b78] shrink-0">Email</span>
                        <span className="font-semibold text-[#0c2340] truncate">{m.email}</span>
                      </div>
                    )}
                    {m.phone && (
                      <div className="flex justify-between">
                        <span className="text-[#4a5b78]">Phone</span>
                        <span className="font-semibold text-[#0c2340]">{m.phone}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#4a5b78]">Joined</span>
                      <span className="font-semibold text-[#0c2340]">{fmtDate(m.connectedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#4a5b78]">Last visit</span>
                      <span className="font-semibold text-[#0c2340]">{fmtRelative(m.lastVisit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#4a5b78]">Status</span>
                      <span
                        className={`font-bold ${m.status === "active" ? "text-emerald-700" : "text-slate-500"}`}
                      >
                        {m.status}
                      </span>
                    </div>
                    {m.phone && (
                      <div className="pt-1 flex gap-2">
                        <a
                          href={`https://wa.me/${m.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold text-center hover:bg-emerald-600 transition"
                        >
                          WhatsApp
                        </a>
                        <a
                          href={`tel:${m.phone}`}
                          className="flex-1 py-2 rounded-xl bg-[#0c2340] text-white text-xs font-bold text-center hover:bg-[#1a3a5f] transition"
                        >
                          Call
                        </a>
                      </div>
                    )}

                    {/* Purchases section — Phase 5.1 */}
                    <MemberPurchasesSection
                      shopId={shop.id}
                      customerId={m.customerId}
                      memberName={m.name || m.email}
                    />

                    {/* View Full Profile */}
                    <div className="pt-2">
                      <Link
                        to="/customers/$customerId"
                        params={{ customerId: m.customerId }}
                        search={{ shopId: shop.id }}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#0c2340] text-white text-xs font-bold hover:bg-[#1a3a5f] transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Full Profile
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DashCard>

    </div>
  );
}

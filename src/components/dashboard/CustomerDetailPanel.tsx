import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  X, Phone, Mail, Copy, MessageSquare, Zap, Trophy,
  TrendingUp, Calendar, Award, Megaphone, CheckCheck,
} from "lucide-react";
import { getCustomerSpins } from "@/lib/access-codes.functions";
import { KpiCard, SkeletonRow } from "./ui";
import type { CustomerRecord, CustomerSpinRow } from "./types";

// ─── Helpers (local copies — panel is self-contained) ─────────────────────────

function initials(name: string | null, key: string): string {
  const s = (name || "").trim();
  if (!s) return key.slice(0, 1).toUpperCase();
  const parts = s.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || s[0].toUpperCase();
}

function isWin(prize_won: string | null): boolean {
  const p = (prize_won || "").trim().toLowerCase();
  return !!p && p !== "try again" && p !== "tryagain" && p !== "no win";
}

const SEGMENT_META: Record<string, { bg: string; text: string; border: string }> = {
  Winner:       { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
  VIP:          { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200" },
  "Multi-Spin": { bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-200" },
  New:          { bg: "bg-violet-50",   text: "text-violet-700",  border: "border-violet-200" },
  Lapsed:       { bg: "bg-slate-100",   text: "text-slate-600",   border: "border-slate-200" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SpinTimelineItem({ spin }: { spin: CustomerSpinRow }) {
  const won = isWin(spin.prize_won);
  const when = spin.spun_at ? new Date(spin.spun_at) : null;
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-[#0c2340]/10">
      <div className={`h-9 w-9 rounded-full grid place-items-center shrink-0 ${won ? "bg-[#FF6B00]/15 text-[#FF6B00]" : "bg-slate-100 text-slate-400"}`}>
        <Award className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0c2340] truncate">{spin.prize_won || "Try Again"}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          {when && (
            <span className="text-[11px] text-[#0c2340]/60">
              {when.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              {" · "}
              {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {spin.campaign_name && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4a5b78]">
              <Megaphone className="h-3 w-3 shrink-0" />{spin.campaign_name}
            </span>
          )}
          <span className="text-[11px] font-mono text-[#0c2340]/40">{spin.code}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function CustomerDetailPanel({
  customer,
  shopId,
  onClose,
}: {
  customer: CustomerRecord;
  shopId: string;
  onClose: () => void;
}) {
  const fetchSpins = useServerFn(getCustomerSpins);
  const fetchSpinsRef = useRef(fetchSpins);
  fetchSpinsRef.current = fetchSpins;

  const [spins, setSpins] = useState<CustomerSpinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSpins([]);
    (async () => {
      try {
        const r = await fetchSpinsRef.current({ data: { shopId, customerKey: customer.key } });
        if (cancelled) return;
        setSpins(((r as any).spins ?? []) as CustomerSpinRow[]);
      } catch {
        if (!cancelled) setSpins([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shopId, customer.key]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const copyPhone = async () => {
    if (!customer.contact) return;
    try {
      await navigator.clipboard.writeText(customer.contact);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore — clipboard blocked */ }
  };

  const isWinner = customer.totalWins > 0;
  const init = initials(customer.name, customer.key);
  const winRatePct = customer.totalSpins > 0
    ? `${((customer.totalWins / customer.totalSpins) * 100).toFixed(0)}%`
    : "—";
  const daysSince = customer.firstSeen
    ? Math.floor((Date.now() - new Date(customer.firstSeen).getTime()) / 86400000)
    : null;
  const whatsappHref = customer.contact
    ? `https://wa.me/${customer.contact.replace(/\D/g, "")}`
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[48] bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer — bottom sheet on mobile, right panel on ≥lg */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cdp-customer-name"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white rounded-t-[28px] shadow-2xl max-h-[92dvh] lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:w-[480px] lg:rounded-none lg:rounded-l-[28px] lg:max-h-none lg:overflow-y-auto animate-slide-up"
      >

        {/* ── Gradient header ─────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-[#0c2340] to-[#1a3a5f] text-white px-5 pt-5 pb-5 shrink-0 rounded-t-[28px] lg:rounded-t-none lg:rounded-tl-[28px]">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4 pr-10">
            <div className={`w-16 h-16 rounded-full grid place-items-center text-xl font-bold shrink-0 ${isWinner ? "bg-[#FF6B00]" : "bg-white/20"}`}>
              {init}
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="cdp-customer-name" className="text-lg font-bold truncate">{customer.name || "Anonymous"}</h2>
              <p className="text-xs text-white/60 mt-0.5">
                {customer.totalSpins} spin{customer.totalSpins !== 1 ? "s" : ""}{" · "}
                {customer.totalWins} win{customer.totalWins !== 1 ? "s" : ""}
              </p>
              {customer.segments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {customer.segments.map((seg) => (
                    <span
                      key={seg}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/20"
                    >
                      {seg}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-5 space-y-5">

            {/* Quick actions */}
            {(customer.contact || customer.email) && (
              <section>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50 mb-2">Quick Actions</h4>
                <div className="flex flex-wrap gap-2">
                  {customer.contact && (
                    <>
                      <button
                        onClick={copyPhone}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5F7FA] text-[#0c2340] text-sm font-semibold hover:bg-[#ECEFF5] transition"
                      >
                        {copied
                          ? <CheckCheck className="h-4 w-4 text-emerald-500" />
                          : <Copy className="h-4 w-4 text-[#FF6B00]" />}
                        {copied ? "Copied!" : "Copy Phone"}
                      </button>
                      {whatsappHref && (
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition"
                        >
                          <MessageSquare className="h-4 w-4" />
                          WhatsApp
                        </a>
                      )}
                      <a
                        href={`tel:${customer.contact}`}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition"
                      >
                        <Phone className="h-4 w-4" />
                        Call
                      </a>
                    </>
                  )}
                  {customer.email && (
                    <a
                      href={`mailto:${customer.email}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5F7FA] text-[#0c2340] text-sm font-semibold hover:bg-[#ECEFF5] transition"
                    >
                      <Mail className="h-4 w-4 text-[#FF6B00]" />
                      Email
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* Contact info */}
            {(customer.contact || customer.email) && (
              <section>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50 mb-2">Contact</h4>
                <div className="space-y-2">
                  {customer.contact && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F7FA]">
                      <Phone className="h-4 w-4 text-[#FF6B00] shrink-0" />
                      <span className="text-sm text-[#0c2340] font-medium">{customer.contact}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F7FA]">
                      <Mail className="h-4 w-4 text-[#FF6B00] shrink-0" />
                      <span className="text-sm text-[#0c2340] font-medium truncate">{customer.email}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Lifetime KPIs */}
            <section>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50 mb-2">Lifetime Stats</h4>
              <div className="grid grid-cols-2 gap-3">
                <KpiCard
                  label="Total Spins"
                  value={customer.totalSpins}
                  icon={Zap}
                  accentClass="bg-[#0c2340]/8 text-[#0c2340]"
                />
                <KpiCard
                  label="Total Wins"
                  value={customer.totalWins}
                  icon={Trophy}
                  accentClass="bg-[#FF6B00]/12 text-[#FF6B00]"
                />
                <KpiCard
                  label="Win Rate"
                  value={winRatePct}
                  icon={TrendingUp}
                  accentClass="bg-emerald-50 text-emerald-600"
                />
                <KpiCard
                  label="Days Active"
                  value={daysSince ?? "—"}
                  icon={Calendar}
                  accentClass="bg-violet-50 text-violet-600"
                />
              </div>
            </section>

            {/* Prizes won */}
            {customer.prizes.length > 0 && (
              <section>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50 mb-2">Prizes Won</h4>
                <div className="flex flex-wrap gap-2">
                  {customer.prizes.map((prize) => (
                    <span
                      key={prize}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF6B00]/10 text-[#FF6B00] text-xs font-semibold border border-[#FF6B00]/20"
                    >
                      <Trophy className="h-3 w-3 shrink-0" />
                      {prize}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Spin timeline */}
            <section>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50 mb-2">Spin History</h4>
              {loading ? (
                <div className="space-y-2">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : spins.length === 0 ? (
                <p className="text-xs text-[#4a5b78] py-6 text-center">No spin history found.</p>
              ) : (
                <div className="space-y-2">
                  {spins.map((spin) => (
                    <SpinTimelineItem key={spin.code} spin={spin} />
                  ))}
                </div>
              )}
            </section>

          </div>
        </div>
      </div>
    </>
  );
}

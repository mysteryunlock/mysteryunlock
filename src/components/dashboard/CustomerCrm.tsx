import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Search, X, ArrowUpDown, Download, Users, Trophy,
  LayoutGrid, LayoutList, Phone, Mail, Zap, Clock, Activity,
} from "lucide-react";
import { getCrmCustomers } from "@/lib/access-codes.functions";
import { KpiCard, EmptyState, SkeletonKpiCard } from "./ui";
import { CustomerDetailPanel } from "./CustomerDetailPanel";
import type { Shop, CustomerRecord } from "./types";

// ─── Local types ──────────────────────────────────────────────────────────────

type SegmentFilter = "all" | "Winners" | "Multi-Spin" | "VIP" | "New" | "Lapsed";
type SortKey = "recent" | "active" | "oldest" | "az";
type ViewMode = "list" | "grid";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | null, key: string): string {
  const s = (name || "").trim();
  if (!s) return key.slice(0, 1).toUpperCase();
  const parts = s.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || s[0].toUpperCase();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const SEGMENT_META: Record<string, { bg: string; text: string; border: string }> = {
  Winner:       { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
  VIP:          { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200" },
  "Multi-Spin": { bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-200" },
  New:          { bg: "bg-violet-50",   text: "text-violet-700",  border: "border-violet-200" },
  Lapsed:       { bg: "bg-slate-100",   text: "text-slate-600",   border: "border-slate-200" },
};

async function exportCustomersCsv(customers: CustomerRecord[], shopSlug: string) {
  if (customers.length === 0) return alert("No customers to export.");
  const headers = ["#", "Name", "Phone", "Email", "Total Spins", "Total Wins", "Win Rate %", "First Seen", "Last Seen", "Segments"];
  const body = customers.map((c, i) => [
    String(i + 1),
    c.name ?? "",
    c.contact ?? "",
    c.email ?? "",
    String(c.totalSpins),
    String(c.totalWins),
    c.totalSpins > 0 ? ((c.totalWins / c.totalSpins) * 100).toFixed(0) : "0",
    fmtDate(c.firstSeen),
    fmtDate(c.lastSeen),
    c.segments.join(", "),
  ]);

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const thStyle = "background:#0c2340;color:#fff;font-weight:600;padding:8px 12px;border:1px solid #cbd5e1;text-align:left;font-family:Arial,sans-serif;font-size:12px;";
  const tdStyle = "padding:6px 12px;border:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:12px;color:#0c2340;";
  const html = [
    `<html xmlns:o="urn:schemas-microsoft-com:office:office"`,
    ` xmlns:x="urn:schemas-microsoft-com:office:excel"`,
    ` xmlns="http://www.w3.org/TR/REC-html40">`,
    `<head><meta charset="utf-8"/><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>`,
    `<x:ExcelWorksheet><x:Name>Customers</x:Name><x:WorksheetOptions><x:DisplayGridlines/>`,
    `</x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->`,
    `</head><body><table style="border-collapse:collapse;">`,
    `<thead><tr>${headers.map((h) => `<th style="${thStyle}">${esc(h)}</th>`).join("")}</tr></thead>`,
    `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td style="${tdStyle}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>`,
    `</table></body></html>`,
  ].join("");

  const filename = `${shopSlug}-customers-${new Date().toISOString().slice(0, 10)}.xls`;
  const mime = "application/vnd.ms-excel";
  const blob = new Blob(["\ufeff" + html], { type: `${mime};charset=utf-8;` });

  type SaveFilePicker = (opts: {
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }>;
  }>;
  const win = window as Window & { showSaveFilePicker?: SaveFilePicker };
  if (typeof win.showSaveFilePicker === "function") {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Excel spreadsheet", accept: { [mime]: [".xls"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  try {
    const file = new File([blob], filename, { type: mime });
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title?: string }) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: filename });
      return;
    }
  } catch { /* fall through */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCustomerCard() {
  return (
    <div className="bg-white border border-[#0c2340]/8 rounded-[20px] shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-[#F0F2F5] shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-36 rounded-full bg-[#F0F2F5]" />
          <div className="h-2.5 w-24 rounded-full bg-[#F0F2F5]" />
        </div>
        <div className="h-5 w-16 rounded-full bg-[#F0F2F5] shrink-0" />
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-5 w-14 rounded-full bg-[#F0F2F5]" />
        <div className="h-5 w-20 rounded-full bg-[#F0F2F5]" />
      </div>
    </div>
  );
}

// ─── Segment pills ─────────────────────────────────────────────────────────────

function SegmentPills({ segments, max = 3 }: { segments: string[]; max?: number }) {
  const visible = segments.slice(0, max);
  const rest = segments.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((seg) => {
        const m = SEGMENT_META[seg] ?? { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };
        return (
          <span key={seg} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${m.bg} ${m.text} ${m.border}`}>
            {seg}
          </span>
        );
      })}
      {rest > 0 && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">
          +{rest}
        </span>
      )}
    </div>
  );
}

// ─── Customer cards ────────────────────────────────────────────────────────────

function CustomerCardGrid({ customer, onClick }: { customer: CustomerRecord; onClick: () => void }) {
  const isWinner = customer.totalWins > 0;
  const init = initials(customer.name, customer.key);
  return (
    <button type="button" onClick={onClick} className="w-full text-left bg-white border border-[#0c2340]/8 rounded-[20px] shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-4 flex flex-col gap-3 hover:border-[#FF6B00]/30 hover:shadow-[0_8px_24px_-8px_rgba(255,107,0,0.18)] transition-all">
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-full grid place-items-center text-sm font-bold shrink-0 ${isWinner ? "bg-[#FF6B00]/15 text-[#FF6B00]" : "bg-[#0c2340]/8 text-[#0c2340]"}`}>
          {init}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#0c2340] truncate">{customer.name || "Anonymous"}</p>
          {customer.contact ? (
            <p className="text-xs text-[#4a5b78] flex items-center gap-1 mt-0.5 truncate">
              <Phone className="h-3 w-3 shrink-0" />{customer.contact}
            </p>
          ) : customer.email ? (
            <p className="text-xs text-[#4a5b78] flex items-center gap-1 mt-0.5 truncate">
              <Mail className="h-3 w-3 shrink-0" />{customer.email}
            </p>
          ) : null}
        </div>
      </div>

      {customer.segments.length > 0 && <SegmentPills segments={customer.segments} />}

      <div className="grid grid-cols-2 gap-2 text-center border-t border-[#0c2340]/6 pt-3">
        <div>
          <p className="text-lg font-black text-[#0c2340]">{customer.totalSpins}</p>
          <p className="text-[10px] text-[#4a5b78] font-semibold uppercase tracking-wide">Spins</p>
        </div>
        <div>
          <p className={`text-lg font-black ${isWinner ? "text-[#FF6B00]" : "text-[#0c2340]"}`}>{customer.totalWins}</p>
          <p className="text-[10px] text-[#4a5b78] font-semibold uppercase tracking-wide">Wins</p>
        </div>
      </div>

      <p className="text-[11px] text-[#4a5b78] flex items-center gap-1">
        <Clock className="h-3 w-3 shrink-0" />Last: {fmtRelative(customer.lastSeen)}
      </p>
    </button>
  );
}

function CustomerCardList({ customer, onClick }: { customer: CustomerRecord; onClick: () => void }) {
  const isWinner = customer.totalWins > 0;
  const init = initials(customer.name, customer.key);
  return (
    <button type="button" onClick={onClick} className="w-full text-left bg-white border border-[#0c2340]/8 rounded-2xl p-3 shadow-sm hover:border-[#FF6B00]/30 hover:shadow-md transition-all flex items-center gap-3">
      <div className={`w-11 h-11 rounded-full grid place-items-center text-sm font-bold shrink-0 ${isWinner ? "bg-[#FF6B00]/15 text-[#FF6B00]" : "bg-[#0c2340]/8 text-[#0c2340]"}`}>
        {init}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-[#0c2340] truncate">{customer.name || "Anonymous"}</p>
          {customer.segments.length > 0 && <SegmentPills segments={customer.segments} max={2} />}
        </div>
        {customer.contact ? (
          <p className="text-xs text-[#4a5b78] truncate mt-0.5 flex items-center gap-1">
            <Phone className="h-3 w-3 shrink-0" />{customer.contact}
          </p>
        ) : customer.email ? (
          <p className="text-xs text-[#4a5b78] truncate mt-0.5 flex items-center gap-1">
            <Mail className="h-3 w-3 shrink-0" />{customer.email}
          </p>
        ) : null}
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#4a5b78]">
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{customer.totalSpins} spin{customer.totalSpins !== 1 ? "s" : ""}</span>
          <span className={`flex items-center gap-1 font-semibold ${isWinner ? "text-[#FF6B00]" : ""}`}>
            <Trophy className="h-3 w-3" />{customer.totalWins} win{customer.totalWins !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtRelative(customer.lastSeen)}</span>
        </div>
      </div>
    </button>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENTS: { key: SegmentFilter; label: string }[] = [
  { key: "all",        label: "All" },
  { key: "Winners",    label: "Winners" },
  { key: "Multi-Spin", label: "Multi-Spin" },
  { key: "VIP",        label: "VIP" },
  { key: "New",        label: "New" },
  { key: "Lapsed",     label: "Lapsed" },
];

// ─── Main export ──────────────────────────────────────────────────────────────

export function CustomerCrm({ shop }: { shop: Shop }) {
  const fetchCrm = useServerFn(getCrmCustomers);
  const fetchCrmRef = useRef(fetchCrm);
  fetchCrmRef.current = fetchCrm;

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [campaignNames, setCampaignNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [campaignId, setCampaignId] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await fetchCrmRef.current({ data: { shopId: shop.id } });
        if (cancelled) return;
        setCustomers(((r as any).customers ?? []) as CustomerRecord[]);
        setCampaignNames(((r as any).campaignNames ?? {}) as Record<string, string>);
      } catch {
        if (!cancelled) setCustomers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shop.id]);

  const campaignOptions = useMemo(
    () => Object.entries(campaignNames).map(([id, name]) => ({ id, name })),
    [campaignNames],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = customers.filter((c) => {
      if (q && !((c.name ?? "").toLowerCase().includes(q) || (c.contact ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q))) return false;
      if (segment !== "all" && !c.segments.includes(segment)) return false;
      if (campaignId !== "all" && !c.campaignIds.includes(campaignId)) return false;
      return true;
    });
    if (sort === "active")  out = [...out].sort((a, b) => b.totalSpins - a.totalSpins);
    else if (sort === "recent") out = [...out].sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));
    else if (sort === "oldest") out = [...out].sort((a, b) => (a.firstSeen ?? "").localeCompare(b.firstSeen ?? ""));
    else if (sort === "az")     out = [...out].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return out;
  }, [customers, search, segment, campaignId, sort]);

  const kpis = useMemo(() => {
    const totalWins = customers.reduce((s, c) => s + c.totalWins, 0);
    const totalSpins = customers.reduce((s, c) => s + c.totalSpins, 0);
    const avgSpins = customers.length > 0 ? totalSpins / customers.length : 0;
    return { count: customers.length, totalWins, avgSpins };
  }, [customers]);

  const hasFilters = search !== "" || segment !== "all" || campaignId !== "all";

  const clearFilters = () => { setSearch(""); setSegment("all"); setCampaignId("all"); };

  return (
    <div className="space-y-4">

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {loading ? (
          <>
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
          </>
        ) : (
          <>
            <KpiCard
              label="Customers"
              value={kpis.count}
              icon={Users}
              accentClass="bg-[#0c2340]/8 text-[#0c2340]"
            />
            <KpiCard
              label="Total Wins"
              value={kpis.totalWins}
              icon={Trophy}
              accentClass="bg-[#FF6B00]/12 text-[#FF6B00]"
            />
            <KpiCard
              label="Avg Spins"
              value={kpis.avgSpins.toFixed(1)}
              icon={Activity}
              accentClass="bg-emerald-50 text-emerald-600"
            />
          </>
        )}
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b7a93] pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone or email…"
          className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-2xl pl-10 pr-9 py-3 text-sm outline-none focus:border-[#FF6B00]/40 focus:bg-white shadow-sm transition"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7a93] hover:text-[#0c2340] transition"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Segment filter chips ───────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
        {SEGMENTS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSegment(key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
              segment === key
                ? "bg-[#FF6B00] text-white border-[#FF6B00] shadow-sm"
                : "bg-white text-[#0c2340] border-[#0c2340]/10 hover:border-[#FF6B00]/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Toolbar: campaign filter + sort + view toggle ─────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {campaignOptions.length > 1 && (
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="bg-white text-[#0c2340] border border-[#0c2340]/10 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm focus:outline-none focus:border-[#FF6B00]/40 min-w-[120px] max-w-[180px] flex-1"
          >
            <option value="all">All Campaigns</option>
            {campaignOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        <div className="relative flex-1 min-w-[130px] max-w-[170px]">
          <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b7a93] pointer-events-none" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-full appearance-none bg-white text-[#0c2340] border border-[#0c2340]/10 rounded-full pl-7 pr-4 py-1.5 text-xs font-semibold shadow-sm focus:outline-none focus:border-[#FF6B00]/40"
          >
            <option value="recent">Most Recent</option>
            <option value="active">Most Active</option>
            <option value="oldest">Oldest First</option>
            <option value="az">A → Z</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-1 bg-[#F5F7FA] rounded-full p-1 border border-[#0c2340]/8">
          <button
            onClick={() => setViewMode("list")}
            aria-label="List view"
            className={`p-1.5 rounded-full transition ${viewMode === "list" ? "bg-white shadow-sm text-[#FF6B00]" : "text-[#4a5b78] hover:text-[#0c2340]"}`}
          >
            <LayoutList className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            className={`p-1.5 rounded-full transition ${viewMode === "grid" ? "bg-white shadow-sm text-[#FF6B00]" : "text-[#4a5b78] hover:text-[#0c2340]"}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Count bar + export ────────────────────────────────────────────── */}
      {!loading && customers.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-[#4a5b78] font-semibold">
            {filtered.length}{filtered.length !== customers.length ? ` of ${customers.length}` : ""}{" "}
            customer{customers.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={() => exportCustomersCsv(filtered, shop.slug)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF6B00] text-white text-xs font-bold hover:bg-[#e85f00] transition shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      )}

      {/* ── Customer list / grid ──────────────────────────────────────────── */}
      {loading ? (
        <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-2"}>
          <SkeletonCustomerCard />
          <SkeletonCustomerCard />
          <SkeletonCustomerCard />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? "No matching customers" : "No customers yet"}
          description={
            hasFilters
              ? "Try adjusting your search or filters."
              : "Customers who spin your wheel will appear here automatically."
          }
          action={hasFilters ? { label: "Clear filters", onClick: clearFilters } : undefined}
        />
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-2"}>
          {filtered.map((c) =>
            viewMode === "grid"
              ? <CustomerCardGrid key={c.key} customer={c} onClick={() => setSelectedCustomer(c)} />
              : <CustomerCardList key={c.key} customer={c} onClick={() => setSelectedCustomer(c)} />,
          )}
        </div>
      )}

      {/* ── Customer detail panel ─────────────────────────────────────────── */}
      {selectedCustomer && (
        <CustomerDetailPanel
          customer={selectedCustomer}
          shopId={shop.id}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}

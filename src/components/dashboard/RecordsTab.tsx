import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Search, ArrowUpDown, X, Download, MessageSquare, Trash2, Loader2, Users,
  CheckCircle2, XCircle, Phone, Calendar, Hash, Award, Mail, Trophy,
} from "lucide-react";
import { listSpinRecords, deleteSpinRecord, resetSpinRecords } from "@/lib/access-codes.functions";
import { Btn, ConfirmModal } from "@/components/ds";
import type { Shop, RecordRow } from "./types";

type FilterKey = "all" | "winners" | "nonwinners" | "today" | "week";
type SortKey = "latest" | "oldest" | "spins";

function isWinner(r: RecordRow) {
  const p = (r.prize_won || "").trim().toLowerCase();
  return !!p && p !== "try again" && p !== "tryagain" && p !== "no win";
}
function custKey(r: RecordRow) {
  return (r.customer_contact || r.customer_email || r.customer_name || r.code).toLowerCase();
}
function initials(name: string | null, fallback: string) {
  const s = (name || "").trim();
  if (!s) return fallback.slice(0, 1).toUpperCase();
  const parts = s.split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || s[0].toUpperCase();
}

async function exportRowsAsCsv(rows: RecordRow[], slug: string) {
  if (rows.length === 0) return alert("No records to export.");
  const headers = ["#", "Name", "Contact", "Email", "Code", "Prize", "Date", "Time"];
  const body: string[][] = [];
  rows.forEach((r, i) => {
    const d = r.spun_at ? new Date(r.spun_at) : null;
    body.push([
      String(i + 1),
      r.customer_name || "",
      r.customer_contact || "",
      r.customer_email || "",
      r.code || "",
      r.prize_won || "",
      d ? d.toLocaleDateString() : "",
      d ? d.toLocaleTimeString() : "",
    ]);
  });

  // Build an Excel-friendly HTML table. Saved as .xls so Excel, Numbers,
  // Google Sheets and most mobile viewers render it as a real spreadsheet
  // with proper rows and columns — much cleaner than raw CSV text.
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const thStyle = "background:#0c2340;color:#fff;font-weight:600;padding:8px 12px;border:1px solid #cbd5e1;text-align:left;font-family:Arial,sans-serif;font-size:12px;";
  const tdStyle = "padding:6px 12px;border:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:12px;color:#0c2340;";
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Customers</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table style="border-collapse:collapse;"><thead><tr>${headers.map((h) => `<th style="${thStyle}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td style="${tdStyle}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;

  const filename = `${slug}-customers-${new Date().toISOString().slice(0, 10)}.xls`;
  const mime = "application/vnd.ms-excel";
  const blob = new Blob(["\ufeff" + html], { type: `${mime};charset=utf-8;` });

  type SaveFilePicker = (opts: { suggestedName?: string; types?: { description?: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }> }>;
  const win = window as Window & { showSaveFilePicker?: SaveFilePicker };
  if (typeof win.showSaveFilePicker === "function") {
    try {
      const handle = await win.showSaveFilePicker({ suggestedName: filename, types: [{ description: "Excel spreadsheet", accept: { [mime]: [".xls"] } }] });
      const writable = await handle.createWritable();
      await writable.write(blob); await writable.close(); return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  try {
    const file = new File([blob], filename, { type: mime });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title?: string }) => Promise<void> };
    if (nav.canShare?.({ files: [file] }) && nav.share) { await nav.share({ files: [file], title: filename }); return; }
  } catch { /* fall through */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

export function RecordsTab({ shop }: { shop: Shop }) {
  const fetchRecords = useServerFn(listSpinRecords);
  const doDel = useServerFn(deleteSpinRecord);
  const doReset = useServerFn(resetSpinRecords);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("latest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [profileKey, setProfileKey] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [resetAllOpen, setResetAllOpen] = useState(false);
  const [deleteCodeConfirm, setDeleteCodeConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchRecords({ data: { shopId: shop.id } });
      setRows((res.rows as RecordRow[]) ?? []);
    } finally { setLoading(false); }
  }, [fetchRecords, shop.id]);
  useEffect(() => { load(); }, [load]);

  const spinCountByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(custKey(r), (m.get(custKey(r)) || 0) + 1);
    return m;
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);
    let out = rows.filter((r) => {
      if (s && !((r.customer_name || "").toLowerCase().includes(s)
        || (r.customer_contact || "").toLowerCase().includes(s)
        || (r.customer_email || "").toLowerCase().includes(s)
        || r.code.toLowerCase().includes(s)
        || (r.prize_won || "").toLowerCase().includes(s))) return false;
      if (filter === "winners" && !isWinner(r)) return false;
      if (filter === "nonwinners" && isWinner(r)) return false;
      if (filter === "today") { if (!r.spun_at || new Date(r.spun_at) < todayStart) return false; }
      if (filter === "week") { if (!r.spun_at || new Date(r.spun_at) < weekStart) return false; }
      return true;
    });
    if (sort === "latest") out = [...out].sort((a, b) => (b.spun_at || "").localeCompare(a.spun_at || ""));
    else if (sort === "oldest") out = [...out].sort((a, b) => (a.spun_at || "").localeCompare(b.spun_at || ""));
    else if (sort === "spins") out = [...out].sort((a, b) => (spinCountByKey.get(custKey(b)) || 0) - (spinCountByKey.get(custKey(a)) || 0));
    return out;
  }, [rows, q, filter, sort, spinCountByKey]);

  const toggleSel = (code: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });
  };
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.code));
  const toggleSelAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.code)));
  };

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.code)), [rows, selected]);

  const bulkDelete = () => {
    if (selected.size === 0) return;
    setBulkDeleteOpen(true);
  };
  const doBulkDelete = async () => {
    for (const code of selected) await doDel({ data: { shopId: shop.id, code } });
    setSelected(new Set()); load();
  };
  const bulkMessage = () => {
    const contacts = selectedRows.map((r) => r.customer_contact).filter(Boolean) as string[];
    if (contacts.length === 0) return alert("No phone contacts in selection.");
    const body = encodeURIComponent("Hi from " + shop.name + "!");
    window.open(`https://wa.me/?text=${body}`, "_blank");
  };

  const profileRows = useMemo(() => profileKey ? rows.filter((r) => custKey(r) === profileKey) : [], [profileKey, rows]);

  const FILTERS: { k: FilterKey; label: string }[] = [
    { k: "all", label: "All" }, { k: "winners", label: "Winners" },
    { k: "nonwinners", label: "Non-Winners" }, { k: "today", label: "Today" }, { k: "week", label: "This Week" },
  ];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b7a93]" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, phone, or code"
          className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-2xl pl-10 pr-3 py-3 text-sm outline-none focus:border-[#FF6B1A]/40 focus:bg-white shadow-sm"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {FILTERS.map(({ k, label }) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${filter === k ? "bg-[#FF6B1A] text-white border-[#FF6B1A] shadow-sm" : "bg-white text-[#0c2340] border-[#0c2340]/10 hover:border-[#FF6B1A]/40"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Sort + select all */}
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-[#0c2340]/70">
          <input type="checkbox" checked={allSelected} onChange={toggleSelAll} className="h-4 w-4 rounded accent-[#FF6B1A]" />
          <span>{selected.size > 0 ? `${selected.size} selected` : `${filtered.length} customer${filtered.length === 1 ? "" : "s"}`}</span>
        </label>
        <div className="relative">
          <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b7a93] pointer-events-none" />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
            className="appearance-none bg-white text-[#0c2340] border border-[#0c2340]/10 rounded-full pl-7 pr-7 py-1.5 text-xs font-semibold shadow-sm focus:outline-none focus:border-[#FF6B1A]/40">
            <option value="latest">Latest</option>
            <option value="oldest">Oldest</option>
            <option value="spins">Most Spins</option>
          </select>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-[#0c2340] text-white rounded-2xl p-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button onClick={() => setSelected(new Set())} className="p-2 rounded-full hover:bg-white/10" aria-label="Clear selection">
            <X className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold flex-1">{selected.size} selected</span>
          <button onClick={() => exportRowsAsCsv(selectedRows, shop.slug)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={bulkMessage} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold">
            <MessageSquare className="h-3.5 w-3.5" /> Message
          </button>
          <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-semibold">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#0c2340]/60">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF6B1A]" />
          <p className="text-sm mt-3">Loading customers…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-[#FF6B1A]/10 grid place-items-center mb-3">
            <Users className="h-7 w-7 text-[#FF6B1A]" />
          </div>
          <p className="text-[#0c2340] font-semibold">No customers yet</p>
          <p className="text-xs text-[#0c2340]/60 mt-1 max-w-xs">{q || filter !== "all" ? "Try adjusting your search or filters." : "Customers who spin will appear here automatically."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const winner = isWinner(r);
            const checked = selected.has(r.code);
            const when = r.spun_at ? new Date(r.spun_at) : null;
            return (
              <div key={r.code}
                className={`group bg-white border rounded-2xl p-3 shadow-sm transition ${checked ? "border-[#FF6B1A] ring-2 ring-[#FF6B1A]/20" : "border-[#0c2340]/10 hover:border-[#FF6B1A]/30 hover:shadow-md"}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={checked} onChange={() => toggleSel(r.code)} onClick={(e) => e.stopPropagation()} className="mt-1 h-4 w-4 rounded accent-[#FF6B1A] shrink-0" />
                  <button onClick={() => setProfileKey(custKey(r))} className="flex-1 min-w-0 text-left">
                    <div className="flex items-start gap-3">
                      <div className={`h-11 w-11 shrink-0 rounded-full grid place-items-center text-sm font-bold ${winner ? "bg-[#FF6B1A]/15 text-[#FF6B1A]" : "bg-[#0c2340]/10 text-[#0c2340]"}`}>
                        {initials(r.customer_name, r.code)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#0c2340] truncate">{r.customer_name || "Anonymous"}</p>
                          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${winner ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                            {winner ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {winner ? "Winner" : "Non-Winner"}
                          </span>
                        </div>
                        {r.customer_contact && <p className="text-xs text-[#0c2340]/60 truncate mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3" />{r.customer_contact}</p>}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#0c2340]/60 mt-1.5">
                          {when && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{when.toLocaleDateString()} · {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                          <span className="inline-flex items-center gap-1 font-mono"><Hash className="h-3 w-3" />{r.code}</span>
                        </div>
                        <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0c2340]">
                          <Award className={`h-3.5 w-3.5 ${winner ? "text-[#FF6B1A]" : "text-[#0c2340]/40"}`} />
                          {r.prize_won || "Try Again"}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer actions */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center gap-2 pt-2">
          <Btn variant="primary" className="flex-1 py-2.5 text-sm" onClick={() => exportRowsAsCsv(rows, shop.slug)} leftIcon={<Download className="h-4 w-4" />}>
            Export All CSV
          </Btn>
          <button onClick={() => setResetAllOpen(true)} className="px-3 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold">
            Reset All
          </button>
        </div>
      )}

      {/* Profile drawer */}
      {profileKey && (
        <CustomerProfile
          rows={profileRows}
          onClose={() => setProfileKey(null)}
          onDelete={(code) => setDeleteCodeConfirm(code)}
        />
      )}

      <ConfirmModal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => { setBulkDeleteOpen(false); doBulkDelete(); }}
        title={`Delete ${selected.size} record${selected.size !== 1 ? "s" : ""}?`}
        description="These spin records will be permanently deleted. This cannot be undone."
        confirmLabel="Delete records"
        variant="danger"
      />
      <ConfirmModal
        open={resetAllOpen}
        onClose={() => setResetAllOpen(false)}
        onConfirm={async () => { setResetAllOpen(false); await doReset({ data: { shopId: shop.id } }); setSelected(new Set()); load(); }}
        title="Reset all spin records?"
        description="This will permanently delete ALL spin records for this shop. This cannot be undone."
        confirmLabel="Reset all"
        variant="danger"
      />
      <ConfirmModal
        open={deleteCodeConfirm !== null}
        onClose={() => setDeleteCodeConfirm(null)}
        onConfirm={async () => { const code = deleteCodeConfirm!; setDeleteCodeConfirm(null); await doDel({ data: { shopId: shop.id, code } }); load(); }}
        title="Delete spin record?"
        description="This spin record will be permanently deleted."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function CustomerProfile({ rows, onClose, onDelete }: { rows: RecordRow[]; onClose: () => void; onDelete: (code: string) => void | Promise<void> }) {
  const primary = rows[0];
  if (!primary) return null;
  const winners = rows.filter(isWinner);
  const name = rows.find((r) => r.customer_name)?.customer_name || "Anonymous";
  const contact = rows.find((r) => r.customer_contact)?.customer_contact;
  const email = rows.find((r) => r.customer_email)?.customer_email;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="relative bg-gradient-to-br from-[#0c2340] to-[#1a3a5f] text-white p-5">
          <button onClick={onClose} className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-[#FF6B1A] grid place-items-center text-lg font-bold">
              {initials(name, primary.code)}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold truncate">{name}</h3>
              <p className="text-xs text-white/70">{rows.length} spin{rows.length === 1 ? "" : "s"} · {winners.length} win{winners.length === 1 ? "" : "s"}</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {/* Contact */}
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50 mb-2">Contact</h4>
            <div className="space-y-2">
              {contact ? (
                <a href={`tel:${contact}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F7FA] hover:bg-[#FF6B1A]/10 transition">
                  <Phone className="h-4 w-4 text-[#FF6B1A]" />
                  <span className="text-sm text-[#0c2340] font-medium">{contact}</span>
                </a>
              ) : null}
              {email ? (
                <a href={`mailto:${email}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F7FA] hover:bg-[#FF6B1A]/10 transition">
                  <Mail className="h-4 w-4 text-[#FF6B1A]" />
                  <span className="text-sm text-[#0c2340] font-medium truncate">{email}</span>
                </a>
              ) : null}
              {!contact && !email && <p className="text-xs text-[#0c2340]/50">No contact info on file.</p>}
            </div>
          </section>

          {/* Spin history */}
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50 mb-2">Spin History</h4>
            <div className="space-y-2">
              {rows.map((r) => {
                const winner = isWinner(r);
                const when = r.spun_at ? new Date(r.spun_at) : null;
                return (
                  <div key={r.code} className="flex items-center gap-3 p-3 rounded-xl border border-[#0c2340]/10">
                    <div className={`h-9 w-9 rounded-full grid place-items-center shrink-0 ${winner ? "bg-[#FF6B1A]/15 text-[#FF6B1A]" : "bg-slate-100 text-slate-500"}`}>
                      <Award className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0c2340] truncate">{r.prize_won || "Try Again"}</p>
                      <p className="text-[11px] text-[#0c2340]/60 font-mono">{r.code} · {when ? when.toLocaleString() : "—"}</p>
                    </div>
                    <button onClick={() => onDelete(r.code)} className="h-8 w-8 grid place-items-center rounded-full text-red-500 hover:bg-red-50" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Prizes won */}
          {winners.length > 0 && (
            <section>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50 mb-2">Prizes Won</h4>
              <div className="flex flex-wrap gap-2">
                {winners.map((r) => (
                  <span key={r.code} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF6B1A]/10 text-[#FF6B1A] text-xs font-semibold border border-[#FF6B1A]/20">
                    <Trophy className="h-3 w-3" />{r.prize_won}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

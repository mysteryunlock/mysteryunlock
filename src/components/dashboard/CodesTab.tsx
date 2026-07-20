import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Hash, Megaphone } from "lucide-react";
import { listAccessCodes, generateAccessCodes, deleteUnusedCodes } from "@/lib/access-codes.functions";
import { ConfirmModal } from "@/components/ds";
import { EmptyState, SkeletonRow } from "./ui";
import type { Shop, CodeRow } from "./types";

interface CodesTabProps {
  shop: Shop;
  campaignId: string | null;
  campaignSlug: string | null;
}

function CodeRowSkeleton() {
  return (
    <div className="rounded-xl bg-[#F8FAFC] border border-[#0c2340]/6 px-4 py-3 flex items-center gap-3 animate-pulse">
      <div className="h-3.5 w-28 rounded-full bg-[#E5E9F0] shrink-0" />
      <div className="h-5 w-12 rounded-full bg-[#E5E9F0]" />
      <div className="ml-auto h-3 w-24 rounded-full bg-[#E5E9F0]" />
    </div>
  );
}

export function CodesTab({ shop, campaignId, campaignSlug }: CodesTabProps) {
  const fetchCodes  = useServerFn(listAccessCodes);
  const doGen       = useServerFn(generateAccessCodes);
  const doDelUnused = useServerFn(deleteUnusedCodes);

  const [rows,            setRows]            = useState<CodeRow[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [count,           setCount]           = useState(10);
  const [filter,          setFilter]          = useState<"all" | "unused" | "used">("all");
  const [deleteUnusedOpen, setDeleteUnusedOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCodes({
        data: { shopId: shop.id, ...(campaignId ? { campaignId } : {}) },
      });
      setRows(((res as { rows: CodeRow[] }).rows) ?? []);
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  }, [fetchCodes, shop.id, campaignId]);

  useEffect(() => { load(); }, [load]);

  const gen = async () => {
    if (!campaignId) return;
    await doGen({ data: { shopId: shop.id, count, campaignId } });
    load();
  };

  const doDelUnused_ = async () => {
    await doDelUnused({
      data: { shopId: shop.id, ...(campaignId ? { campaignId } : {}) },
    });
    load();
  };

  const downloadCSV = () => {
    const header = ["Code", "Status", "Prize Won", "Customer Name", "Created"];
    const body = filtered.map((r) => [
      r.code,
      r.is_used ? "Used" : "Unused",
      r.prize_won ?? "",
      r.customer_name ?? "",
      r.created_at ? new Date(r.created_at).toLocaleDateString() : "",
    ]);
    const csv = [header, ...body]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = campaignSlug ? `codes-${campaignSlug}.csv` : "codes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = rows.filter((r) =>
    filter === "all" ? true : filter === "unused" ? !r.is_used : r.is_used,
  );

  return (
    <div className="space-y-3">

      {/* ── Toolbar ── */}
      <div className="rounded-[16px] bg-[#F8FAFC] border border-[#0c2340]/8 p-3 flex gap-2 items-center flex-wrap">
        <input
          type="number"
          min={1}
          max={500}
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value || "0"))}
          aria-label="Number of codes to generate"
          disabled={!campaignId}
          className="w-20 bg-white text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/12 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-[#FF6B1A]/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={gen}
          disabled={!campaignId}
          title={!campaignId ? "Open a campaign in Campaign Hub to generate codes" : undefined}
          className="px-4 py-2 rounded-lg bg-[#FF6B1A] text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all min-h-[40px] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Generate
        </button>
        <button
          onClick={() => setDeleteUnusedOpen(true)}
          disabled={!campaignId}
          title={!campaignId ? "Select a campaign in Campaign Hub to delete its unused codes" : undefined}
          className="px-3 py-2 rounded-lg bg-red-50 text-red-600 border border-red-100 text-sm font-semibold hover:bg-red-100 transition-colors min-h-[40px] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Delete unused
        </button>
        <button
          onClick={downloadCSV}
          title="Download CSV"
          className="px-3 py-2 rounded-lg bg-white border border-[#0c2340]/12 text-[#4a5b78] text-sm font-semibold flex items-center gap-1.5 hover:border-[#0c2340]/25 transition-colors min-h-[40px]"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
        <div className="ml-auto flex gap-1 text-xs">
          {(["all", "unused", "used"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1.5 rounded-lg font-semibold capitalize transition-all ${
                filter === f
                  ? "bg-[#FF6B1A] text-white"
                  : "bg-white border border-[#0c2340]/10 text-[#4a5b78] hover:border-[#FF6B1A]/40"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Count label ── */}
      {!loading && (
        <p className="text-xs text-[#6b7a93] font-medium px-1" role="status" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "code" : "codes"}
          {campaignId ? " in this campaign" : " across all campaigns"}
        </p>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-1.5" role="status" aria-label="Loading codes">
          <CodeRowSkeleton />
          <CodeRowSkeleton />
          <CodeRowSkeleton />
          <SkeletonRow />
        </div>
      )}

      {/* ── Code list ── */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {filtered.map((r) => (
            <div
              key={r.code}
              className="rounded-xl bg-white border border-[#0c2340]/8 px-4 py-3 flex items-center gap-3 text-sm hover:border-[#0c2340]/18 transition-colors"
            >
              <Hash className="w-3.5 h-3.5 text-[#c4ccd9] shrink-0" strokeWidth={1.75} />
              <span className="font-mono tracking-widest text-[#0c2340] font-semibold">{r.code}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  r.is_used
                    ? "bg-red-50 text-red-600"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {r.is_used ? "used" : "unused"}
              </span>
              <span className="ml-auto text-xs text-[#9aa5b5] truncate">
                {r.customer_name || ""}
                {r.prize_won ? ` · ${r.prize_won}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state (no codes yet) ── */}
      {!loading && filtered.length === 0 && rows.length === 0 && (
        <EmptyState
          icon={Hash}
          title="No access codes yet"
          description="Generate codes above to share with customers via QR or direct link."
        />
      )}

      {/* ── Filtered empty state ── */}
      {!loading && filtered.length === 0 && rows.length > 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-[#6b7a93]">No {filter} codes in this campaign.</p>
        </div>
      )}

      <ConfirmModal
        open={deleteUnusedOpen}
        onClose={() => setDeleteUnusedOpen(false)}
        onConfirm={() => { setDeleteUnusedOpen(false); doDelUnused_(); }}
        title={campaignId ? "Delete unused codes for this campaign?" : "Delete unused codes?"}
        description={
          campaignId
            ? "This will permanently delete all unused codes in this campaign. Used codes (spin records) are preserved. This cannot be undone."
            : "This will permanently delete all unused codes across your shop. Used codes are preserved. This cannot be undone."
        }
        confirmLabel="Delete unused"
        variant="danger"
      />
    </div>
  );
}

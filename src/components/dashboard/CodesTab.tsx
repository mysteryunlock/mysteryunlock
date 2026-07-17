import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAccessCodes, generateAccessCodes, deleteUnusedCodes } from "@/lib/access-codes.functions";
import { ConfirmModal } from "@/components/ds";
import type { Shop, CodeRow } from "./types";

export function CodesTab({ shop }: { shop: Shop }) {
  const fetchCodes = useServerFn(listAccessCodes);
  const doGen = useServerFn(generateAccessCodes);
  const doDelUnused = useServerFn(deleteUnusedCodes);
  const [rows, setRows] = useState<CodeRow[]>([]);
  const [count, setCount] = useState(10);
  const [filter, setFilter] = useState<"all" | "unused" | "used">("all");
  const [deleteUnusedOpen, setDeleteUnusedOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchCodes({ data: { shopId: shop.id } });
    setRows((res.rows as CodeRow[]) ?? []);
  }, [fetchCodes, shop.id]);
  useEffect(() => { load(); }, [load]);

  const gen = async () => {
    await doGen({ data: { shopId: shop.id, count } });
    load();
  };
  const delUnused = () => setDeleteUnusedOpen(true);
  const doDelUnused_ = async () => {
    await doDelUnused({ data: { shopId: shop.id } });
    load();
  };

  const filtered = rows.filter((r) => filter === "all" ? true : filter === "unused" ? !r.is_used : r.is_used);

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-3 flex gap-2 items-center flex-wrap">
        <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(parseInt(e.target.value || "0"))} className="w-20 bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-2 py-2 outline-none" />
        <button onClick={gen} className="px-3 py-2 rounded-lg bg-primary text-white font-bold text-sm">Generate</button>
        <button onClick={delUnused} className="px-3 py-2 rounded-lg bg-destructive/20 text-destructive text-sm">Delete unused</button>
        <div className="ml-auto flex gap-1 text-xs">
          {(["all", "unused", "used"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-2 py-1 rounded ${filter === f ? "bg-primary text-white font-bold" : "bg-white/5"}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} codes</div>

      <div className="space-y-1 max-h-[60vh] overflow-y-auto">
        {filtered.map((r) => (
          <div key={r.code} className="glass rounded-lg px-3 py-2 flex items-center gap-3 text-sm">
            <span className="font-mono tracking-widest">{r.code}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${r.is_used ? "bg-destructive/30 text-destructive" : "bg-emerald-500/20 text-emerald-400"}`}>
              {r.is_used ? "used" : "unused"}
            </span>
            <span className="ml-auto text-xs text-muted-foreground truncate">
              {r.customer_name || ""}{r.prize_won ? ` · ${r.prize_won}` : ""}
            </span>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={deleteUnusedOpen}
        onClose={() => setDeleteUnusedOpen(false)}
        onConfirm={() => { setDeleteUnusedOpen(false); doDelUnused_(); }}
        title="Delete all unused codes?"
        description="This will permanently delete all codes that haven't been used yet. This cannot be undone."
        confirmLabel="Delete unused"
        variant="danger"
      />
    </div>
  );
}

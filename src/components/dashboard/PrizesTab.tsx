import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Info, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { upsertPrize, deletePrize, updateProbabilities } from "@/lib/prizes.functions";
import { useMyPrizes, useInvalidateMyPrizes, myPrizesQueryKey } from "@/lib/my-prizes-hook";
import { PrizesPerf } from "@/lib/perf-timing";
import { DEFAULT_LOGO } from "@/lib/spin-store";
import { parseServerValidationError } from "@/lib/utils";
import { ConfirmModal } from "@/components/ds";
import type { Shop, Prize } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Auto-balance algorithm
//
// When prize X moves to `newVal`, the remaining budget (100 − newVal) is
// redistributed across all other prizes proportionally to their current values,
// subject to a per-prize floor of `minProb`.
//
// Strategy:
//   1. Give every other prize its guaranteed `minProb` share first.
//   2. Distribute the leftover (`extraBudget`) proportionally, using each
//      prize's current amount *above* minProb as its weight.
//   3. Integer-round with a "largest-remainder" pass so the total is exactly 100.
//
// Returns the full updated prizes array, or an error string if the change would
// force any other prize below `minProb` (i.e. the budget is too tight).
// ─────────────────────────────────────────────────────────────────────────────
function autoBalance(
  prizes: Prize[],
  changedId: string,
  newVal: number,
  minProb: number,
): Prize[] | string {
  const others = prizes.filter((p) => p.id !== changedId);
  const remainingBudget = 100 - newVal;

  // ── Feasibility checks ────────────────────────────────────────────────────
  if (newVal < minProb && minProb > 0) {
    return `Prize cannot be set below the platform minimum of ${minProb}%.`;
  }
  if (newVal < 0 || newVal > 100) {
    return "Probability must be between 0 and 100.";
  }
  if (others.length === 0) {
    // Only one prize — it must own 100% of the distribution.
    return prizes.map((p) =>
      p.id === changedId ? { ...p, probability: 100 } : p,
    );
  }
  const minCost = others.length * minProb;
  if (remainingBudget < minCost) {
    return `Cannot increase this prize because another prize would fall below the platform minimum of ${minProb}%.`;
  }

  // ── Distribute the budget across other prizes ──────────────────────────────
  // Step 1: give each other prize its minProb floor.
  // Step 2: distribute the remaining `extraBudget` proportionally.
  const extraBudget = remainingBudget - minCost; // always >= 0

  // Weights = each prize's current probability above the floor (never negative).
  const weights = others.map((p) => Math.max(0, p.probability - minProb));
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  let distributed: number[];

  if (totalWeight === 0 || extraBudget === 0) {
    // All other prizes are already at the floor, or there's nothing extra:
    // share extraBudget as evenly as possible.
    const base = Math.floor(extraBudget / others.length);
    const leftover = extraBudget - base * others.length;
    distributed = others.map((_, i) => minProb + base + (i < leftover ? 1 : 0));
  } else {
    // Proportional share of extraBudget, then integer-round via largest remainder.
    const raw = weights.map((w) => minProb + (w / totalWeight) * extraBudget);
    const floored = raw.map(Math.floor);
    let leftover = remainingBudget - floored.reduce((s, v) => s + v, 0);

    // Sort indices by fractional part descending; add 1 to the top `leftover` ones.
    const order = raw
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < leftover; k++) floored[order[k % order.length].i] += 1;

    distributed = floored;
  }

  // ── Assemble result ────────────────────────────────────────────────────────
  let di = 0;
  return prizes.map((p) => {
    if (p.id === changedId) return { ...p, probability: newVal };
    return { ...p, probability: distributed[di++] };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimated winners helper
// ─────────────────────────────────────────────────────────────────────────────
function estimatedWinners(prob: number): string {
  if (prob <= 0) return "Not included in distribution";
  if (prob >= 100) return "Guaranteed every eligible spin";
  return `≈ ${prob} winner${prob === 1 ? "" : "s"} per 100 spins`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PrizesTab
// ─────────────────────────────────────────────────────────────────────────────
export function PrizesTab({
  shop,
  campaignId,
}: {
  shop: Shop;
  campaignId?: string | null;
}) {
  const doUpsert = useServerFn(upsertPrize);
  const doDelete = useServerFn(deletePrize);
  const doProbs  = useServerFn(updateProbabilities);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: prizes = [], isFetching } = useMyPrizes(shop.id, campaignId);
  const invalidatePrizes = useInvalidateMyPrizes(shop.id);
  const qc = useQueryClient();

  // ── PERF AUDIT T8 ────────────────────────────────────────────────────────
  const hasRenderedRef = useRef(false);
  useEffect(() => {
    if (!hasRenderedRef.current && prizes.length > 0) {
      hasRenderedRef.current = true;
      PrizesPerf.markPrizesTabFirstRender(prizes.length, !isFetching);
    }
  }, [prizes, isFetching]);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<Prize | null>(null);
  const [busy, setBusy]       = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // ── Distribution save state ────────────────────────────────────────────────
  const [savingDist, setSavingDist] = useState(false);
  const [distErr, setDistErr]       = useState("");

  // Inline error per-prize when an edit is rejected by auto-balance
  const [prizeErr, setPrizeErr] = useState<Record<string, string>>({});

  // ── Keyboard height (visual viewport API) ─────────────────────────────────
  const [kbHeight, setKbHeight] = useState(0);
  const isOpen = !!editing;
  useEffect(() => {
    if (!isOpen) { setKbHeight(0); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setKbHeight(Math.max(0, window.innerHeight - vv.offsetTop - vv.height));
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [isOpen]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const minProb: number = shop.minimum_probability ?? 5;
  const total = prizes.reduce((s, p) => s + (p.probability ?? 0), 0);
  const isBalanced = prizes.length > 0 && total === 100;

  // ── Auto-balancing probability update ─────────────────────────────────────
  // Every edit auto-redistributes the remaining budget across other prizes so
  // the total always stays at exactly 100%.  Rejected edits show a per-prize
  // error and leave the cache untouched.
  const applyProb = (id: string, newVal: number) => {
    const result = autoBalance(prizes, id, newVal, minProb);
    if (typeof result === "string") {
      // Rejected — show per-prize error, clear after 3 s
      setPrizeErr((prev) => ({ ...prev, [id]: result }));
      const t = setTimeout(
        () => setPrizeErr((prev) => { const n = { ...prev }; delete n[id]; return n; }),
        3000,
      );
      return () => clearTimeout(t);
    }
    // Accepted — write into TanStack Query cache (optimistic)
    qc.setQueryData(myPrizesQueryKey(shop.id, campaignId), result);
    setPrizeErr((prev) => { const n = { ...prev }; delete n[id]; return n; });
    if (distErr) setDistErr("");
  };

  // ── New prize template ─────────────────────────────────────────────────────
  const newPrize = (): Prize => ({
    id: `prize-${Date.now().toString(36)}`,
    name: "",
    short: "",
    image_url: "",
    is_win: true,
    probability: 0,
    sort_order: prizes.length,
  });

  // ── Save prize metadata ────────────────────────────────────────────────────
  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.short || !editing.image_url) {
      toast.error("Fill in the prize name, short label, and upload an image.");
      return;
    }
    setBusy(true);
    setSaveErr("");
    try {
      const { probability: _prob, ...prizeData } = editing;
      await doUpsert({
        data: {
          shopId: shop.id,
          prize: prizeData as Parameters<typeof doUpsert>[0]["data"]["prize"],
          ...(campaignId ? { campaignId } : {}),
        },
      });
      setEditing(null);
      invalidatePrizes();
    } catch (e) {
      setSaveErr(
        parseServerValidationError(e) ??
          (e instanceof Error ? e.message : "Failed to save prize"),
      );
    } finally {
      setBusy(false);
    }
  };

  // ── Delete prize ───────────────────────────────────────────────────────────
  const remove   = (id: string) => setDeleteId(id);
  const doRemove = async (id: string) => {
    await doDelete({ data: { shopId: shop.id, id } });
    invalidatePrizes();
  };

  // ── Image upload ───────────────────────────────────────────────────────────
  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !editing) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB."); return; }
    const r = new FileReader();
    r.onload = () => setEditing({ ...editing, image_url: r.result as string });
    r.readAsDataURL(f);
  };

  // ── Save distribution ──────────────────────────────────────────────────────
  const saveDistribution = async () => {
    setDistErr("");
    if (prizes.length === 0) return;

    // Client-side pre-flight (server enforces the same rules)
    const belowMin = prizes.filter((p) => p.probability < minProb);
    if (belowMin.length > 0) {
      const msg = `Every prize must be at least ${minProb}% (platform minimum).`;
      toast.error(msg);
      setDistErr(msg);
      return;
    }
    if (total !== 100) {
      const msg = `Distribution must equal exactly 100%. Currently ${total}%.`;
      toast.error(msg);
      setDistErr(msg);
      return;
    }

    setSavingDist(true);
    try {
      await doProbs({
        data: {
          shopId: shop.id,
          probs: prizes.map((p) => ({ id: p.id, probability: p.probability })),
        },
      });
      invalidatePrizes();
      toast.success("Distribution saved.");
    } catch (err) {
      const msg =
        parseServerValidationError(err) ??
        "Failed to save distribution. Please try again.";
      toast.error(msg);
      setDistErr(msg);
      // Revert optimistic updates on failure
      invalidatePrizes();
    } finally {
      setSavingDist(false);
    }
  };

  // ── Modal layout helpers ───────────────────────────────────────────────────
  const outerPb   = Math.max(12, kbHeight);
  const modalMaxH = `calc(100dvh - ${outerPb + 12}px)`;
  const isExisting = editing ? !!prizes.find((p) => p.id === editing.id) : false;

  // ── Prize edit modal ───────────────────────────────────────────────────────
  // WHY PORTAL: .glass uses backdrop-filter which creates a CSS stacking context;
  // z-index inside it is scoped, so BottomNavigation (z-40 on the root) would
  // render on top. createPortal moves the modal to <body> giving it root-level
  // context where z-[200] safely beats z-40.
  const modal = editing ? (
    <div
      className="fixed inset-0 bg-black/70 z-[200] flex items-end sm:items-center justify-center"
      style={{ padding: `12px 12px ${outerPb}px` }}
    >
      <div
        className="glass rounded-2xl w-full max-w-sm flex flex-col overflow-hidden"
        style={{ maxHeight: modalMaxH }}
      >
        <div className="overflow-y-auto overscroll-contain flex-1 p-4 space-y-3">
          <p className="text-xs uppercase tracking-widest text-gold">
            {isExisting ? "Edit prize" : "New prize"}
          </p>

          {/* Image */}
          <div className="flex items-center gap-3">
            <img
              src={editing.image_url || DEFAULT_LOGO}
              alt=""
              className="w-16 h-16 rounded-lg object-cover bg-[#F5F7FA] text-[#0c2340]"
            />
            <label className="text-sm px-3 py-2 rounded-lg bg-white/5 cursor-pointer">
              Upload image
              <input type="file" accept="image/*" onChange={onImage} className="hidden" />
            </label>
          </div>

          {/* Name */}
          <input
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder="Prize name"
            maxLength={80}
            className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none"
          />

          {/* Short label */}
          <input
            value={editing.short}
            onChange={(e) => setEditing({ ...editing, short: e.target.value })}
            placeholder="Short label (for wheel)"
            maxLength={40}
            className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none"
          />

          {/* Win toggle */}
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={editing.is_win}
              onChange={(e) => setEditing({ ...editing, is_win: e.target.checked })}
            />
            Counts as win
          </label>

          {/* Sort order */}
          <label className="block text-sm">
            Sort order
            <input
              type="number"
              min={0}
              max={1000}
              value={editing.sort_order}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  sort_order: parseInt(e.target.value || "0") || 0,
                })
              }
              className="w-full mt-1 bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none"
            />
          </label>

          {!isExisting && (
            <p className="text-[11px] text-[#6b7a93] italic leading-relaxed">
              This prize will be added with {minProb > 0 ? `${minProb}%` : "0%"} probability.
              Adjust the distribution below after saving.
            </p>
          )}

          {saveErr && <p className="text-destructive text-sm">{saveErr}</p>}
        </div>

        <div
          className="flex gap-2 px-4 pt-3 border-t border-white/10 shrink-0"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={() => setEditing(null)}
            className="flex-1 py-2.5 rounded-lg bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg gradient-primary text-white font-bold disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save Prize"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {prizes.length} prize{prizes.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setEditing(newPrize())}
          className="px-3 py-2 rounded-lg bg-primary text-white font-bold text-sm"
        >
          + Add Prize
        </button>
      </div>

      {/* ── Platform minimum notice ── */}
      {minProb > 0 && prizes.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-blue-500/5 border border-blue-400/15 px-3 py-2.5">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-300 leading-relaxed">
            Platform minimum:{" "}
            <span className="font-semibold">{minProb}%</span> per prize.
            Adjusting one prize automatically rebalances all others.
          </p>
        </div>
      )}

      {/* ── Empty state ── */}
      {prizes.length === 0 && !isFetching && (
        <div className="rounded-xl border border-white/10 p-8 text-center space-y-1.5">
          <p className="text-sm font-medium text-white/60">No prizes yet</p>
          <p className="text-xs text-white/30">
            Add your first prize to start building a distribution.
          </p>
        </div>
      )}

      {/* ── Distribution Editor ── */}
      {prizes.length > 0 && (
        <div className="space-y-3">

          {prizes.map((p) => {
            const err = prizeErr[p.id];
            return (
              <div
                key={p.id}
                className={`rounded-xl p-4 space-y-3 transition-all duration-200 ${
                  err
                    ? "bg-red-500/5 border border-red-400/30 ring-1 ring-red-400/20"
                    : "glass border border-white/5"
                }`}
              >
                {/* ── Prize identity row ── */}
                <div className="flex items-center gap-3">
                  <img
                    src={p.image_url || DEFAULT_LOGO}
                    alt=""
                    className="w-11 h-11 rounded-lg object-cover bg-[#F5F7FA] text-[#0c2340] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-snug truncate">{p.name}</p>
                    <span
                      className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${
                        p.is_win
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-white/8 text-white/40"
                      }`}
                    >
                      {p.is_win ? "Win" : "Try again"}
                    </span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => setEditing(p)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* ── Probability controls ── */}
                <div className="space-y-2">
                  {/* Row: −1 · numeric input · % · +1 · slider */}
                  <div className="flex items-center gap-2">
                    {/* −1 button */}
                    <button
                      aria-label="Decrease by 1%"
                      onClick={() => applyProb(p.id, Math.max(0, p.probability - 1))}
                      className="w-7 h-7 rounded-md bg-white/6 hover:bg-white/12 flex items-center justify-center transition-colors shrink-0"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    {/* Numeric input */}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={p.probability}
                      onChange={(e) => {
                        const raw = parseInt(e.target.value || "0") || 0;
                        applyProb(p.id, Math.min(100, Math.max(0, raw)));
                      }}
                      className="w-14 bg-[#F5F7FA] text-[#0c2340] font-bold text-sm border border-[#0c2340]/10 rounded-lg px-1.5 py-1.5 outline-none text-center shrink-0"
                    />
                    <span className="text-sm font-semibold text-white/40 shrink-0">%</span>

                    {/* +1 button */}
                    <button
                      aria-label="Increase by 1%"
                      onClick={() => applyProb(p.id, Math.min(100, p.probability + 1))}
                      className="w-7 h-7 rounded-md bg-white/6 hover:bg-white/12 flex items-center justify-center transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    {/* Slider */}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={p.probability}
                      onChange={(e) => applyProb(p.id, parseInt(e.target.value))}
                      className="flex-1 accent-[#FF6B1A] min-w-0"
                    />
                  </div>

                  {/* Per-prize error or estimated winners */}
                  <p
                    className={`text-[11px] leading-snug transition-colors ${
                      err ? "text-red-400 font-medium" : "text-[#6b7a93]"
                    }`}
                  >
                    {err ?? estimatedWinners(p.probability)}
                  </p>
                </div>
              </div>
            );
          })}

          {/* ── Distribution Total Card ── */}
          <div
            className={`rounded-xl p-4 space-y-3 border transition-all duration-300 ${
              isBalanced
                ? "bg-emerald-500/8 border-emerald-400/25"
                : "bg-[#0c2340]/40 border-white/8"
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-white/40">
                  Distribution
                </p>
                {/* Tooltip */}
                <div className="relative group">
                  <Info className="w-3 h-3 text-white/25 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-1.5 w-64 p-2.5 bg-[#0c2340] text-white text-[11px] leading-relaxed rounded-lg shadow-xl z-10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                    Adjusting any prize automatically rebalances the others to
                    keep the total at exactly 100%. Actual outcomes are random —
                    probabilities reflect long-run averages.
                  </div>
                </div>
              </div>

              {/* Status badge */}
              {isBalanced ? (
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  100% ✓ Balanced
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  {total}% — not balanced
                </span>
              )}
            </div>

            {/* Segmented progress bar — one segment per prize, proportional width */}
            <div className="h-2.5 rounded-full bg-white/8 overflow-hidden flex gap-px">
              {prizes.map((p, i) => {
                // Distinct hues cycling through a palette
                const hues = [22, 160, 210, 270, 340, 45, 130, 190];
                const hue  = hues[i % hues.length];
                return (
                  <div
                    key={p.id}
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${p.probability}%`,
                      backgroundColor: `hsl(${hue}, 75%, 60%)`,
                    }}
                    title={`${p.name}: ${p.probability}%`}
                  />
                );
              })}
            </div>

            {/* Per-prize legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {prizes.map((p, i) => {
                const hues = [22, 160, 210, 270, 340, 45, 130, 190];
                const hue  = hues[i % hues.length];
                return (
                  <div key={p.id} className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: `hsl(${hue}, 75%, 60%)` }}
                    />
                    <span className="text-[10px] text-white/50 truncate max-w-[80px]">
                      {p.name} {p.probability}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Save button */}
            <button
              onClick={saveDistribution}
              disabled={!isBalanced || savingDist}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                isBalanced && !savingDist
                  ? "gradient-primary text-white shadow-lg hover:opacity-90 active:scale-[0.99]"
                  : "bg-white/4 text-white/25 cursor-not-allowed"
              }`}
            >
              {savingDist ? "Saving…" : "Save Distribution"}
            </button>

            {distErr && (
              <p className="text-xs text-red-400 text-center leading-relaxed">{distErr}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Prize edit modal (portal to body) ── */}
      {typeof document !== "undefined" && createPortal(modal, document.body)}

      {/* ── Delete confirmation ── */}
      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          const id = deleteId!;
          setDeleteId(null);
          doRemove(id);
        }}
        title="Delete this prize?"
        description="This will permanently remove the prize from the distribution and cannot be undone."
        confirmLabel="Delete prize"
        variant="danger"
      />
    </div>
  );
}

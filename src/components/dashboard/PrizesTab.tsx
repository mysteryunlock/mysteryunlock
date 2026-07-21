import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
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
// Helper: human-readable estimated winners string for a given probability value.
// ─────────────────────────────────────────────────────────────────────────────
function estimatedWinners(prob: number): string {
  if (prob <= 0) return "Not included in distribution";
  if (prob >= 100) return "Guaranteed every eligible spin";
  return `≈ ${prob} winner${prob === 1 ? "" : "s"} per 100 spins`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PrizesTab
// ─────────────────────────────────────────────────────────────────────────────
export function PrizesTab({ shop, campaignId }: { shop: Shop; campaignId?: string | null }) {
  const doUpsert = useServerFn(upsertPrize);
  const doDelete = useServerFn(deletePrize);
  const doProbs  = useServerFn(updateProbabilities);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Prizes are fetched via TanStack Query and shared with CampaignHub via the
  // same cache key, so switching tabs is instant (no extra network request).
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
  const [editing, setEditing]     = useState<Prize | null>(null);
  const [busy, setBusy]           = useState(false);
  const [saveErr, setSaveErr]     = useState("");

  // ── Distribution save state ────────────────────────────────────────────────
  const [savingDist, setSavingDist] = useState(false);
  const [distErr, setDistErr]       = useState("");

  // ── Keyboard height (visual viewport API) ─────────────────────────────────
  // Keeps the modal footer above the soft keyboard on Android/iOS.
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
  // Platform minimum: 0 = no minimum (merchants may use any value 0–100).
  const minProb: number = shop.minimum_probability ?? 5;

  // Live distribution total from the optimistically-updated TanStack Query cache.
  const total     = prizes.reduce((s, p) => s + (p.probability ?? 0), 0);
  const remaining = 100 - total;

  // A prize is valid when its probability >= the platform minimum.
  const belowMinPrizes = prizes.filter((p) => p.probability < minProb);
  const isDistributionValid =
    prizes.length > 0 && total === 100 && belowMinPrizes.length === 0;

  // ── New prize template ─────────────────────────────────────────────────────
  // probability is a dummy value here — the server sets effectiveMin for new
  // prizes and ignores any probability field in the upsertPrize schema.
  const newPrize = (): Prize => ({
    id: `prize-${Date.now().toString(36)}`,
    name: "",
    short: "",
    image_url: "",
    is_win: true,
    probability: 0,
    sort_order: prizes.length,
  });

  // ── Optimistic probability update ─────────────────────────────────────────
  // Writes directly into the TanStack Query cache so the slider feels instant.
  // The cache is confirmed/corrected after saveDistribution calls invalidatePrizes().
  const updateProb = (id: string, v: number) => {
    qc.setQueryData(
      myPrizesQueryKey(shop.id, campaignId),
      (old: Prize[] = []) =>
        old.map((p) => (p.id === id ? { ...p, probability: v } : p)),
    );
    // Clear any saved distribution error when the merchant starts adjusting
    if (distErr) setDistErr("");
  };

  // ── Save prize metadata ────────────────────────────────────────────────────
  // Probability is NOT included — it belongs to the distribution editor.
  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.short || !editing.image_url) {
      toast.error("Fill in the prize name, short label, and upload an image.");
      return;
    }
    setBusy(true);
    setSaveErr("");
    try {
      // Strip probability from the payload — upsertPrize only accepts metadata
      // and the server manages probability for new vs. existing prizes.
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

    // Client-side pre-flight (mirrors server validation for instant feedback)
    if (belowMinPrizes.length > 0) {
      const msg = `This prize cannot be below the platform minimum of ${minProb}%.`;
      toast.error(msg);
      setDistErr(msg);
      return;
    }
    if (total !== 100) {
      const msg =
        total < 100
          ? `The total probability must equal exactly 100%. Your current total is ${total}%. Add ${100 - total}% before saving.`
          : `The total probability must equal exactly 100%. Your current total is ${total}%. Remove ${total - 100}% before saving.`;
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
  // outerPb = keyboard height (pushes modal above keyboard on mobile).
  // modalMaxH = prevents modal overflowing the visible area.
  const outerPb   = Math.max(12, kbHeight);
  const modalMaxH = `calc(100dvh - ${outerPb + 12}px)`;
  const isExisting = editing ? !!prizes.find((p) => p.id === editing.id) : false;

  // ── Prize edit modal ───────────────────────────────────────────────────────
  // Only edits metadata: name, short label, image, win/try-again, sort order.
  // Probability is managed exclusively in the distribution editor below.
  //
  // WHY PORTAL: .glass uses backdrop-filter which creates a CSS stacking
  // context; z-index inside it is scoped, so the BottomNavigation (z-40 on
  // the document root) would render on top.  createPortal moves the modal to
  // <body> giving it a root-level context where z-[200] safely beats z-40.
  const modal = editing ? (
    <div
      className="fixed inset-0 bg-black/70 z-[200] flex items-end sm:items-center justify-center"
      style={{ padding: `12px 12px ${outerPb}px` }}
    >
      <div
        className="glass rounded-2xl w-full max-w-sm flex flex-col overflow-hidden"
        style={{ maxHeight: modalMaxH }}
      >
        {/* Scrollable body */}
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

          {/* Probability note for new prizes */}
          {!isExisting && (
            <p className="text-[11px] text-[#6b7a93] italic leading-relaxed">
              This prize will be added with {minProb > 0 ? `${minProb}%` : "0%"} probability.
              Adjust the full distribution in the editor below after saving.
            </p>
          )}

          {saveErr && <p className="text-destructive text-sm">{saveErr}</p>}
        </div>

        {/* Sticky footer */}
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
            No prize may be set below this value.
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

          {/* One card per prize */}
          {prizes.map((p) => {
            const isBelowMin = p.probability < minProb;
            return (
              <div
                key={p.id}
                className={`rounded-xl p-4 space-y-3 transition-all duration-200 ${
                  isBelowMin
                    ? "bg-red-500/5 border border-red-400/30 ring-1 ring-red-400/20"
                    : "glass border border-white/5"
                }`}
              >
                {/* Prize identity row */}
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

                {/* Probability row */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    {/* Numeric input */}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={p.probability}
                      onChange={(e) => {
                        const raw = parseInt(e.target.value || "0") || 0;
                        updateProb(p.id, Math.min(100, Math.max(0, raw)));
                      }}
                      className="w-16 bg-[#F5F7FA] text-[#0c2340] font-bold text-sm border border-[#0c2340]/10 rounded-lg px-2 py-1.5 outline-none text-center"
                    />
                    <span className="text-sm font-semibold text-white/50">%</span>
                    {/* Slider */}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={p.probability}
                      onChange={(e) => updateProb(p.id, parseInt(e.target.value))}
                      className="flex-1 accent-[#FF6B1A]"
                    />
                  </div>

                  {/* Estimated winners / error */}
                  <p
                    className={`text-[11px] leading-snug ${
                      isBelowMin ? "text-red-400 font-medium" : "text-[#6b7a93]"
                    }`}
                  >
                    {isBelowMin
                      ? `This prize cannot be below the platform minimum of ${minProb}%.`
                      : estimatedWinners(p.probability)}
                  </p>
                </div>
              </div>
            );
          })}

          {/* ── Distribution Total Card ── */}
          <div
            className={`rounded-xl p-4 space-y-3 border transition-all duration-300 ${
              isDistributionValid
                ? "bg-emerald-500/8 border-emerald-400/25"
                : total > 100
                ? "bg-red-500/8 border-red-400/25"
                : "bg-[#0c2340]/40 border-white/8"
            }`}
          >
            {/* Total + status */}
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-white/40">
                    Distribution
                  </p>
                  <div className="relative group">
                    <Info className="w-3 h-3 text-white/25 cursor-help" />
                    <div className="absolute left-0 bottom-full mb-1.5 w-64 p-2.5 bg-[#0c2340] text-white text-[11px] leading-relaxed rounded-lg shadow-xl z-10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                      Probability controls how often each prize is expected to be awarded over many spins. All prizes must sum to exactly 100%. Actual results remain random and individual outcomes may vary.
                    </div>
                  </div>
                </div>
                <p
                  className={`text-4xl font-black tabular-nums ${
                    total > 100
                      ? "text-red-400"
                      : total === 100
                      ? "text-emerald-400"
                      : "text-white/80"
                  }`}
                >
                  {total}%
                </p>
              </div>
              <div className="text-right pb-1">
                {isDistributionValid ? (
                  <div className="space-y-0.5">
                    <p className="text-xs text-emerald-400 font-semibold">✅ Distribution complete</p>
                    <p className="text-[11px] text-emerald-400/70">Ready to save.</p>
                  </div>
                ) : total > 100 ? (
                  <div className="space-y-0.5">
                    <p className="text-xs text-red-400 font-semibold">❌ Over by {total - 100}%</p>
                    <p className="text-[11px] text-red-400/70">Remove {total - 100}% before saving.</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-xs text-white/50 font-semibold">❌ {remaining}% remaining</p>
                    <p className="text-[11px] text-white/30">Add {remaining}% more before saving.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-white/8 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  total > 100
                    ? "bg-red-400"
                    : total === 100
                    ? "bg-emerald-400"
                    : "bg-[#FF6B1A]"
                }`}
                style={{ width: `${Math.min(100, total)}%` }}
              />
            </div>

            {/* Save button */}
            <button
              onClick={saveDistribution}
              disabled={!isDistributionValid || savingDist}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                isDistributionValid && !savingDist
                  ? "gradient-primary text-white shadow-lg hover:opacity-90 active:scale-[0.99]"
                  : "bg-white/4 text-white/25 cursor-not-allowed"
              }`}
            >
              {savingDist
                ? "Saving…"
                : isDistributionValid
                ? "Save Distribution ✓"
                : total === 0
                ? "Set probabilities to save"
                : `${total}/100% — Complete distribution to save`}
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

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
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

export function PrizesTab({ shop, campaignId }: { shop: Shop; campaignId?: string | null }) {
  const doUpsert = useServerFn(upsertPrize);
  const doDelete = useServerFn(deletePrize);
  const doProbs = useServerFn(updateProbabilities);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Prizes are fetched via TanStack Query and shared with CampaignHub via the
  // same cache key.  On first mount after campaign selection is known the data
  // is already in the cache, so this renders without any network request.
  const { data: prizes = [], isFetching } = useMyPrizes(shop.id, campaignId);
  const invalidatePrizes = useInvalidateMyPrizes(shop.id);

  // Used for optimistic probability slider updates — avoids a round-trip on
  // every slider tick while still keeping the cache consistent after saveProbs.
  const qc = useQueryClient();

  // ── PERF AUDIT T8: measure time from click to first meaningful render ──────
  // fires once on the first render where prizes are available.
  // fromCache=true when queryFn never ran (isFetching stays false throughout).
  const hasRenderedRef = useRef(false);
  useEffect(() => {
    if (!hasRenderedRef.current && prizes.length > 0) {
      hasRenderedRef.current = true;
      PrizesPerf.markPrizesTabFirstRender(prizes.length, !isFetching);
    }
  }, [prizes, isFetching]);

  const [editing, setEditing] = useState<Prize | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // Keyboard height tracking via Visual Viewport API.
  // When the on-screen keyboard opens the visual viewport shrinks. We measure
  // the gap between the layout viewport (window.innerHeight) and the visual
  // viewport bottom edge (offsetTop + height) — that gap IS the keyboard.
  // We use this to push the modal card up above the keyboard in real-time,
  // keeping the Save button always visible while typing on both Android and iOS.
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

  const newPrize = (): Prize => ({
    id: `prize-${Date.now().toString(36)}`,
    name: "",
    short: "",
    image_url: "",
    is_win: true,
    probability: 10,
    sort_order: prizes.length,
  });

  const minProb: number = shop.minimum_probability ?? 0;

  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.short || !editing.image_url) { toast.error("Fill name, short label, and image."); return; }
    // Enforce minimum probability (0 = disabled prize, always allowed)
    if (minProb > 0 && editing.probability > 0 && editing.probability < minProb) {
      setSaveErr(`Your minimum allowed probability is ${minProb}%. Contact the platform administrator if you need a lower value.`);
      return;
    }
    setBusy(true);
    setSaveErr("");
    try {
      await doUpsert({ data: { shopId: shop.id, prize: editing, ...(campaignId ? { campaignId } : {}) } });
      setEditing(null);
      invalidatePrizes();
    } catch (e) {
      setSaveErr(parseServerValidationError(e) ?? (e instanceof Error ? e.message : "Failed to save prize"));
    } finally { setBusy(false); }
  };

  const remove = (id: string) => setDeleteId(id);
  const doRemove = async (id: string) => {
    await doDelete({ data: { shopId: shop.id, id } });
    invalidatePrizes();
  };

  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !editing) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB."); return; }
    const r = new FileReader();
    r.onload = () => setEditing({ ...editing, image_url: r.result as string });
    r.readAsDataURL(f);
  };

  // Optimistic probability update: writes directly into the TanStack Query
  // cache so the slider feels instant without a server round-trip on each tick.
  // The cache is confirmed/corrected after saveProbs calls invalidatePrizes().
  const updateProb = (id: string, v: number) => {
    qc.setQueryData(
      myPrizesQueryKey(shop.id, campaignId),
      (old: Prize[] = []) => old.map((p) => (p.id === id ? { ...p, probability: v } : p)),
    );
  };

  const saveProbs = async () => {
    // Client-side minimum guard before network call
    if (minProb > 0) {
      const violations = prizes.filter((p) => p.probability > 0 && p.probability < minProb);
      if (violations.length > 0) {
        toast.error(`All prize weights must be at least ${minProb}. Adjust the sliders or edit individual prizes.`);
        return;
      }
    }
    await doProbs({ data: { shopId: shop.id, probs: prizes.map((p) => ({ id: p.id, probability: p.probability })) } });
    invalidatePrizes();
    toast.success("Odds saved.");
  };

  // The outer padding-bottom equals the keyboard height (pushes the modal above
  // the keyboard). When no keyboard is open kbHeight = 0 and we fall back to
  // p-3 (12 px). On desktop sm:items-center overrides items-end centering.
  const outerPb = Math.max(12, kbHeight);

  // Modal max-height: full layout viewport minus keyboard height minus top/bottom
  // padding so the card never overflows the visible area.
  const modalMaxH = `calc(100dvh - ${outerPb + 12}px)`;

  const modal = editing ? (
    /*
     * Rendered via createPortal at document.body.
     *
     * WHY PORTAL: the .glass class uses backdrop-filter which creates a CSS
     * stacking context. Any z-index inside that context is scoped to it, not
     * the document root. The BottomNavigation sits at z-40 on the document
     * root — outside the glass stacking context — so it renders on top of a
     * z-50 modal that lives inside a glass ancestor. createPortal moves the
     * modal to <body>, giving it its own root-level stacking context where
     * z-[200] safely beats z-40.
     *
     * WHY VISUAL VIEWPORT: on Android Chrome the keyboard is an overlay that
     * does NOT shrink the layout viewport (unlike iOS where it does). Fixed
     * elements use the layout viewport for positioning, so items-end keeps
     * the modal at the bottom of the full-height backdrop — behind the
     * keyboard. We measure the keyboard height from visualViewport and apply
     * it as padding-bottom so the modal card rises above the keyboard
     * dynamically on both platforms.
     */
    <div
      className="fixed inset-0 bg-black/70 z-[200] flex items-end sm:items-center justify-center"
      style={{ padding: `12px 12px ${outerPb}px` }}
    >
      <div
        className="glass rounded-2xl w-full max-w-sm flex flex-col overflow-hidden"
        style={{ maxHeight: modalMaxH }}
      >
        {/* Scrollable form body */}
        <div className="overflow-y-auto overscroll-contain flex-1 p-4 space-y-2">
          <p className="text-xs uppercase tracking-widest text-gold">
            {prizes.find((p) => p.id === editing.id) ? "Edit prize" : "New prize"}
          </p>
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
          <input
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder="Prize name"
            maxLength={80}
            className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none"
          />
          <input
            value={editing.short}
            onChange={(e) => setEditing({ ...editing, short: e.target.value })}
            placeholder="Short label (for wheel)"
            maxLength={40}
            className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={editing.is_win}
                onChange={(e) => setEditing({ ...editing, is_win: e.target.checked })}
              />
              Counts as win
            </label>
          </div>
          <div className="flex gap-2 text-sm">
            <label className="flex-1">
              Weight (odds)
              <input
                type="number"
                min={0}
                max={1000}
                value={editing.probability}
                onChange={(e) => setEditing({ ...editing, probability: parseInt(e.target.value || "0") })}
                className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none"
              />
            </label>
            <label className="flex-1">
              Sort order
              <input
                type="number"
                min={0}
                max={1000}
                value={editing.sort_order}
                onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value || "0") })}
                className="w-full bg-[#F5F7FA] text-[#0c2340] placeholder:text-[#6b7a93] border border-[#0c2340]/10 rounded-lg px-3 py-2 outline-none"
              />
            </label>
          </div>
          {saveErr && <p className="text-destructive text-sm">{saveErr}</p>}
        </div>

        {/* Sticky footer — always visible above keyboard */}
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{prizes.length} prizes</p>
        <button
          onClick={() => setEditing(newPrize())}
          className="px-3 py-2 rounded-lg bg-primary text-white font-bold text-sm"
        >
          + Add prize
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {prizes.map((p) => (
          <div key={p.id} className="glass rounded-xl p-3 flex gap-3 items-center">
            <img src={p.image_url} alt="" className="w-14 h-14 rounded-lg object-cover bg-[#F5F7FA] text-[#0c2340]" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.is_win ? "Win" : "Try again"} · weight {p.probability}</p>
              <input
                type="range"
                min={p.probability === 0 ? 0 : minProb}
                max={100}
                value={p.probability}
                onChange={(e) => updateProb(p.id, parseInt(e.target.value))}
                className="w-full mt-1"
              />
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => setEditing(p)} className="text-xs px-2 py-1 rounded bg-white/5">Edit</button>
              <button onClick={() => remove(p.id)} className="text-xs px-2 py-1 rounded bg-destructive/20 text-destructive">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {prizes.length > 0 && (
        <button onClick={saveProbs} className="w-full py-2 rounded-lg bg-white/5 text-sm">
          Save odds
        </button>
      )}

      {typeof document !== "undefined" && createPortal(modal, document.body)}

      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { const id = deleteId!; setDeleteId(null); doRemove(id); }}
        title="Delete this prize?"
        description="This will permanently remove the prize and cannot be undone."
        confirmLabel="Delete prize"
        variant="danger"
      />
    </div>
  );
}

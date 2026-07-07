import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DollarSign, Loader2, Plus, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import {
  recordPurchaseFn,
  getCustomerPurchasesFn,
  PURCHASE_CATEGORIES,
} from "@/lib/purchases.functions";
import type { Purchase, CustomerPurchaseStats } from "@/lib/purchases.functions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── Record Purchase Modal ─────────────────────────────────────────────────────

type ModalProps = {
  shopId: string;
  customerId: string;
  memberName: string;
  onSaved: (purchase: Purchase, stats: CustomerPurchaseStats) => void;
  onClose: () => void;
};

function RecordPurchaseModal({ shopId, customerId, memberName, onSaved, onClose }: ModalProps) {
  const record = useServerFn(recordPurchaseFn);

  const [amount, setAmount]     = useState("");
  const [category, setCategory] = useState<string>("General");
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");

  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => { amountRef.current?.focus(); }, []);

  const close = () => { if (!saving) onClose(); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const parsed = parseFloat(amount.replace(/,/g, ""));
    if (isNaN(parsed) || parsed <= 0) { setErr("Enter a valid amount greater than 0."); return; }
    if (parsed > 999999.99)           { setErr("Amount is too large."); return; }
    setSaving(true);
    try {
      const res = await record({
        data: { shopId, customerId, amount: parsed, category, notes: notes.trim() || undefined },
      });
      toast.success("Purchase recorded");
      onSaved(res.purchase, res.stats);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to save purchase.");
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rp-title"
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[61] bg-white rounded-2xl shadow-2xl max-w-sm mx-auto"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#0c2340]/8">
          <div>
            <h3 id="rp-title" className="text-base font-bold text-[#0c2340]">Record Purchase</h3>
            <p className="text-xs text-[#4a5b78] mt-0.5 truncate">{memberName}</p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={saving}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-[#F5F7FA] hover:bg-[#ECEFF5] grid place-items-center text-[#4a5b78] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Amount */}
          <div>
            <label htmlFor="rp-amount" className="block text-xs font-semibold text-[#0c2340] mb-1.5">
              Amount *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a5b78]" />
              <input
                id="rp-amount"
                ref={amountRef}
                type="number"
                step="0.01"
                min="0.01"
                max="999999.99"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#0c2340]/15 text-sm text-[#0c2340] placeholder:text-[#4a5b78]/50 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30 focus:border-[#FF6B00]/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="rp-category" className="block text-xs font-semibold text-[#0c2340] mb-1.5">
              Category *
            </label>
            <select
              id="rp-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#0c2340]/15 text-sm text-[#0c2340] bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30"
            >
              {PURCHASE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="rp-notes" className="block text-xs font-semibold text-[#0c2340] mb-1.5">
              Notes <span className="font-normal text-[#4a5b78]">(optional)</span>
            </label>
            <textarea
              id="rp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="e.g. monthly haircut, lunch for 2…"
              className="w-full px-3 py-2.5 rounded-xl border border-[#0c2340]/15 text-sm text-[#0c2340] placeholder:text-[#4a5b78]/50 resize-none focus:outline-none focus:ring-2 focus:ring-[#FF6B00]/30"
            />
          </div>

          {err && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#e85f00] text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
            {saving ? "Saving…" : "Save Purchase"}
          </button>
        </form>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  shopId: string;
  customerId: string;
  memberName: string;
};

export function MemberPurchasesSection({ shopId, customerId, memberName }: Props) {
  const fetchPurchases = useServerFn(getCustomerPurchasesFn);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stats, setStats]         = useState<CustomerPurchaseStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPurchases({ data: { shopId, customerId } });
      setPurchases(res.purchases);
      setStats(res.stats);
    } catch {
      // Non-fatal: new table might not exist yet
    } finally {
      setLoading(false);
    }
  }, [fetchPurchases, shopId, customerId]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (purchase: Purchase, newStats: CustomerPurchaseStats) => {
    setPurchases((prev) => [purchase, ...prev]);
    setStats(newStats);
    setShowModal(false);
  };

  return (
    <div className="pt-3 border-t border-[#0c2340]/8 space-y-3">
      {/* Header + button */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]/50">Purchases</p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF6B00] text-white text-xs font-bold shadow-sm hover:bg-[#e85f00] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Record Purchase
        </button>
      </div>

      {/* Stats KPIs */}
      {stats && stats.totalPurchases > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-[#0c2340]/8 px-3 py-2.5 text-center">
            <p className="text-[9px] uppercase tracking-wide text-[#4a5b78] font-semibold">Lifetime</p>
            <p className="text-sm font-black text-[#0c2340] mt-0.5">{fmtAmount(stats.lifetimeSpend)}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#0c2340]/8 px-3 py-2.5 text-center">
            <p className="text-[9px] uppercase tracking-wide text-[#4a5b78] font-semibold">Visits</p>
            <p className="text-sm font-black text-[#0c2340] mt-0.5">{stats.totalPurchases}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#0c2340]/8 px-3 py-2.5 text-center">
            <p className="text-[9px] uppercase tracking-wide text-[#4a5b78] font-semibold">Avg</p>
            <p className="text-sm font-black text-[#FF6B00] mt-0.5">{fmtAmount(stats.avgOrderValue)}</p>
          </div>
        </div>
      )}

      {/* Purchase list */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-[#0c2340]/5 animate-pulse" />
          ))}
        </div>
      ) : purchases.length === 0 ? (
        <p className="text-xs text-[#4a5b78] py-3 text-center">
          No purchases recorded yet. Tap <strong>Record Purchase</strong> to add the first one.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
          {purchases.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white border border-[#0c2340]/8"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#0c2340] truncate">{p.category}</p>
                <p className="text-[10px] text-[#4a5b78] mt-0.5">
                  {fmtDate(p.created_at)}
                  {p.notes ? <span className="opacity-70"> · {p.notes}</span> : null}
                </p>
              </div>
              <p className="text-sm font-black text-[#FF6B00] shrink-0 tabular-nums">
                {fmtAmount(p.amount)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <RecordPurchaseModal
          shopId={shopId}
          customerId={customerId}
          memberName={memberName}
          onSaved={handleSaved}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

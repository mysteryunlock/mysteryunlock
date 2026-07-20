import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Trophy, X } from "lucide-react";
import { getShopClaimsFn, markClaimRedeemedFn } from "@/lib/prize-claims.functions";
import { parseServerValidationError } from "@/lib/utils";
import { SkeletonRow } from "@/components/ds";
import type { Shop } from "./types";

type ClaimRow = {
  id: string;
  code: string;
  prize_name: string;
  status: string;
  claimed_at: string | null;
  created_at: string;
  claim_code: string;
  customers: { email: string; name: string | null; phone: string | null } | null;
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

const STATUS: Record<string, { label: string; cls: string }> = {
  unclaimed: { label: "Unclaimed", cls: "bg-amber-50 text-amber-700 border-amber-200/60"  },
  claimed:   { label: "Claimed",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200/60" },
  expired:   { label: "Expired",   cls: "bg-slate-100 text-slate-500 border-slate-200/60" },
};

function ClaimSkeleton() {
  return (
    <div className="p-4 bg-white border border-[#e8edf5] rounded-2xl shadow-sm animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#F0F2F5] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2 pt-0.5">
          <div className="h-3 w-32 rounded-full bg-[#F0F2F5]" />
          <div className="h-2.5 w-48 rounded-full bg-[#F0F2F5]" />
        </div>
        <div className="shrink-0 space-y-1.5">
          <div className="h-5 w-16 rounded-full bg-[#F0F2F5]" />
          <div className="h-4 w-20 rounded-full bg-[#F0F2F5]" />
        </div>
      </div>
    </div>
  );
}

export function ClaimsTab({ shop, onNavigate }: { shop: Shop; onNavigate?: (tab: import("./types").TabKey) => void }) {
  const fetchClaims = useServerFn(getShopClaimsFn);
  const doRedeem    = useServerFn(markClaimRedeemedFn);

  const [claims,     setClaims]     = useState<ClaimRow[]>([]);
  const [filter,     setFilter]     = useState<"all" | "unclaimed" | "claimed">("all");
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [redeeming,  setRedeeming]  = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetchClaims({
        data: { shopId: shop.id, ...(filter !== "all" ? { status: filter } : {}) },
      });
      setClaims(res.claims as ClaimRow[]);
    } catch (err) {
      setError(parseServerValidationError(err) ?? "Could not load claims.");
    } finally { setLoading(false); }
  }, [fetchClaims, shop.id, filter]);

  useEffect(() => { load(); }, [load]);

  const handleRedeem = async (claimId: string) => {
    setConfirming(null);
    setRedeeming(claimId);
    try {
      await doRedeem({ data: { claimId, shopId: shop.id } });
      setClaims((prev) => prev.map((c) =>
        c.id === claimId
          ? { ...c, status: "claimed", claimed_at: new Date().toISOString() }
          : c,
      ));
    } catch (err) {
      setError(parseServerValidationError(err) ?? "Could not update claim.");
    } finally { setRedeeming(null); }
  };

  const unclaimedCount = claims.filter((c) => c.status === "unclaimed").length;

  return (
    <div className="py-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-black text-[#0c2340] text-lg">Prize Claims</h2>
          <p className="text-xs text-[#6b7a93] mt-0.5">
            {loading ? "Loading…" : `${unclaimedCount} unclaimed · ${claims.length} total`}
          </p>
        </div>
        <div className="flex gap-1">
          {(["all", "unclaimed", "claimed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition min-h-[36px] ${
                filter === f
                  ? "bg-[#FF6B1A] text-white shadow-sm"
                  : "bg-[#F5F7FA] text-[#4a5b78] hover:bg-[#E8EDF5]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={load} className="text-xs font-semibold text-red-700 underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-2">
          <ClaimSkeleton />
          <ClaimSkeleton />
          <ClaimSkeleton />
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && claims.length === 0 && (
        <div className="rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] flex flex-col items-center justify-center py-14 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#FF6B1A]/8 grid place-items-center mb-4">
            <Trophy className="w-6 h-6 text-[#FF6B1A]" strokeWidth={1.5} />
          </div>
          <p className="font-bold text-[#0C2340]">No claims yet</p>
          <p className="text-sm text-[#6b7a93] mt-1.5 max-w-xs leading-relaxed">
            Prize claims appear here when customers sign in after winning and save their prize.
          </p>
          {onNavigate && (
            <button
              onClick={() => onNavigate("campaign")}
              className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#FF6B1A] text-white text-sm font-bold hover:opacity-90 transition-opacity active:scale-[0.98] min-h-[44px]"
            >
              Open Campaigns
            </button>
          )}
        </div>
      )}

      {/* ── Claims list ── */}
      {!loading && claims.length > 0 && (
        <div className="space-y-2">
          {claims.map((claim) => {
            const status       = STATUS[claim.status] ?? STATUS.unclaimed;
            const customerName = claim.customers?.name  || claim.customers?.email || "Unknown customer";
            const phone        = claim.customers?.phone ?? null;
            const isConfirming = confirming === claim.id;
            const isRedeeming  = redeeming  === claim.id;

            return (
              <div
                key={claim.id}
                className="p-4 bg-white border border-[#e8edf5] rounded-2xl shadow-sm hover:border-[#0C2340]/15 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Customer avatar */}
                  <div className="w-9 h-9 rounded-full bg-[#E8F0FF] flex items-center justify-center text-sm font-display font-black text-[#3D5066] shrink-0 mt-0.5">
                    {customerName.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#0c2340] truncate">{customerName}</p>
                    {phone && (
                      <p className="text-xs text-[#6b7a93] truncate">{phone}</p>
                    )}
                    {!phone && claim.customers?.email && claim.customers.name && (
                      <p className="text-xs text-[#9aaab9] truncate">{claim.customers.email}</p>
                    )}
                    <p className="text-xs text-[#6b7a93] mt-0.5 truncate">
                      <span className="font-semibold text-[#FF6B1A]">{claim.prize_name}</span>
                      {" · Won "}{fmt(claim.created_at)}
                      {claim.status === "claimed" && claim.claimed_at
                        ? <> · <span className="text-emerald-600">Claimed {fmt(claim.claimed_at)}</span></>
                        : null}
                    </p>
                  </div>

                  {/* Status + action */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border leading-none ${status.cls}`}>
                      {status.label}
                    </span>
                    {claim.status === "unclaimed" && !isConfirming && (
                      <button
                        onClick={() => setConfirming(claim.id)}
                        disabled={isRedeeming}
                        className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" />
                        Mark as Claimed
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline confirmation row */}
                {isConfirming && (
                  <div className="mt-3 pt-3 border-t border-[#e8edf5] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0c2340]">
                        Confirm prize handover?
                      </p>
                      <p className="text-[11px] text-[#6b7a93] mt-0.5">
                        Confirm this prize has been handed over to the customer.
                      </p>
                      <p className="text-[10px] text-[#9aaab9] mt-0.5">This cannot be undone.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setConfirming(null)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#F5F7FA] text-[#4a5b78] hover:bg-[#E8EDF5] transition min-h-[36px]"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </button>
                      <button
                        onClick={() => handleRedeem(claim.id)}
                        disabled={isRedeeming}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50 min-h-[36px]"
                      >
                        {isRedeeming
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Check className="w-3 h-3" />}
                        Confirm
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

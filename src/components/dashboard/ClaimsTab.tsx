import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, QrCode } from "lucide-react";
import { getShopClaimsFn, markClaimRedeemedFn } from "@/lib/prize-claims.functions";
import { parseServerValidationError } from "@/lib/utils";
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
  unclaimed: { label: "Unclaimed", cls: "bg-amber-500/15 text-amber-400" },
  claimed:   { label: "Redeemed",  cls: "bg-emerald-500/15 text-emerald-400" },
  expired:   { label: "Expired",   cls: "bg-white/8 text-muted-foreground" },
};

export function ClaimsTab({ shop }: { shop: Shop }) {
  const fetchClaims = useServerFn(getShopClaimsFn);
  const doRedeem    = useServerFn(markClaimRedeemedFn);

  const [claims,    setClaims]    = useState<ClaimRow[]>([]);
  const [filter,    setFilter]    = useState<"all" | "unclaimed" | "claimed">("all");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [redeeming, setRedeeming] = useState<string | null>(null);

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
    if (!confirm("Mark this prize as redeemed? This cannot be undone.")) return;
    setRedeeming(claimId);
    try {
      await doRedeem({ data: { claimId, shopId: shop.id } });
      setClaims((prev) => prev.map((c) =>
        c.id === claimId
          ? { ...c, status: "claimed", claimed_at: new Date().toISOString() }
          : c
      ));
    } catch (err) {
      setError(parseServerValidationError(err) ?? "Could not update claim.");
    } finally { setRedeeming(null); }
  };

  const unclaimedCount = claims.filter((c) => c.status === "unclaimed").length;

  return (
    <div className="py-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-[#0c2340] text-lg">Prize Claims</h2>
          <p className="text-sm text-[#6b7a93] mt-0.5">
            {unclaimedCount} unclaimed · {claims.length} total
          </p>
        </div>
        {/* Filter */}
        <div className="flex gap-1">
          {(["all", "unclaimed", "claimed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
                filter === f
                  ? "bg-[#FF6B00] text-white"
                  : "bg-[#F5F7FA] text-[#4a5b78] hover:bg-[#E8EDF5]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">
          {error}
          <button onClick={load} className="ml-2 underline text-xs">Retry</button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10 text-[#6b7a93]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      )}

      {!loading && claims.length === 0 && (
        <div className="text-center py-10">
          <QrCode className="w-10 h-10 text-[#c5cfd9] mx-auto mb-3" />
          <p className="font-semibold text-[#0c2340]">No claims yet</p>
          <p className="text-sm text-[#6b7a93] mt-1 max-w-xs mx-auto">
            Prize claims appear here when customers sign in after winning and save their prize.
          </p>
        </div>
      )}

      {!loading && claims.length > 0 && (
        <div className="space-y-2">
          {claims.map((claim) => {
            const status = STATUS[claim.status] ?? STATUS.unclaimed;
            const customerLabel = claim.customers?.name || claim.customers?.email || "Unknown customer";
            return (
              <div
                key={claim.id}
                className="flex items-center gap-3 p-4 bg-white border border-[#e8edf5] rounded-2xl shadow-sm"
              >
                {/* Customer avatar */}
                <div className="w-9 h-9 rounded-full bg-[#E8F0FF] flex items-center justify-center text-sm font-bold text-[#3D5066] shrink-0">
                  {customerLabel.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#0c2340] truncate">{customerLabel}</p>
                  <p className="text-xs text-[#6b7a93] truncate">
                    <span className="font-medium text-[#FF6B00]">{claim.prize_name}</span>
                    {" · "}{fmt(claim.created_at)}
                  </p>
                  {claim.customers?.email && claim.customers.name && (
                    <p className="text-[10px] text-[#9aaab9] truncate">{claim.customers.email}</p>
                  )}
                </div>

                {/* Status + action */}
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${status.cls}`}>
                    {status.label}
                  </span>
                  {claim.status === "unclaimed" && (
                    <button
                      onClick={() => handleRedeem(claim.id)}
                      disabled={redeeming === claim.id}
                      className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition disabled:opacity-50"
                    >
                      {redeeming === claim.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Check className="w-3 h-3" />
                      }
                      Redeem
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { Check, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";
import type { PrizeClaim } from "@/lib/prize-claims.functions";

type Props = {
  claim: PrizeClaim;
};

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  unclaimed: { label: "Unclaimed",  cls: "bg-gold/15 text-gold" },
  claimed:   { label: "Claimed",   cls: "bg-emerald-500/15 text-emerald-600" },
  expired:   { label: "Expired",    cls: "bg-muted text-muted-foreground" },
};

export function PrizeClaimCard({ claim }: Props) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(claim.claim_code.toUpperCase());
      setCopied(true);
      toast.success("Claim code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  };

  const goToDetail = () => {
    navigate({ to: "/portal/prizes/$claimId", params: { claimId: claim.id } });
  };

  const status = STATUS_LABEL[claim.status] ?? STATUS_LABEL.unclaimed;
  const isClaimed = claim.status === "claimed";
  const isExpired  = claim.status === "expired";

  const daysUntilExpiry = claim.expires_at
    ? Math.ceil((new Date(claim.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7;

  return (
    <div className={`rounded-2xl border p-5 space-y-4 shadow-sm ${
      isClaimed ? "border-emerald-500/25 bg-emerald-500/5" : "border-border bg-card"
    }`}>
      {/* Prize name + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-black text-lg leading-tight ${isClaimed || isExpired ? "text-muted-foreground line-through" : "text-gold"}`}>
            {claim.prize_name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {claim.shop_name ?? ""}
            {claim.created_at ? <> · Won {fmt(claim.created_at)}</> : null}
          </p>
          {claim.expires_at && !isClaimed && (
            <p className={`text-xs mt-0.5 ${isExpiringSoon ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
              {isExpired
                ? `Expired ${fmt(claim.expires_at)}`
                : isExpiringSoon
                  ? `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`
                  : `Expires ${fmt(claim.expires_at)}`}
            </p>
          )}
        </div>
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${status.cls}`}>
          {status.label}
        </span>
      </div>

      {/* QR code + claim code */}
      {!isClaimed && !isExpired && (
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-white rounded-2xl border border-border">
            <QRCodeSVG
              value={claim.claim_code.toUpperCase()}
              size={160}
              bgColor="#ffffff"
              fgColor="#0c2340"
              level="M"
            />
          </div>

          <div className="w-full flex items-center gap-2">
            <div className="flex-1 font-mono text-center text-sm tracking-[0.3em] text-foreground bg-muted border border-border rounded-xl py-2.5 px-3 uppercase">
              {claim.claim_code}
            </div>
            <button
              type="button"
              onClick={copy}
              aria-label="Copy claim code"
              className="relative z-10 w-11 h-11 flex items-center justify-center rounded-xl border border-border bg-muted hover:bg-secondary transition-colors text-muted-foreground cursor-pointer shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Show this QR code at the shop to claim your prize.
          </p>
        </div>
      )}

      {/* Claimed date */}
      {isClaimed && claim.claimed_at && (
        <p className="text-xs text-muted-foreground text-center">
          Claimed on {fmt(claim.claimed_at)}
        </p>
      )}

      {/* View Details button */}
      <button
        type="button"
        onClick={goToDetail}
        className="relative z-10 w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer active:scale-[0.99]"
      >
        View Details
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy } from "lucide-react";
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
  unclaimed: { label: "Unclaimed",  cls: "bg-[#FF7A00]/15 text-[#FF7A00]" },
  claimed:   { label: "Redeemed",   cls: "bg-emerald-500/15 text-emerald-400" },
  expired:   { label: "Expired",    cls: "bg-white/10 text-muted-foreground" },
};

export function PrizeClaimCard({ claim }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(claim.claim_code.toUpperCase());
      setCopied(true);
      toast.success("Claim code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  };

  const status = STATUS_LABEL[claim.status] ?? STATUS_LABEL.unclaimed;
  const isRedeemed = claim.status === "claimed";

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${
      isRedeemed ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/10 bg-white/3"
    }`}>
      {/* Prize name + status */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-black text-lg leading-tight ${isRedeemed ? "text-muted-foreground line-through" : "text-gold"}`}>
            {claim.prize_name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {claim.shop_name ?? ""}
            {claim.created_at ? <> · {fmt(claim.created_at)}</> : null}
          </p>
        </div>
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${status.cls}`}>
          {status.label}
        </span>
      </div>

      {/* QR code + claim code */}
      {!isRedeemed && (
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-white rounded-2xl">
            <QRCodeSVG
              value={claim.claim_code.toUpperCase()}
              size={160}
              bgColor="#ffffff"
              fgColor="#0F1115"
              level="M"
            />
          </div>

          <div className="w-full flex items-center gap-2">
            <div className="flex-1 font-mono text-center text-sm tracking-[0.3em] text-foreground bg-white/5 border border-white/15 rounded-xl py-2.5 px-3 uppercase">
              {claim.claim_code}
            </div>
            <button
              onClick={copy}
              aria-label="Copy claim code"
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition text-muted-foreground"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Show this QR code at the shop to claim your prize.
          </p>
        </div>
      )}

      {/* Redeemed state */}
      {isRedeemed && claim.claimed_at && (
        <p className="text-xs text-muted-foreground text-center">
          Redeemed on {fmt(claim.claimed_at)}
        </p>
      )}
    </div>
  );
}

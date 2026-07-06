import { Link } from "@tanstack/react-router";
import { ChevronRight, Trophy } from "lucide-react";
import type { SpinWithContext } from "@/lib/prize-claims.functions";

type Props = {
  spin: SpinWithContext;
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function SpinHistoryCard({ spin }: Props) {
  const isWin   = !!spin.prize_won && spin.prize_won !== "";
  const hasClaim = !!spin.claim;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl border transition-colors ${
      isWin
        ? "bg-gold/5 border-gold/20"
        : "bg-card border-border"
    }`}>
      {/* Result indicator */}
      <div className={`mt-0.5 w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
        isWin ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground"
      }`}>
        {isWin ? <Trophy className="w-4 h-4" /> : <span className="text-sm">○</span>}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`font-bold text-sm truncate ${isWin ? "text-gold" : "text-foreground"}`}>
              {isWin ? spin.prize_won! : "No prize this time"}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {spin.shop_name}
              {spin.campaign_name
                ? <span className="opacity-70"> · {spin.campaign_name}</span>
                : null}
            </p>
          </div>
          <time
            className="text-[11px] text-muted-foreground shrink-0"
            dateTime={spin.spun_at ?? undefined}
            title={spin.spun_at ? new Date(spin.spun_at).toLocaleString() : ""}
          >
            {fmt(spin.spun_at)}
          </time>
        </div>

        {/* Claim badge — links to detail page only when a claim ID is present */}
        {hasClaim && (
          spin.claim!.id ? (
            <Link
              to="/portal/prizes/$claimId"
              params={{ claimId: spin.claim!.id }}
              className={`relative z-10 mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity ${
                spin.claim!.status === "claimed"
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "bg-gold/15 text-gold"
              }`}
            >
              {spin.claim!.status === "claimed" ? "✓ Redeemed" : "Claim saved"}
              <ChevronRight className="w-2.5 h-2.5" />
            </Link>
          ) : (
            <span className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
              spin.claim!.status === "claimed"
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-gold/15 text-gold"
            }`}>
              {spin.claim!.status === "claimed" ? "✓ Redeemed" : "Claim saved"}
            </span>
          )
        )}
      </div>
    </div>
  );
}

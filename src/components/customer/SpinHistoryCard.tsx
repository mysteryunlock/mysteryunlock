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
  const isWin = !!spin.prize_won && spin.prize_won !== "";
  const hasClaim = !!spin.claim;

  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/3 border border-white/8 hover:border-white/15 transition">
      {/* Win/no-win indicator */}
      <div className={`mt-0.5 w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
        isWin ? "bg-[#FF7A00]/20 text-[#FF7A00]" : "bg-white/5 text-muted-foreground"
      }`}>
        {isWin ? "🏆" : "○"}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`font-bold text-sm truncate ${isWin ? "text-gold" : "text-muted-foreground"}`}>
              {isWin ? spin.prize_won! : "No prize this time"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {spin.shop_name}
              {spin.campaign_name ? <span className="opacity-60"> · {spin.campaign_name}</span> : null}
            </p>
          </div>
          <time className="text-[11px] text-muted-foreground shrink-0">
            {fmt(spin.spun_at)}
          </time>
        </div>

        {/* Claim badge */}
        {hasClaim && (
          <span className={`mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
            spin.claim!.status === "claimed"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-[#FF7A00]/15 text-[#FF7A00]"
          }`}>
            {spin.claim!.status === "claimed" ? "✓ Redeemed" : "Claim saved"}
          </span>
        )}
      </div>
    </div>
  );
}

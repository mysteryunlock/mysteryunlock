import { ChevronDown } from "lucide-react";

export type HistoryFilter = {
  result: "all" | "wins" | "losses";
  shop: string;
  period: "all" | "week" | "month" | "year";
};

type Props = {
  filters: HistoryFilter;
  shops: string[];
  onChange: (next: HistoryFilter) => void;
  filteredCount: number;
  totalCount: number;
};

const PERIOD_LABELS: Record<HistoryFilter["period"], string> = {
  all:   "All time",
  week:  "This week",
  month: "This month",
  year:  "This year",
};

const selectCls =
  "appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground focus:border-[#FF7A00] outline-none cursor-pointer";

export function applyHistoryFilters(
  history: { prize_won: string | null; spun_at: string | null; shop_name: string }[],
  filters: HistoryFilter,
) {
  const now = Date.now();
  const cutoffs: Record<HistoryFilter["period"], number> = {
    all:   0,
    week:  now - 7  * 24 * 60 * 60 * 1000,
    month: now - 30 * 24 * 60 * 60 * 1000,
    year:  now - 365 * 24 * 60 * 60 * 1000,
  };
  const cutoff = cutoffs[filters.period];

  return history.filter((s) => {
    if (filters.result === "wins"   && !s.prize_won) return false;
    if (filters.result === "losses" &&  s.prize_won) return false;
    if (filters.shop && s.shop_name !== filters.shop) return false;
    if (cutoff > 0 && s.spun_at) {
      if (new Date(s.spun_at).getTime() < cutoff) return false;
    }
    return true;
  });
}

export function HistoryFilters({ filters, shops, onChange, filteredCount, totalCount }: Props) {
  const set = (patch: Partial<HistoryFilter>) => onChange({ ...filters, ...patch });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(["all", "wins", "losses"] as const).map((r) => (
          <button
            key={r}
            onClick={() => set({ result: r })}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
              filters.result === r
                ? "gradient-primary text-[#0F1115]"
                : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            {r === "all" ? "All spins" : r}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {shops.length > 1 && (
          <div className="relative">
            <select
              value={filters.shop}
              onChange={(e) => set({ shop: e.target.value })}
              className={selectCls}
              style={{ backgroundColor: "#1a1d24", color: "inherit" }}
            >
              <option value="">All shops</option>
              {shops.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          </div>
        )}

        <div className="relative">
          <select
            value={filters.period}
            onChange={(e) => set({ period: e.target.value as HistoryFilter["period"] })}
            className={selectCls}
            style={{ backgroundColor: "#1a1d24", color: "inherit" }}
          >
            {(Object.entries(PERIOD_LABELS) as [HistoryFilter["period"], string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
        </div>

        {filteredCount !== totalCount && (
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredCount} of {totalCount}
          </span>
        )}
      </div>
    </div>
  );
}

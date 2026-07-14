import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef } from "react";
import { listMyPrizes } from "@/lib/prizes.functions";
import { PrizesPerf } from "@/lib/perf-timing";
import type { Prize } from "@/components/dashboard/types";

/**
 * Stable cache key for authenticated prize data.
 * Scoped to (shopId, campaignId) so different campaigns never share a slot.
 * "_none" is used when no campaignId is provided (returns all shop prizes).
 */
export const myPrizesQueryKey = (shopId: string, campaignId: string | null | undefined) =>
  ["my-prizes", shopId, campaignId ?? "_none"] as const;

/**
 * TanStack Query hook for the authenticated listMyPrizes server function.
 *
 * Replaces the raw useServerFn + useState + useEffect pattern used in
 * CampaignHub and PrizesTab.  Both components share the same cache key so
 * only ONE network request is issued no matter how many components call this
 * with the same (shopId, campaignId) pair.
 *
 * staleTime: 2 min — data stays fresh across tab switches within a normal
 * editing session, so returning to the Prizes section is instant.
 *
 * refetchOnWindowFocus: false — owners are actively editing prizes; a
 * background refetch mid-edit would discard unsaved probability slider state.
 *
 * @param options.enabled  Pass false to delay the query until a prerequisite
 *   (e.g. campaign list) has loaded.  The query will not fire while disabled.
 */
export function useMyPrizes(
  shopId: string,
  campaignId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const fetchPrizes = useServerFn(listMyPrizes);
  const qc = useQueryClient();

  // ── PERF AUDIT T5: detect cache hit/miss on first render of this hook instance ──
  // queryFn only runs on a cache miss; we check the cache state synchronously
  // here (during render) so we can report the hit before useQuery returns.
  const hasLoggedCacheRef = useRef(false);
  const isEnabled = options?.enabled !== false && !!shopId;
  if (isEnabled && !hasLoggedCacheRef.current) {
    hasLoggedCacheRef.current = true;
    const key = myPrizesQueryKey(shopId, campaignId);
    const state = qc.getQueryState(key);
    const isFresh =
      state?.status === "success" &&
      !!state.data &&
      Date.now() - (state.dataUpdatedAt ?? 0) < 2 * 60_000;
    if (isFresh) {
      PrizesPerf.markCacheHit((state!.data as Prize[]).length);
    } else {
      PrizesPerf.markCacheMiss();
    }
  }

  return useQuery({
    queryKey: myPrizesQueryKey(shopId, campaignId),
    queryFn: async (): Promise<Prize[]> => {
      PrizesPerf.markPrizesQueryFnStart(); // ── PERF AUDIT T6 ──
      const res = await fetchPrizes({
        data: { shopId, ...(campaignId ? { campaignId } : {}) },
      });
      const prizes = (res.prizes as Prize[]) ?? [];
      PrizesPerf.markPrizesQueryFnEnd(prizes.length); // ── PERF AUDIT T7 ──
      return prizes;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    enabled: isEnabled,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Returns a stable callback that invalidates all "my-prizes" cache entries
 * for a given shop.  Call this after any prize mutation (upsert / delete /
 * updateProbabilities) to trigger a single background re-fetch that keeps
 * both CampaignHub and PrizesTab in sync.
 */
export function useInvalidateMyPrizes(shopId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["my-prizes", shopId] });
}

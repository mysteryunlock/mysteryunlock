/**
 * TEMPORARY — prizes-section performance audit instrumentation.
 * Remove this file and all PrizesPerf.* calls once the report is complete.
 *
 * Design:
 *  - This is a mutable singleton (module-level state) so timing marks survive
 *    across React re-renders and component boundaries without prop drilling.
 *  - All client-side marks log to the browser console with the prefix
 *    "[PrizesPerf]" for easy filtering.
 *  - Server-side marks in prizes.functions.ts log to the workflow terminal
 *    with "[PrizesPerf:server]".
 *  - "fromClick" columns are only shown when T0 (Prizes card click) has been
 *    recorded — marks that fire at CampaignHub mount (before any click) show
 *    wall-clock offsets from mount instead.
 */

// ─── mutable state ────────────────────────────────────────────────────────────
let t0Click = 0;           // T0 — user clicked Prizes card
let tCampFetchStart = 0;   // T1 — campaigns fetch started
let tCampResolved = 0;     // T2 — campaigns response received
let tPrizesQueryStart = 0; // T6 — queryFn started (cache miss)
let mountTime = 0;         // CampaignHub mount wall time (for pre-click reference)

function elapsed(from: number): string {
  if (!from) return "(no ref)";
  return `${(performance.now() - from).toFixed(1)} ms`;
}
function since(from: number, to: number): string {
  return `${(to - from).toFixed(1)} ms`;
}
function fromClick(ts: number): string {
  if (!t0Click) return "";
  return `  [fromClick +${(ts - t0Click).toFixed(1)} ms]`;
}

// ─── public API ───────────────────────────────────────────────────────────────
export const PrizesPerf = {

  // ── CampaignHub mount ────────────────────────────────────────────────────────
  /** Called at the top of the campaigns useEffect (= CampaignHub mount). */
  markHubMount() {
    mountTime = performance.now();
    console.log(
      "%c[PrizesPerf] CampaignHub mounted — campaigns fetch will start now",
      "color:#888",
    );
  },

  // ── Campaigns fetch ──────────────────────────────────────────────────────────
  /** Called immediately before fetchCampaigns() is awaited. */
  markCampaignsFetchStart() {
    tCampFetchStart = performance.now();
    console.log(
      "%c[PrizesPerf] T1  campaigns fetch started",
      "color:#6c9",
    );
  },

  /** Called inside .then() once the campaigns response arrives. */
  markCampaignsResolved(count: number, chosenId: string | null) {
    tCampResolved = performance.now();
    const dur = since(tCampFetchStart, tCampResolved);
    console.log(
      `%c[PrizesPerf] T2  campaigns resolved` +
      `  campaigns=${count}  activeCampaignId=${chosenId ?? "null"}` +
      `  fetchDuration=${dur}` +
      fromClick(tCampResolved),
      "color:#6c9",
    );
  },

  /** Called when activeCampaignId state commits (React scheduler may add delay). */
  markActiveCampaignIdCommitted(id: string | null) {
    const now = performance.now();
    console.log(
      `%c[PrizesPerf] T3  activeCampaignId state committed  id=${id ?? "null"}` +
      `  scheduleDelay=${since(tCampResolved, now)}` +
      fromClick(now),
      "color:#6c9",
    );
  },

  /** Called in .finally() — campaignsLoading is about to be set false. */
  markCampaignsLoadingCleared() {
    const now = performance.now();
    console.log(
      `%c[PrizesPerf] T4  campaignsLoading→false, prizes query unblocked` +
      `  sinceClick=${t0Click ? since(t0Click, now) : "n/a (campaigns resolved before click)"}` +
      fromClick(now),
      "color:#6c9",
    );
  },

  // ── User click ───────────────────────────────────────────────────────────────
  /** Called synchronously inside the Prizes card onClick handler. */
  markUserClickedPrizes() {
    t0Click = performance.now();
    const campStatus =
      tCampResolved > 0
        ? `already resolved ${(t0Click - tCampResolved).toFixed(1)} ms ago (0 ms blocking wait)`
        : tCampFetchStart > 0
          ? `fetch in-flight, started ${(t0Click - tCampFetchStart).toFixed(1)} ms ago — will block`
          : "not started yet";
    console.log(
      `%c[PrizesPerf] ─────────────────────────────────────────────────────────\n` +
      `[PrizesPerf] T0  USER CLICKED PRIZES\n` +
      `[PrizesPerf]     campaigns status: ${campStatus}\n` +
      `[PrizesPerf] ─────────────────────────────────────────────────────────`,
      "color:#fa0;font-weight:bold",
    );
  },

  // ── TanStack Query cache ─────────────────────────────────────────────────────
  /** Called synchronously in useMyPrizes render path when cache is warm. */
  markCacheHit(prizeCount: number) {
    const now = performance.now();
    console.log(
      `%c[PrizesPerf] T5  TanStack Query CACHE HIT — ${prizeCount} prizes` +
      `  (queryFn will NOT fire, no network request)` +
      fromClick(now),
      "color:#4af;font-weight:bold",
    );
  },

  /** Called synchronously in useMyPrizes render path when cache is cold/stale. */
  markCacheMiss() {
    const now = performance.now();
    console.log(
      `%c[PrizesPerf] T5  TanStack Query CACHE MISS — queryFn will fire` +
      fromClick(now),
      "color:#f84",
    );
  },

  // ── listMyPrizes network round-trip ──────────────────────────────────────────
  /** Called at the start of the queryFn (= start of network round-trip). */
  markPrizesQueryFnStart() {
    tPrizesQueryStart = performance.now();
    console.log(
      `%c[PrizesPerf] T6  listMyPrizes queryFn started (network request sent)` +
      fromClick(tPrizesQueryStart),
      "color:#f84",
    );
  },

  /** Called when the queryFn promise resolves (= response fully received + deserialized). */
  markPrizesQueryFnEnd(count: number) {
    const now = performance.now();
    console.log(
      `%c[PrizesPerf] T7  listMyPrizes queryFn resolved  prizes=${count}` +
      `  networkRoundTrip=${since(tPrizesQueryStart, now)}` +
      fromClick(now),
      "color:#f84;font-weight:bold",
    );
  },

  // ── React render ─────────────────────────────────────────────────────────────
  /**
   * Called inside a useEffect in PrizesTab on the first render that has data.
   * @param fromCache true when queryFn never ran (data came from TanStack cache).
   */
  markPrizesTabFirstRender(count: number, fromCache: boolean) {
    const now = performance.now();
    const e2e = t0Click ? since(t0Click, now) : "n/a";
    console.log(
      `%c[PrizesPerf] ─────────────────────────────────────────────────────────\n` +
      `[PrizesPerf] T8  PRIZES TAB RENDERED  prizes=${count}  source=${fromCache ? "CACHE" : "network"}\n` +
      `[PrizesPerf]     END-TO-END (click→render): ${e2e}\n` +
      `[PrizesPerf]     (server breakdown in workflow terminal — grep [PrizesPerf:server])\n` +
      `[PrizesPerf] ─────────────────────────────────────────────────────────`,
      "color:#4f4;font-weight:bold",
    );
  },

  // ── helpers ──────────────────────────────────────────────────────────────────
  /** Reset all timing state (useful when navigating away and back). */
  reset() {
    t0Click = 0;
    tCampFetchStart = 0;
    tCampResolved = 0;
    tPrizesQueryStart = 0;
    mountTime = 0;
  },
};

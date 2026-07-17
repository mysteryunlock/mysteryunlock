/**
 * Lightweight client-side game interaction analytics.
 *
 * Architecture:
 * ─ Pushes structured events to window.dataLayer (Google Tag Manager compatible).
 * ─ Falls back silently when no analytics provider is configured.
 * ─ Never sends the raw access code — only the last 4 characters are recorded.
 * ─ Zero dependencies, zero network calls from this module.
 *
 * Future dashboards can consume these events by connecting GTM or any
 * provider that reads window.dataLayer (GA4, Segment, Mixpanel, etc.).
 *
 * Event names follow the mu_ prefix convention:
 *   mu_game_started    — user tapped Spin Now / Reveal Now (before server call)
 *   mu_game_completed  — prize revealed (after server confirms)
 */

export type GameType = "spin" | "scratch";

interface GameStartedEvent {
  event:     "mu_game_started";
  game_type: GameType;
  shop_slug: string;
  code_tail: string;   // last 4 chars only — never the full code
}

interface GameCompletedEvent {
  event:     "mu_game_completed";
  game_type: GameType;
  shop_slug: string;
  code_tail: string;
  result:    "win" | "lose";
}

type AnalyticsEvent = GameStartedEvent | GameCompletedEvent;

function push(data: AnalyticsEvent) {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
  w.dataLayer.push(data);
}

/**
 * Call when the user initiates a game interaction (before the server call).
 * Safe to call multiple times — each call pushes one event.
 */
export function trackGameStarted(
  game_type: GameType,
  shop_slug: string,
  code: string,
) {
  push({
    event:     "mu_game_started",
    game_type,
    shop_slug,
    code_tail: code.slice(-4),
  });
}

/**
 * Call when the prize has been determined and the reveal animation begins.
 * `won` comes from `prize.isWin` — never from server fn directly.
 */
export function trackGameCompleted(
  game_type: GameType,
  shop_slug: string,
  code: string,
  won: boolean,
) {
  push({
    event:     "mu_game_completed",
    game_type,
    shop_slug,
    code_tail: code.slice(-4),
    result:    won ? "win" : "lose",
  });
}

/**
 * Haptic feedback — thin wrapper around the Vibration API.
 * Gracefully degrades on unsupported browsers/platforms.
 */

export type HapticType = "light" | "medium" | "heavy" | "success" | "soft";

const PATTERNS: Record<HapticType, number | number[]> = {
  light:   10,
  medium:  25,
  heavy:   50,
  success: [20, 60, 80],
  soft:    8,
};

export function haptic(type: HapticType): void {
  if (typeof navigator === "undefined") return;
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[type]);
  } catch {
    // Silently ignore — permissions or feature policy
  }
}

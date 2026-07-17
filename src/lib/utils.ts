import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses a TanStack Start validator error into a human-readable string.
 *
 * When `.validator(zodSchema)` rejects input it throws:
 *   new Error(JSON.stringify(zodIssues))
 * where zodIssues is an array of { path: string[]; message: string } objects.
 *
 * Returns a formatted message like "slug: Invalid input · code: Too small"
 * when the error is a validation error, or null for any other error shape.
 */
/**
 * Returns initials for a name string (up to 2 chars), falling back to the
 * first character of `fallback`. Used in avatar placeholders across the app.
 * Extracted from OverviewTab + CustomerCrm (was duplicated in both).
 */
export function initials(name: string | null | undefined, fallback: string): string {
  const s = (name || "").trim();
  if (!s) return (fallback[0] ?? "?").toUpperCase();
  const parts = s.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || s[0].toUpperCase();
}

export function parseServerValidationError(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  try {
    const issues = JSON.parse(err.message);
    if (!Array.isArray(issues) || issues.length === 0) return null;
    const first = issues[0];
    if (typeof first !== "object" || first === null || !("message" in first)) return null;
    return (issues as Array<{ path?: unknown[]; message: string }>)
      .map((issue) => {
        const field =
          Array.isArray(issue.path) && issue.path.length > 0
            ? issue.path.map(String).join(".")
            : null;
        return field ? `${field}: ${issue.message}` : issue.message;
      })
      .join(" · ");
  } catch {
    return null;
  }
}

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

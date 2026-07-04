import { z } from "zod";

// RFC-5322 inspired regex — requires user@domain.tld format
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "Email is too short")
  .max(255, "Email is too long")
  .email("Please enter a valid email address")
  .refine((v) => EMAIL_RE.test(v), "Please enter a valid email address (e.g. you@example.com)");

export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

export interface PasswordStrength {
  ok: boolean;
  errors: string[];
}

export function checkPassword(password: string): PasswordStrength {
  const errors: string[] = [];
  if (password.length < 8) errors.push("At least 8 characters");
  if (password.length > 128) errors.push("Maximum 128 characters");
  if (!/[a-zA-Z]/.test(password)) errors.push("At least one letter (a–z)");
  if (!/[0-9]/.test(password)) errors.push("At least one number (0–9)");
  return { ok: errors.length === 0, errors };
}

/**
 * Canonical slug schema shared across all server functions.
 * Lowercase, 2–40 chars, letters/digits/dashes, no leading or trailing dash.
 */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Must be 2–40 characters long")
  .max(40, "Must be 2–40 characters long")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Use only lowercase letters, numbers, and dashes — cannot start or end with a dash",
  );

/**
 * Canonical access-code character schema shared across server functions.
 * Alphanumeric + dashes, 1–64 chars.
 */
export const codeChars = z
  .string()
  .trim()
  .min(1, "Code cannot be empty")
  .max(64, "Code is too long")
  .regex(/^[A-Za-z0-9-]+$/, "Code may only contain letters, numbers and dashes");

/**
 * Canonical name schema for shop names.
 * Non-empty trimmed string, up to 80 characters.
 */
export const nameSchema = z.string().trim().min(1, "Name cannot be empty").max(80, "Name must be 80 characters or fewer");

/**
 * Canonical name schema for campaign names.
 * Non-empty trimmed string, up to 60 characters (matches spin-page display limit).
 */
export const campaignNameSchema = z.string().trim().min(1, "Name cannot be empty").max(60, "Name must be 60 characters or fewer");

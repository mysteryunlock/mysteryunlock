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

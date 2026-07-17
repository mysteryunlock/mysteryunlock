/**
 * Design System — OtpInput
 *
 * Extracted from auth.tsx and customer-auth.tsx into a shared component.
 * Uses the `input-otp` package already in package.json.
 *
 * Usage:
 *   <OtpInput length={6} value={code} onChange={setCode} />
 */

import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Slot (single digit cell)
// ─────────────────────────────────────────────────────────────

function OtpSlot({ index }: { index: number }) {
  const inputCtx = React.useContext(OTPInputContext);
  const slot = inputCtx.slots[index];
  const { char, hasFakeCaret, isActive } = slot ?? { char: null, hasFakeCaret: false, isActive: false };

  return (
    <div
      className={cn(
        "relative flex h-14 w-11 items-center justify-center",
        "text-2xl font-display font-bold text-[#0C2340]",
        "rounded-xl border-2 transition-all duration-150",
        "select-none",
        isActive
          ? "border-[#FF6B1A] bg-white shadow-[0_0_0_3px_rgba(255,107,26,0.15)]"
          : char
            ? "border-[#0C2340]/20 bg-white"
            : "border-[#0C2340]/12 bg-[#F7F8FA]",
      )}
    >
      {char}
      {hasFakeCaret && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="h-6 w-0.5 bg-[#FF6B1A] animate-pulse rounded-full" />
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OtpInput
// ─────────────────────────────────────────────────────────────

export interface OtpInputProps {
  /** Number of digits (default: 6) */
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  /** Separator after this many slots (default: none) */
  separatorAfter?: number;
}

function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  className,
  separatorAfter,
}: OtpInputProps) {
  return (
    <OTPInput
      maxLength={length}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      autoFocus={autoFocus}
      containerClassName={cn("flex items-center gap-2 justify-center", className)}
      render={({ slots }) => (
        <>
          {slots.map((_, i) => (
            <React.Fragment key={i}>
              <OtpSlot index={i} />
              {separatorAfter && i === separatorAfter - 1 && i < length - 1 && (
                <span className="text-[#4a5b78]/40 text-xl font-light" aria-hidden="true">
                  –
                </span>
              )}
            </React.Fragment>
          ))}
        </>
      )}
    />
  );
}

export { OtpInput };

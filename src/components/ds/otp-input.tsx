/**
 * Design System — OtpInput (native, no input-otp dependency)
 *
 * Uses a single transparent native <input> overlaid on visual digit slots.
 * Works reliably on Android/Brave without the browser-level crashes caused
 * by the input-otp v1.x library.
 *
 * Usage:
 *   <OtpInput length={6} value={code} onChange={setCode} />
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
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
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (autoFocus && inputRef.current) {
      const t = setTimeout(() => { inputRef.current?.focus(); }, 120);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <div
      className={cn("relative flex items-center gap-2 justify-center cursor-text", className)}
      onClick={() => { if (!disabled) inputRef.current?.focus(); }}
    >
      {Array.from({ length }).map((_, i) => {
        const char = value[i] ?? null;
        const isActive = !disabled && i === value.length;
        return (
          <React.Fragment key={i}>
            <div
              className={cn(
                "relative flex h-14 w-11 items-center justify-center",
                "text-2xl font-display font-bold text-[#0C2340]",
                "rounded-xl border-2 transition-all duration-150",
                "select-none pointer-events-none",
                isActive
                  ? "border-[#FF6B1A] bg-white shadow-[0_0_0_3px_rgba(255,107,26,0.15)]"
                  : char
                    ? "border-[#0C2340]/20 bg-white"
                    : "border-[#0C2340]/12 bg-[#F7F8FA]",
              )}
            >
              {char}
              {isActive && (
                <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                  <span className="h-6 w-0.5 bg-[#FF6B1A] animate-pulse rounded-full" />
                </span>
              )}
            </div>
            {separatorAfter && i === separatorAfter - 1 && i < length - 1 && (
              <span className="text-[#4a5b78]/40 text-xl font-light" aria-hidden="true">–</span>
            )}
          </React.Fragment>
        );
      })}

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        maxLength={length}
        className="absolute inset-0 w-full h-full opacity-0 cursor-text caret-transparent"
        aria-label="One-time verification code"
      />
    </div>
  );
}

export { OtpInput };

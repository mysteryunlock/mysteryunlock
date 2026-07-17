/**
 * Design System — Form Inputs
 *
 * Replaces three inconsistent input patterns:
 *   • Dashboard: bg-[#F5F7FA] border border-[#0c2340]/10 rounded-xl ... focus:border-[#FF6B1A]/50
 *   • Auth:      rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#6F8FA3]/30
 *   • Portal:    bg-[#F5F7FA] border border-[#0c2340]/10 ... focus:border-[#ff6b1a]
 *
 * Exports:
 *   Input       — single-line text input
 *   Textarea    — multi-line input
 *   Label       — accessible label
 *   Field       — label + input + error wrapper
 *   InputGroup  — prepend/append icon inside input
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Shared input base classes
// ─────────────────────────────────────────────────────────────

const inputBase = [
  "w-full bg-[#F7F8FA] text-[#0C2340] placeholder:text-[#4a5b78]/50",
  "border border-[#0C2340]/12 rounded-xl",
  "px-3.5 py-2.5 text-sm leading-snug",
  "transition-all duration-150",
  "focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]/25 focus:border-[#FF6B1A]/60 focus:bg-white",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "read-only:opacity-70 read-only:cursor-default",
].join(" ");

// ─────────────────────────────────────────────────────────────
// Label
// ─────────────────────────────────────────────────────────────

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "block text-[13px] font-semibold text-[#0C2340] mb-1.5 leading-none",
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-1 text-[#FF6B1A]" aria-hidden="true">
          *
        </span>
      )}
    </label>
  ),
);
Label.displayName = "Label";

// ─────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Error message — turns border red */
  error?: string;
  /** Left icon/element inside the input */
  leftElement?: React.ReactNode;
  /** Right icon/element inside the input */
  rightElement?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftElement, rightElement, ...props }, ref) => {
    if (leftElement || rightElement) {
      return (
        <div className="relative">
          {leftElement && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4a5b78] pointer-events-none">
              {leftElement}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              inputBase,
              leftElement && "pl-10",
              rightElement && "pr-10",
              error && "border-red-400 focus:border-red-500 focus:ring-red-200/60",
              className,
            )}
            aria-invalid={error ? "true" : undefined}
            {...props}
          />
          {rightElement && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4a5b78]">
              {rightElement}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={cn(
          inputBase,
          error && "border-red-400 focus:border-red-500 focus:ring-red-200/60",
          className,
        )}
        aria-invalid={error ? "true" : undefined}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

// ─────────────────────────────────────────────────────────────
// Textarea
// ─────────────────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        inputBase,
        "resize-none min-h-[80px]",
        error && "border-red-400 focus:border-red-500 focus:ring-red-200/60",
        className,
      )}
      aria-invalid={error ? "true" : undefined}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

// ─────────────────────────────────────────────────────────────
// Field — label + input + error wrapper
// ─────────────────────────────────────────────────────────────

export interface FieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, required, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-0", className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {hint && !error && (
        <p className="mt-1.5 text-[12px] text-[#4a5b78] leading-snug">{hint}</p>
      )}
      {error && (
        <p className="mt-1.5 text-[12px] text-red-600 font-medium leading-snug" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export { Label, Input, Textarea, Field, inputBase };

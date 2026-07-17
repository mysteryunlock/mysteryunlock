/**
 * Design System — Modal / Dialog
 *
 * Replaces:
 *   • alert() calls in CustomerCrm export
 *   • confirm() calls in SettingsTab requestDelete
 *   • Ad-hoc Radix Dialog wrappers scattered across the app
 *
 * Exports:
 *   Modal        — general purpose dialog
 *   ConfirmModal — destructive confirmation dialog
 */

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Btn } from "./button";

// ─────────────────────────────────────────────────────────────
// Modal — general purpose
// ─────────────────────────────────────────────────────────────

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** Max width class (default: max-w-md) */
  size?: "sm" | "md" | "lg";
  /** Hide the X close button */
  hideClose?: boolean;
  footer?: React.ReactNode;
}

const sizeMap = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" } as const;

function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  hideClose = false,
  footer,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0C2340]/30 backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-in" />

        {/* Panel */}
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[calc(100vw-2rem)]",
            sizeMap[size],
            "bg-white rounded-[24px] shadow-[0_20px_60px_-12px_rgba(12,35,64,0.25)]",
            "border border-[#0C2340]/8",
            "p-6",
            "focus:outline-none",
            "data-[state=open]:animate-fade-in",
          )}
          aria-describedby={description ? "modal-desc" : undefined}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <Dialog.Title className="text-lg font-display font-bold text-[#0C2340] leading-tight">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description
                  id="modal-desc"
                  className="text-sm text-[#4a5b78] mt-1 leading-relaxed"
                >
                  {description}
                </Dialog.Description>
              )}
            </div>
            {!hideClose && (
              <Dialog.Close asChild>
                <button
                  className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-[#4a5b78] hover:bg-[#0C2340]/6 hover:text-[#0C2340] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B1A]/40 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </Dialog.Close>
            )}
          </div>

          {/* Content */}
          {children}

          {/* Footer */}
          {footer && <div className="mt-5">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─────────────────────────────────────────────────────────────
// ConfirmModal — destructive or informational confirmation
// ─────────────────────────────────────────────────────────────

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
}

function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  loading = false,
}: ConfirmModalProps) {
  const [busy, setBusy] = React.useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  const isLoading = loading || busy;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      hideClose
      footer={
        <div className="flex gap-2.5 justify-end">
          <Btn variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Btn>
          <Btn
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={handleConfirm}
            loading={isLoading}
          >
            {confirmLabel}
          </Btn>
        </div>
      }
    >
      <div className="flex gap-3 items-start">
        <div
          className={cn(
            "shrink-0 w-10 h-10 rounded-xl grid place-items-center",
            variant === "danger" ? "bg-red-50 text-red-600" : "bg-[#FF6B1A]/10 text-[#FF6B1A]",
          )}
          aria-hidden="true"
        >
          {variant === "danger" ? (
            <AlertTriangle className="w-5 h-5" strokeWidth={1.75} />
          ) : (
            <Info className="w-5 h-5" strokeWidth={1.75} />
          )}
        </div>
        <p className="text-sm text-[#4a5b78] leading-relaxed flex-1">{description}</p>
      </div>
    </Modal>
  );
}

export { Modal, ConfirmModal };

"use client";

import { useEffect, useId } from "react";
import { Button } from "@/foundation/ui/Button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** Shown on the confirm button while `loading`. */
  confirmLoadingLabel?: string;
  cancelLabel?: string;
  /** A destructive confirm (cancel, decline) is drawn in red. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A modal "are you sure?" step in front of an action that is hard to undo,
 * such as cancelling a paid booking (which refunds it). Escape and the
 * backdrop cancel, except while the action is in flight.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  confirmLoadingLabel,
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;
    /** Escape closes the dialog, like the backdrop, unless the action is running. */
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/40 p-4 sm:items-center"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold text-neutral-900">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-neutral-600">
          {description}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={loading} onClick={onCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button
            loading={loading}
            onClick={onConfirm}
            className={destructive ? "bg-red-600 hover:bg-red-700 hover:opacity-100" : undefined}
          >
            {loading && confirmLoadingLabel ? confirmLoadingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

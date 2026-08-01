"use client";

import { Modal } from "@/components/ui/Modal";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import type { LottieAssetKey } from "@/lib/lottieAssets";

export type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  /** Plain-language explanation of what confirming will do. */
  description?: string;
  confirmLabel?: string;
  confirmLoadingLabel?: string;
  cancelLabel?: string;
  /** Matches the destructive/primary tone of the action being confirmed. */
  confirmVariant?: ButtonVariant;
  /** Optional illustration above the description. */
  lottie?: LottieAssetKey;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Shared "are you sure?" dialog for destructive/irreversible portal actions
 * (withdraw quote, cancel booking, mark complete, sign out) - built on the
 * base `Modal` primitive so every confirmation looks and behaves the same.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  confirmLoadingLabel,
  cancelLabel = "Cancel",
  confirmVariant = "destructive",
  lottie,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!loading) onCancel();
      }}
      zIndexClassName="z-[70]"
      maxWidthClassName="max-w-md"
      title={title}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} loading={loading} onClick={onConfirm}>
            {loading && confirmLoadingLabel ? confirmLoadingLabel : confirmLabel}
          </Button>
        </div>
      }
    >
      {lottie ? (
        <LottieIllustration asset={lottie} className="mb-3 h-24 w-24 sm:h-28 sm:w-28" />
      ) : null}
      {description ? <p className="text-sm text-neutral-700">{description}</p> : null}
    </Modal>
  );
}

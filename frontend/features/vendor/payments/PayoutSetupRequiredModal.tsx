"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type PayoutSetupRequiredModalProps = {
  isOpen: boolean;
  connecting: boolean;
  error?: string | null;
  onClose: () => void;
  onCompleteSetup: () => void;
};

/**
 * Shown when a vendor tries to Accept without Stripe Connect ready.
 * Primary action launches Connect; Accept resumes automatically on return.
 */
export function PayoutSetupRequiredModal({
  isOpen,
  connecting,
  error,
  onClose,
  onCompleteSetup,
}: PayoutSetupRequiredModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="You are one step away from accepting bookings"
      maxWidthClassName="max-w-md"
      zIndexClassName="z-[70]"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={connecting}>
            Not now
          </Button>
          <Button variant="primary" loading={connecting} onClick={onCompleteSetup}>
            Complete payout setup
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-neutral-700">
        <p>
          To receive secure payments through Eventzz, you need to complete payout setup.
        </p>
        <p>This usually takes 2–3 minutes.</p>
        {error ? <p className="font-medium text-red-700">{error}</p> : null}
      </div>
    </Modal>
  );
}

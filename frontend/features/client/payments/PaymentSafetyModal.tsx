"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PAYMENT_SAFETY_COPY } from "@/features/bookings/bookingConfirmCopy";

type PaymentSafetyModalProps = {
  isOpen: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Last step before Stripe Checkout: explain fund protection and the 48-hour dispute window. */
export function PaymentSafetyModal({
  isOpen,
  loading = false,
  onConfirm,
  onCancel,
}: PaymentSafetyModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!loading) onCancel();
      }}
      title={PAYMENT_SAFETY_COPY.modalTitle}
      maxWidthClassName="max-w-md"
      zIndexClassName="z-[70]"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={loading} onClick={onCancel}>
            {PAYMENT_SAFETY_COPY.cancelLabel}
          </Button>
          <Button variant="primary" loading={loading} onClick={onConfirm}>
            {PAYMENT_SAFETY_COPY.confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-neutral-700">
        <p>{PAYMENT_SAFETY_COPY.intro}</p>
        <ul className="list-disc space-y-2 pl-5">
          {PAYMENT_SAFETY_COPY.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

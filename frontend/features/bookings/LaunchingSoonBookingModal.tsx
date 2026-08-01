"use client";

import { Rocket } from "lucide-react";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { Modal } from "@/components/ui/Modal";
import { WAITLIST_LINK_LABEL, WAITLIST_URL } from "@/features/landing/landingData";

type LaunchingSoonBookingModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

/** Pre-launch booking guard — uses shared `Modal` motion; no feature-local motion wrappers. */
export function LaunchingSoonBookingModal({ isOpen, onClose }: LaunchingSoonBookingModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="We're launching soon"
      maxWidthClassName="max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Close
          </button>
          <a
            href={WAITLIST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white hover:opacity-95"
          >
            {WAITLIST_LINK_LABEL}
          </a>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center">
        <LottieIllustration
          asset="launchingSoon"
          className="h-36 w-36 sm:h-40 sm:w-40"
          ariaLabel="Launching soon"
          fallback={
            <span className="flex h-36 w-36 items-center justify-center rounded-full bg-primary-soft text-primary sm:h-40 sm:w-40">
              <Rocket className="h-12 w-12" strokeWidth={1.75} aria-hidden />
            </span>
          }
        />
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">
          Booking isn&apos;t open yet — we&apos;re putting the finishing touches on Eventtz. You
          can still browse vendors and save favourites.
        </p>
        <p className="mt-3 text-sm text-neutral-600">
          Join the waitlist and we&apos;ll let you know as soon as you can send booking requests.
        </p>
      </div>
    </Modal>
  );
}

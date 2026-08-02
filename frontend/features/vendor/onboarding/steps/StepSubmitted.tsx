"use client";

import Link from "next/link";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AnimatedStepItem } from "../ui/AnimatedStepItem";

type StepSubmittedProps = {
  approvalStatus: VendorApprovalStatus;
  onViewProfileReview: () => void;
  onRefreshStatus: () => void;
  refreshing?: boolean;
  /** Shown under the heading so vendors see their saved business name while locked. */
  businessName?: string;
};

export function StepSubmitted({
  approvalStatus,
  onViewProfileReview,
  onRefreshStatus,
  refreshing = false,
  businessName,
}: StepSubmittedProps) {
  const approved = approvalStatus === "approved";
  const banned = approvalStatus === "banned";

  const heading = approved
    ? "You're approved"
    : banned
      ? "Profile not visible"
      : "Profile submitted";

  const statusCopy = approved
    ? "Your profile is live. Head to your dashboard to manage bookings and enquiries."
    : banned
      ? "Your profile isn't visible to clients. Contact support if you believe this is a mistake."
      : "We're reviewing your profile. This usually takes 1–3 business days — we'll email you when you're live.";

  return (
    <div className="space-y-6 py-4 text-center">
      <AnimatedStepItem index={0}>
        <LottieIllustration
          asset={approved ? "successCheck" : banned ? "failure" : "pendingReview"}
          className="mx-auto h-28 w-28"
          ariaLabel=""
        />
      </AnimatedStepItem>
      <AnimatedStepItem index={1}>
        <h2 className="font-heading text-2xl font-semibold text-neutral-900">{heading}</h2>
        {businessName?.trim() ? (
          <p className="mt-2 text-sm font-medium text-neutral-700">
            {businessName.trim()}
          </p>
        ) : null}
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-600">
          {statusCopy}
        </p>
      </AnimatedStepItem>
      {approved ? (
        <AnimatedStepItem index={2}>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/vendor/dashboard"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 sm:w-auto sm:min-w-[12rem]"
            >
              Go to dashboard
            </Link>
            <button
              type="button"
              onClick={onViewProfileReview}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-primary bg-white px-6 py-3 text-sm font-semibold text-primary shadow-sm hover:bg-neutral-50 sm:w-auto sm:min-w-[12rem]"
            >
              View profile review
            </button>
          </div>
        </AnimatedStepItem>
      ) : banned ? (
        <AnimatedStepItem index={2}>
          <LottieFailureInline
            message="Your profile isn't visible to clients."
            className="mx-auto max-w-md text-left"
          />
        </AnimatedStepItem>
      ) : (
        <AnimatedStepItem index={2}>
          <button
            type="button"
            disabled={refreshing}
            onClick={onRefreshStatus}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60 sm:mx-auto sm:w-auto sm:min-w-[12rem]"
          >
            {refreshing ? (
              <>
                <LoadingSpinner size="sm" />
                Checking…
              </>
            ) : (
              "Check approval status"
            )}
          </button>
        </AnimatedStepItem>
      )}
    </div>
  );
}

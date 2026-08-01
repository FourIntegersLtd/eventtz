"use client";

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
        <h2 className="font-heading text-2xl font-semibold text-neutral-900">
          Thank you for signing up
        </h2>
      </AnimatedStepItem>
      {businessName?.trim() ? (
        <AnimatedStepItem index={2}>
          <p className="text-sm font-medium text-neutral-700">
            Profile: <span className="text-neutral-900">{businessName.trim()}</span>
          </p>
        </AnimatedStepItem>
      ) : null}
      {approved ? (
        <AnimatedStepItem index={3}>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
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
        <AnimatedStepItem index={3}>
          <LottieFailureInline
            message="Your profile isn't visible to clients."
            className="mx-auto max-w-md text-left"
          />
        </AnimatedStepItem>
      ) : (
        <AnimatedStepItem index={3}>
          <div className="space-y-3">
            <p className="mx-auto max-w-md text-sm leading-relaxed text-neutral-600">
              Your profile is under review. We usually respond within a few business days.
            </p>
            <p className="text-xs text-neutral-500">
              <button
                type="button"
                disabled={refreshing}
                onClick={onRefreshStatus}
                className="inline-flex items-center justify-center gap-2 font-medium text-primary underline hover:no-underline disabled:opacity-50"
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
            </p>
          </div>
        </AnimatedStepItem>
      )}
    </div>
  );
}

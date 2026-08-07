"use client";

import Link from "next/link";
import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";
import type { VendorApprovalStatus } from "@/lib/domain-types";
import { portfolioApprovalBlockedCopy } from "@/features/vendor/onboarding/onboardingCopy";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { VendorStatusCheckFeedback } from "../types";
import { AnimatedStepItem } from "../ui/AnimatedStepItem";

type StepSubmittedProps = {
  approvalStatus: VendorApprovalStatus;
  onViewProfileReview: () => void;
  onRefreshStatus: () => void;
  refreshing?: boolean;
  statusCheckFeedback?: VendorStatusCheckFeedback | null;
  /** Shown under the heading so vendors see their saved business name while locked. */
  businessName?: string;
  portfolioPhotoCount?: number;
  needsMorePortfolioPhotos?: boolean;
  onAddPortfolioPhotos?: () => void;
};

const FEEDBACK_STYLES: Record<
  VendorStatusCheckFeedback["tone"],
  { container: string; icon: typeof Info }
> = {
  success: {
    container: "bg-emerald-50 text-emerald-950 ring-emerald-200/70",
    icon: CheckCircle2,
  },
  info: {
    container: "bg-sky-50 text-sky-950 ring-sky-200/70",
    icon: Info,
  },
  warning: {
    container: "bg-amber-50 text-amber-950 ring-amber-200/70",
    icon: TriangleAlert,
  },
  error: {
    container: "bg-red-50 text-red-950 ring-red-200/70",
    icon: XCircle,
  },
};

function StatusCheckFeedbackBanner({ feedback }: { feedback: VendorStatusCheckFeedback }) {
  const styles = FEEDBACK_STYLES[feedback.tone];
  const Icon = styles.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mx-auto mt-4 max-w-md rounded-xl px-4 py-3 text-left ring-1 ${styles.container}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{feedback.title}</p>
          {feedback.description ? (
            <p className="mt-1 text-sm leading-relaxed opacity-90">{feedback.description}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function StepSubmitted({
  approvalStatus,
  onViewProfileReview,
  onRefreshStatus,
  refreshing = false,
  statusCheckFeedback = null,
  businessName,
  portfolioPhotoCount = 0,
  needsMorePortfolioPhotos = false,
  onAddPortfolioPhotos,
}: StepSubmittedProps) {
  const approved = approvalStatus === "approved";
  const banned = approvalStatus === "banned";
  const portfolioBlocked = needsMorePortfolioPhotos && !approved && !banned;
  const blockedCopy = portfolioBlocked
    ? portfolioApprovalBlockedCopy(portfolioPhotoCount)
    : null;

  const heading = approved
    ? "You're approved"
    : banned
      ? "Profile not visible"
      : portfolioBlocked
        ? blockedCopy!.submittedHeading
        : "Profile submitted";

  const statusCopy = approved
    ? "Your profile is live. Head to your dashboard to manage bookings and enquiries."
    : banned
      ? "Your profile isn't visible to clients. Contact support if you believe this is a mistake."
      : portfolioBlocked
        ? blockedCopy!.submittedBody
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
        <>
          <AnimatedStepItem index={2}>
            <LottieFailureInline
              message="Your profile isn't visible to clients."
              className="mx-auto max-w-md text-left"
            />
          </AnimatedStepItem>
          {statusCheckFeedback ? (
            <AnimatedStepItem index={3}>
              <StatusCheckFeedbackBanner feedback={statusCheckFeedback} />
            </AnimatedStepItem>
          ) : null}
        </>
      ) : (
        <>
          {needsMorePortfolioPhotos && onAddPortfolioPhotos && blockedCopy ? (
            <AnimatedStepItem index={2}>
              <div className="mx-auto max-w-md rounded-xl bg-amber-50 px-4 py-4 text-left ring-1 ring-amber-200/70">
                <p className="text-sm font-semibold text-amber-950">
                  {blockedCopy.cardTitle}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
                  {blockedCopy.cardBody}
                </p>
                <button
                  type="button"
                  onClick={onAddPortfolioPhotos}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 sm:w-auto sm:min-w-[12rem]"
                >
                  {blockedCopy.ctaLabel}
                </button>
              </div>
            </AnimatedStepItem>
          ) : null}
          <AnimatedStepItem index={needsMorePortfolioPhotos ? 3 : 2}>
            <button
              type="button"
              disabled={refreshing}
              onClick={onRefreshStatus}
              className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-60 sm:mx-auto sm:w-auto sm:min-w-[12rem] ${
                needsMorePortfolioPhotos
                  ? "border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
                  : "bg-primary text-white"
              }`}
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
            <p className="mx-auto mt-3 max-w-md text-xs text-neutral-500">
              {needsMorePortfolioPhotos && blockedCopy
                ? blockedCopy.checkStatusHint
                : "Tap to refresh — we'll show the latest review status here."}
            </p>
          </AnimatedStepItem>
          {statusCheckFeedback ? (
            <AnimatedStepItem index={needsMorePortfolioPhotos ? 4 : 3}>
              <StatusCheckFeedbackBanner feedback={statusCheckFeedback} />
            </AnimatedStepItem>
          ) : null}
        </>
      )}
    </div>
  );
}

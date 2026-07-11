import type { VendorApprovalStatus } from "@/lib/domain-types";

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
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-2xl text-primary">
        ✓
      </div>
      <h2 className="font-heading text-2xl font-semibold text-neutral-900">
        Thank you for signing up
      </h2>
      {businessName?.trim() ? (
        <p className="text-sm font-medium text-neutral-700">
          Profile: <span className="text-neutral-900">{businessName.trim()}</span>
        </p>
      ) : null}
      {approved ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onViewProfileReview}
            className="inline-flex min-w-[200px] items-center justify-center rounded-lg border border-primary bg-white px-6 py-3 text-sm font-semibold text-primary shadow-sm hover:bg-neutral-50"
          >
            View profile review
          </button>
        </div>
      ) : banned ? (
        <p className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
          Your profile isn&apos;t visible to clients.
        </p>
      ) : (
        <p className="text-xs text-neutral-500">
          <button
            type="button"
            disabled={refreshing}
            onClick={onRefreshStatus}
            className="font-medium text-primary underline hover:no-underline disabled:opacity-50"
          >
            {refreshing ? "Checking…" : "Check approval status"}
          </button>
        </p>
      )}
    </div>
  );
}

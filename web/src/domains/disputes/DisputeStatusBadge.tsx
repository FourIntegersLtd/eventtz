import { disputeStatusBadgeClass, disputeStatusLabel } from "@/domains/disputes/format";

/**
 * Color-coded dispute case status. Same pill on the list and the detail,
 * matching the baseline `ParticipantDisputeStatusBadge`.
 */
export function DisputeStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${disputeStatusBadgeClass(status)}`}
    >
      {disputeStatusLabel(status)}
    </span>
  );
}

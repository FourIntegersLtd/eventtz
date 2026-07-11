import {
  participantDisputeStatusBadgeClass,
  participantDisputeStatusLabel,
} from "@/lib/bookingDisputeHelpers";

export type ParticipantDisputeStatusBadgeProps = {
  status: string;
  className?: string;
};

/** Color-coded dispute case status — use on list rows, detail headers, and booking panels. */
export function ParticipantDisputeStatusBadge({
  status,
  className = "",
}: ParticipantDisputeStatusBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${participantDisputeStatusBadgeClass(status)} ${className}`.trim()}
    >
      {participantDisputeStatusLabel(status)}
    </span>
  );
}

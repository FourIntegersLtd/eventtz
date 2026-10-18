import { Badge } from "@/components/ui/Badge";
import {
  participantDisputeStatusLabel,
  participantDisputeStatusTone,
} from "@/lib/bookingDisputeHelpers";

export type ParticipantDisputeStatusBadgeProps = {
  status: string;
  className?: string;
};

/** Color-coded dispute case status - use on list rows, detail headers, and booking panels. */
export function ParticipantDisputeStatusBadge({
  status,
  className = "",
}: ParticipantDisputeStatusBadgeProps) {
  return (
    <Badge tone={participantDisputeStatusTone(status)} className={className}>
      {participantDisputeStatusLabel(status)}
    </Badge>
  );
}

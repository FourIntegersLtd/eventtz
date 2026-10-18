import { Badge } from "@/components/ui/Badge";

export type AccountStatusBadgeProps = {
  suspended: boolean;
  className?: string;
};

/** Admin client account - active vs suspended. */
export function AccountStatusBadge({ suspended, className = "" }: AccountStatusBadgeProps) {
  return (
    <Badge tone={suspended ? "neutral" : "success"} className={className}>
      {suspended ? "Suspended" : "Active"}
    </Badge>
  );
}

import { Badge } from "@/components/ui/Badge";

export type ReviewVisibilityBadgeProps = {
  hidden: boolean;
  className?: string;
};

/** Review visibility on the admin console - hidden vs visible. */
export function ReviewVisibilityBadge({ hidden, className = "" }: ReviewVisibilityBadgeProps) {
  return (
    <Badge tone={hidden ? "neutral" : "success"} className={className}>
      {hidden ? "Hidden" : "Visible"}
    </Badge>
  );
}

import type { ReactNode } from "react";
import { RADIUS } from "@/components/ui/tokens";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/**
 * Consistent empty-list treatment (bookings, messages, notifications) — a
 * short human sentence plus exactly one next action. Never render a bare
 * "No data" message; every consumer should pass at least a title.
 */
export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 border border-dashed border-neutral-200 px-6 py-10 text-center ${RADIUS.lg} ${className}`.trim()}
    >
      {icon ? <div className="text-neutral-400">{icon}</div> : null}
      <p className="font-heading text-base font-semibold text-neutral-900">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-neutral-500">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

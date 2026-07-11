import { RADIUS } from "@/components/ui/tokens";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export type SkeletonProps = {
  className?: string;
};

function SkeletonSpinnerHeader() {
  return (
    <div className="flex justify-center pb-4">
      <LoadingSpinner size="md" />
    </div>
  );
}

/** A single content-shaped loading block. Compose with `SkeletonListRows`/`SkeletonDetailHeader` below. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-neutral-200/70 ${RADIUS.sm} ${className}`.trim()}
      aria-hidden
    />
  );
}

/** Placeholder for a list of booking/notification rows while data is in flight — never a bare spinner. */
export function SkeletonListRows({ rows = 4, showSpinner = true }: { rows?: number; showSpinner?: boolean }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {showSpinner ? <SkeletonSpinnerHeader /> : null}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`flex items-center gap-3 border border-neutral-100 p-3 ${RADIUS.md}`}>
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a booking/notification detail header while data is in flight. */
export function SkeletonDetailHeader({ showSpinner = true }: { showSpinner?: boolean }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      {showSpinner ? <SkeletonSpinnerHeader /> : null}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

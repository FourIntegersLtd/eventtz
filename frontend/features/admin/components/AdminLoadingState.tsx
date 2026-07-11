"use client";

import { LoadingState } from "@/components/ui/LoadingState";
import { SkeletonListRows } from "@/components/ui/Skeleton";

type AdminLoadingStateProps = {
  label?: string;
  rows?: number;
};

export function AdminLoadingState({ label = "Loading…", rows = 4 }: AdminLoadingStateProps) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <LoadingState label={label} variant="centered" className="py-2" />
      <SkeletonListRows rows={rows} showSpinner={false} />
    </div>
  );
}

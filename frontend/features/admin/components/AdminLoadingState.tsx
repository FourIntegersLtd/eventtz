"use client";

import { SkeletonListRows } from "@/components/ui/Skeleton";

type AdminLoadingStateProps = {
  label?: string;
  rows?: number;
};

export function AdminLoadingState({ label = "Loading…", rows = 4 }: AdminLoadingStateProps) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <p className="text-sm text-neutral-500">{label}</p>
      <SkeletonListRows rows={rows} />
    </div>
  );
}

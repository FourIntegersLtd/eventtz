"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminDisputesPanel } from "@/domains/admin-trust/AdminDisputesPanel";
import { AdminReviewsPanel } from "@/domains/admin-trust/AdminReviewsPanel";

const TABS = [
  { value: "disputes", label: "Disputes" },
  { value: "reviews", label: "Reviews" },
] as const;

type Tab = (typeof TABS)[number]["value"];

/** `/admin/trust` — disputes and reviews behind a `?tab=` pill bar. */
export function AdminTrustView() {
  return (
    <Suspense>
      <TrustTabs />
    </Suspense>
  );
}

function TrustTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab | null) ?? "disputes";

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => router.push(`/admin/trust?tab=${option.value}`)}
            className={
              tab === option.value
                ? "rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white"
                : "rounded-full bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      {tab === "disputes" ? <AdminDisputesPanel /> : null}
      {tab === "reviews" ? <AdminReviewsPanel /> : null}
    </div>
  );
}

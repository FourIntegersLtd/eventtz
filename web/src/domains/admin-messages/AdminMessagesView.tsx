"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminMessagesInboxView } from "@/domains/admin-messages/AdminMessagesInboxView";
import { AdminMessagesComposeView } from "@/domains/admin-messages/AdminMessagesComposeView";

const TABS = [
  { value: "inbox", label: "Inbox" },
  { value: "compose", label: "Compose" },
] as const;

type Tab = (typeof TABS)[number]["value"];

/** `/admin/messages` — support inbox and compose behind a `?tab=` pill bar, matching the baseline's tab set. */
export function AdminMessagesView() {
  return (
    <Suspense>
      <MessagesTabs />
    </Suspense>
  );
}

function MessagesTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab | null) ?? "inbox";

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => router.push(`/admin/messages?tab=${option.value}`)}
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
      {tab === "inbox" ? <AdminMessagesInboxView /> : null}
      {tab === "compose" ? <AdminMessagesComposeView /> : null}
    </div>
  );
}

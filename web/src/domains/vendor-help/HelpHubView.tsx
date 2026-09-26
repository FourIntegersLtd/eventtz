"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HelpArticleBrowser } from "@/domains/vendor-help/HelpArticleBrowser";
import { SupportMessagesView } from "@/domains/vendor-help/SupportMessagesView";

export type HelpHubTab = "help" | "messages";

/** Reads `?tab=`, defaulting to the article browser — matches the baseline's `parseHelpHubTab`. */
export function parseHelpHubTab(value: string | null): HelpHubTab {
  return value === "messages" ? "messages" : "help";
}

/**
 * `/vendor/help`: a Help Center (articles + Ask assistant) and a Messages
 * tab showing the vendor's chat inbox — the two things the baseline's
 * `HelpHubView` combines on this route. A vendor wanting to email the team
 * directly is sent to `/vendor/contact` (a separate route another
 * workstream owns), rather than this domain re-embedding that form.
 */
export function HelpHubView({ selectedConversationId }: { selectedConversationId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = selectedConversationId ? "messages" : parseHelpHubTab(searchParams.get("tab"));

  function goToTab(nextTab: HelpHubTab) {
    router.push(nextTab === "help" ? "/vendor/help" : "/vendor/help?tab=messages");
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex gap-2">
        <TabButton active={tab === "help"} onClick={() => goToTab("help")} label="Help Center" />
        <TabButton active={tab === "messages"} onClick={() => goToTab("messages")} label="Messages" />
      </div>

      {tab === "help" ? (
        <>
          <HelpArticleBrowser />
          <p className="text-center text-sm text-neutral-500">
            Need a direct reply?{" "}
            <Link href="/vendor/contact" className="font-medium text-primary hover:underline">
              Contact the team
            </Link>
            .
          </p>
        </>
      ) : (
        <SupportMessagesView selectedConversationId={selectedConversationId} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
        active ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
      }`}
    >
      {label}
    </button>
  );
}

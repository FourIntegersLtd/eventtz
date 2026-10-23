"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import { HelpHubView } from "@/features/help/HelpHubView";
import { parseHelpHubTab } from "@/lib/helpHub";

function ClientHelpContent() {
  const searchParams = useSearchParams();
  const tab = parseHelpHubTab(searchParams.get("tab"));

  return (
    <div className="ez-stack ez-stack--lg flex h-full min-h-0 flex-1 flex-col">
      <PageHeader title="Help" description="Message Eventtz Support or send us a note." />
      <HelpHubView portal="client" tab={tab} useEzChrome />
    </div>
  );
}

export default function ClientHelpPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading help…" variant="centered" branded />}>
      <ClientHelpContent />
    </Suspense>
  );
}

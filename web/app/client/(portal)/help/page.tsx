"use client";

import { useSearchParams } from "next/navigation";
import { HelpHubView } from "@/features/help/HelpHubView";
import { parseHelpHubTab } from "@/lib/helpHub";

export default function ClientHelpPage() {
  const searchParams = useSearchParams();
  const tab = parseHelpHubTab(searchParams.get("tab"));

  return <HelpHubView portal="client" tab={tab} />;
}

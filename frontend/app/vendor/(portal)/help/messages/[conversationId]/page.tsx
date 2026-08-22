"use client";

import { useParams } from "next/navigation";
import { HelpHubView } from "@/features/help/HelpHubView";

export default function VendorHelpMessagesThreadPage() {
  const params = useParams();
  const conversationId =
    typeof params?.conversationId === "string" ? params.conversationId : "";

  if (!conversationId) {
    return <p className="text-sm text-neutral-600">Invalid conversation.</p>;
  }

  return <HelpHubView portal="vendor" tab="messages" selectedConversationId={conversationId} />;
}

"use client";

import { useParams } from "next/navigation";
import { HelpHubView } from "@/features/help/HelpHubView";

export default function ClientHelpMessagesThreadPage() {
  const params = useParams();
  const conversationId =
    typeof params?.conversationId === "string" ? params.conversationId : "";

  if (!conversationId) {
    return <p className="text-sm text-neutral-600">Invalid conversation.</p>;
  }

  return <HelpHubView portal="client" tab="messages" selectedConversationId={conversationId} />;
}

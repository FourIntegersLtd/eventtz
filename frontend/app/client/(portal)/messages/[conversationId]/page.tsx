"use client";

import { useParams } from "next/navigation";
import { ChatPortalView } from "@/features/chat/ChatPortalView";

export default function ClientMessagesThreadPage() {
  const params = useParams();
  const conversationId =
    typeof params?.conversationId === "string" ? params.conversationId : "";

  if (!conversationId) {
    return <p className="text-sm text-neutral-600">Invalid conversation.</p>;
  }

  return <ChatPortalView portal="client" selectedConversationId={conversationId} />;
}

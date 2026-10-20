"use client";

import { useParams } from "next/navigation";
import { VendorMessagesEzView } from "@/features/chat/VendorMessagesEzView";

export default function VendorMessagesThreadPage() {
  const params = useParams();
  const conversationId = typeof params?.conversationId === "string" ? params.conversationId : "";

  if (!conversationId) {
    return <p className="ez-small">Invalid conversation.</p>;
  }

  return <VendorMessagesEzView selectedConversationId={conversationId} />;
}

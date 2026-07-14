"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { getApiErrorDetail } from "@/lib/api-errors";
import { CHAT_UNREAD_CLEARED_EVENT, postConversation, postMessage } from "@/lib/chatApi";
import { ChatThreadView } from "@/features/chat/ChatThreadView";
import { MessageComposer } from "@/features/chat/MessageComposer";

type ChatDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  portal: "client" | "vendor";
  /** The other party's display name, used as the drawer title. */
  counterpartyName: string;
  /** Existing conversation — opens straight into the thread. */
  conversationId?: string | null;
  /** No conversation yet — the drawer composes the first message, then flips into the thread. */
  counterpartyUserId?: string;
  /** Fires once a conversation is created from the first-message composer. */
  onConversationCreated?: (conversationId: string) => void;
};

/**
 * Chat as a slide-over, launched from booking detail or a vendor's profile —
 * replaces the old modal-then-navigate-to-/messages flow so the user never
 * loses their place on the page they were on.
 */
export function ChatDrawer({
  isOpen,
  onClose,
  portal,
  counterpartyName,
  conversationId,
  counterpartyUserId,
  onConversationCreated,
}: ChatDrawerProps) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversationId ?? null,
  );
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setActiveConversationId(conversationId ?? null);
  }, [isOpen, conversationId]);

  const shortName = counterpartyName.trim().split(/\s+/)[0] || counterpartyName || "them";

  const startConversation = async () => {
    const text = draft.trim();
    if (!text || busy || !counterpartyUserId) return;
    setBusy(true);
    setError(null);
    try {
      const conv = await postConversation(counterpartyUserId);
      await postMessage(conv.id, text);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CHAT_UNREAD_CLEARED_EVENT));
      }
      setDraft("");
      setActiveConversationId(conv.id);
      onConversationCreated?.(conv.id);
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not start the conversation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`Message ${counterpartyName || shortName}`}>
      {activeConversationId ? (
        <ChatThreadView portal={portal} conversationId={activeConversationId} variant="drawer" />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600">
            Your first message opens a thread in Messages.
          </p>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          <MessageComposer
            variant="compose"
            value={draft}
            onChange={setDraft}
            onSend={() => void startConversation()}
            loading={busy}
            rows={8}
            placeholder={`Ask ${shortName} a question or share your project details (requirements, timeline, budget, etc.)`}
            sendLabel="Send message"
            enterToSend={false}
          />
        </div>
      )}
    </Drawer>
  );
}

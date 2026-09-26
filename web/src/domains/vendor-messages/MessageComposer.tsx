"use client";

import type { KeyboardEvent } from "react";
import { Button } from "@/foundation/ui";

/** A message body may not exceed this (mirrors `MessageCreateBody.body`'s `maxLength`). */
export const MESSAGE_MAX_LENGTH = 5000;

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
}

/** The textarea + send button a vendor types a chat reply into. */
export function MessageComposer({ value, onChange, onSend, sending }: MessageComposerProps) {
  const canSend = value.trim().length > 0 && !sending;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a newline — the thread convention every chat app uses.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <div className="flex items-end gap-3">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
        onKeyDown={handleKeyDown}
        placeholder="Type a message…"
        rows={2}
        disabled={sending}
        aria-label="Message"
        className="min-h-[64px] w-full min-w-0 flex-1 resize-none rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-900 ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
      />
      <Button type="button" onClick={onSend} disabled={!canSend} loading={sending} className="shrink-0">
        Send
      </Button>
    </div>
  );
}

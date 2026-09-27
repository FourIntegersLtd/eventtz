"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Button } from "@/foundation/ui";
import { clampMessageDraft, MESSAGE_MAX_LENGTH } from "@/domains/messages/composerDraft";

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
}

/**
 * The thread composer: a growing textarea, a character count, and Send.
 * Enter sends; Shift+Enter inserts a newline. The field is disabled while
 * a send is in flight so a second submit cannot start.
 */
export function MessageComposer({ value, onChange, onSend, sending }: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !sending;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [value]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <div>
      <div className="flex min-w-0 items-end gap-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(clampMessageDraft(event.target.value))}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={2}
          maxLength={MESSAGE_MAX_LENGTH}
          disabled={sending}
          aria-label="Message"
          className="min-h-[72px] w-full min-w-0 flex-1 resize-none rounded-xl bg-neutral-50 px-4 py-3 text-base text-neutral-900 ring-1 ring-neutral-200/60 transition placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60 md:text-sm"
        />
        <Button type="button" onClick={onSend} disabled={!canSend} loading={sending} className="shrink-0">
          Send
        </Button>
      </div>
      <p className="mt-1.5 text-right text-[11px] tabular-nums text-neutral-400">
        {value.length}/{MESSAGE_MAX_LENGTH}
      </p>
    </div>
  );
}

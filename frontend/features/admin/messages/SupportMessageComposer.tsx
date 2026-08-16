"use client";

import type { ReactNode } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MESSAGE_MAX_LEN } from "@/features/chat/MessageComposer";
import {
  plainTextToSupportHtml,
  SupportRichTextEditor,
  type SupportRichTextChange,
} from "@/features/admin/messages/SupportRichTextEditor";

type SupportMessageComposerProps = {
  html: string;
  textLength: number;
  onChange: (payload: SupportRichTextChange) => void;
  onSend?: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  sendLabel?: string;
  showSendButton?: boolean;
  /** Extra controls between the editor and the footer row (e.g. email layout picker). */
  middleSlot?: ReactNode;
  /** Replaces the default Send button on the footer row. */
  footerActions?: ReactNode;
  minHeightClass?: string;
  className?: string;
  /** Remount editor when this key changes (e.g. after send or when loading edit draft). */
  editorKey?: string;
  initialHtml?: string;
};

export function SupportMessageComposer({
  html,
  textLength,
  onChange,
  onSend,
  loading = false,
  disabled = false,
  placeholder = "Write a support message…",
  sendLabel = "Send",
  showSendButton = true,
  middleSlot,
  footerActions,
  minHeightClass,
  className = "",
  editorKey,
  initialHtml = "",
}: SupportMessageComposerProps) {
  const busy = loading || disabled;
  const canSend = isSupportDraftValid(textLength) && !busy;

  return (
    <div className={className}>
      <SupportRichTextEditor
        key={editorKey}
        initialHtml={initialHtml || html}
        onChange={onChange}
        disabled={busy}
        placeholder={placeholder}
        minHeightClass={minHeightClass}
      />
      {middleSlot ? <div className="mt-4 space-y-3">{middleSlot}</div> : null}
      <div className="mt-3 flex items-center justify-between gap-3">
        <SupportMessageLengthCounter textLength={textLength} />
        {footerActions ??
          (showSendButton && onSend ? (
            <Button
              variant="primary"
              icon={<Send className="h-4 w-4" aria-hidden />}
              disabled={!canSend}
              loading={loading}
              onClick={onSend}
            >
              {sendLabel}
            </Button>
          ) : null)}
      </div>
    </div>
  );
}

export function SupportMessageLengthCounter({ textLength }: { textLength: number }) {
  return (
    <span
      className={`text-xs tabular-nums ${
        textLength > MESSAGE_MAX_LEN ? "text-red-600" : "text-neutral-400"
      }`}
    >
      {textLength}/{MESSAGE_MAX_LEN}
    </span>
  );
}

export function emptySupportDraft(): SupportRichTextChange {
  return { html: "", textLength: 0 };
}

export function supportDraftFromPlainText(text: string): SupportRichTextChange {
  const trimmed = text.trim();
  return {
    html: plainTextToSupportHtml(trimmed),
    textLength: trimmed.length,
  };
}

export function isSupportDraftValid(textLength: number): boolean {
  return textLength > 0 && textLength <= MESSAGE_MAX_LEN;
}

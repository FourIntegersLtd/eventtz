"use client";

import { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MESSAGE_MAX_LEN } from "@/lib/validation/supportMessage";


type MessageComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  /** Disabled while parent is loading/sending. */
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  /** "thread" = compact inline; "compose" = taller first-message style. */
  variant?: "thread" | "compose";
  sendLabel?: string;
  /** When false, Enter does not send (Shift+Enter still newline). Default true for thread. */
  enterToSend?: boolean;
  /** When false, hide the inline send button (parent supplies its own). Default true. */
  showSendButton?: boolean;
  className?: string;
  textareaClassName?: string;
};

/**
 * Shared chat / admin message body composer (textarea + send + char count).
 */
export function MessageComposer({
  value,
  onChange,
  onSend,
  loading = false,
  disabled = false,
  placeholder = "Type a message…",
  rows = 2,
  variant = "thread",
  sendLabel = "Send",
  enterToSend = variant === "thread",
  showSendButton = true,
  className = "",
  textareaClassName = "",
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || variant !== "thread") return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value, variant]);

  const busy = loading || disabled;
  const canSend = Boolean(value.trim()) && !busy;

  const defaultTextarea =
    variant === "compose"
      ? "w-full resize-y rounded-xl border border-line bg-surface-3 px-3 py-2.5 text-base text-ink placeholder:text-ink-3 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 md:text-sm"
      : "min-h-[72px] w-full min-w-0 flex-1 resize-none rounded-xl bg-surface-3 px-4 py-3 text-base text-ink placeholder:text-ink-3 ring-1 ring-line transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60 md:text-sm";

  return (
    <div className={className}>
      <div
        className={
          variant === "compose"
            ? "flex flex-col gap-3"
            : "flex min-w-0 items-end gap-3"
        }
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MESSAGE_MAX_LEN))}
          placeholder={placeholder}
          rows={rows}
          disabled={busy}
          className={`${defaultTextarea} ${textareaClassName}`.trim()}
          aria-label="Message"
          onKeyDown={(e) => {
            if (!enterToSend) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
        />
        {variant === "compose" ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-3">
              {value.length}/{MESSAGE_MAX_LEN}
            </span>
            {showSendButton ? (
              <Button
                variant="primary"
                icon={<Send className="h-4 w-4" aria-hidden />}
                disabled={!canSend}
                loading={loading}
                onClick={onSend}
              >
                {sendLabel}
              </Button>
            ) : null}
          </div>
        ) : showSendButton ? (
          <Button
            variant="primary"
            size="md"
            loading={loading}
            disabled={!canSend}
            icon={<Send className="h-4 w-4" aria-hidden />}
            onClick={onSend}
            className="shrink-0"
          >
            {sendLabel}
          </Button>
        ) : null}
      </div>
      {variant === "thread" ? (
        <p className="mt-1.5 text-right text-[11px] tabular-nums text-ink-3">
          {value.length}/{MESSAGE_MAX_LEN}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { RotatingTypewriterPlaceholder } from "@/components/ui/RotatingTypewriterPlaceholder";
import { AbbaChatEmptyState } from "@/features/vendor/copilot/AbbaChatEmptyState";
import { helpMarkdownProseClassName, helpMarkdownToHtml } from "@/features/help/helpContent";
import { VENDOR_COPILOT } from "@/features/vendor/copilot/copilotBranding";
import {
  askVendorCopilot,
  type CopilotAction,
  type CopilotAskMessage,
  vendorCopilotErrorMessage,
} from "@/lib/vendorCopilotApi";
import { formControlClass } from "@/components/ui/tokens";

type ThreadItem =
  | { kind: "user"; content: string }
  | {
      kind: "assistant";
      content: string;
      actions: CopilotAction[];
      escalate: boolean;
    };

type Props = {
  embedded?: boolean;
  initialQuestion?: string;
  bookingId?: string | null;
  onClose?: () => void;
};

function ActionChip({ action }: { action: CopilotAction }) {
  const href = action.href ?? "/vendor/profile";
  return (
    <Link
      href={href}
      className="block rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-xs transition hover:border-primary/30 hover:bg-primary/[0.03]"
    >
      <span className="font-semibold text-neutral-900">{action.title}</span>
      <span className="mt-0.5 block text-neutral-600">{action.rationale}</span>
    </Link>
  );
}

export function VendorCopilotThread({
  embedded = false,
  initialQuestion,
  bookingId,
  onClose,
}: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [history, setHistory] = useState<CopilotAskMessage[]>([]);
  const seeded = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setThread((t) => [...t, { kind: "user", content: q }]);
    setInput("");
    try {
      const res = await askVendorCopilot({
        question: q,
        history,
        booking_request_id: bookingId ?? undefined,
      });
      setHistory((h) => [
        ...h,
        { message_role: "user", content: q },
        { message_role: "assistant", content: res.answer_markdown },
      ]);
      setThread((t) => [
        ...t,
        {
          kind: "assistant",
          content: res.answer_markdown,
          actions: res.suggested_actions,
          escalate: res.escalate_to_human,
        },
      ]);
    } catch (e: unknown) {
      setError(vendorCopilotErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread, busy]);

  useEffect(() => {
    const seed = (initialQuestion ?? "").trim();
    if (!seed || seeded.current) return;
    seeded.current = true;
    void send(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${embedded ? "" : "max-h-[70vh]"}`}>
      {!embedded ? (
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <p className="text-sm font-semibold text-neutral-900">{VENDOR_COPILOT.name}</p>
          </div>
          {onClose ? (
            <button type="button" onClick={onClose} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100">
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {thread.length === 0 && !busy ? (
          <AbbaChatEmptyState embedded={embedded} onAskFocus={(question) => void send(question)} />
        ) : null}

        <div className="space-y-4">
          {thread.map((item, i) =>
            item.kind === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-white">
                  {item.content}
                </p>
              </div>
            ) : (
              <div key={i} className="space-y-2">
                <div
                  className={`max-w-[95%] rounded-2xl rounded-bl-md border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-800 ${helpMarkdownProseClassName}`}
                  dangerouslySetInnerHTML={{ __html: helpMarkdownToHtml(item.content) }}
                />
                {item.actions.length > 0 ? (
                  <div className="space-y-1.5 pl-1">
                    {item.actions.map((action, j) => (
                      <ActionChip key={j} action={action} />
                    ))}
                  </div>
                ) : null}
                {item.escalate ? (
                  <Link
                    href="/vendor/contact"
                    className="inline-block text-xs font-semibold text-primary hover:underline"
                  >
                    Contact Eventtz support →
                  </Link>
                ) : null}
              </div>
            ),
          )}
        </div>
        {busy ? (
          <div className="mt-3 flex items-center gap-2">
            <LottieIllustration asset="aiThinking" size="inline" className="mx-0" ariaLabel="" />
            <p className="text-xs text-neutral-500">Thinking…</p>
          </div>
        ) : null}
        {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="shrink-0 border-t border-neutral-100 bg-white px-4 py-3"
      >
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <RotatingTypewriterPlaceholder
              examples={VENDOR_COPILOT.exampleQuestions}
              visible={!input.trim() && !busy}
              compact
              className="px-4"
              textClassName="text-neutral-500"
            />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder=""
              aria-label="Ask Abba a question"
              disabled={busy}
              className={formControlClass("rounded-xl bg-neutral-100 px-4 focus:ring-1 focus:ring-neutral-300 disabled:opacity-60")}
            />
          </div>
          <Button type="submit" size="sm" disabled={busy || !input.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

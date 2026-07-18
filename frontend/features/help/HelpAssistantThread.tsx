"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { portalCard, portalCardPadding } from "@/components/portal-shell/portalTheme";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  askHelpAssistant,
  type HelpAskMessage,
  type HelpAudience,
} from "@/lib/helpApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import {
  helpBasePath,
  helpContactPath,
  helpMarkdownToHtml,
} from "@/features/help/helpContent";

type Props = {
  audience: HelpAudience;
  /** When embedded in the widget, hide page chrome. */
  embedded?: boolean;
  /** Seed question (widget); page mode also reads `?q=`. */
  initialQuestion?: string;
  onClose?: () => void;
  /** Open a related article inside the help widget. */
  onOpenArticle?: (slug: string) => void;
};

type ThreadItem =
  | { kind: "user"; content: string }
  | {
      kind: "assistant";
      content: string;
      related: string[];
      escalate: boolean;
      escalateReason: string | null;
    };

function HelpAssistantThreadInner({
  audience,
  embedded,
  initialQuestion,
  onClose,
  onOpenArticle,
  urlQ,
}: Props & { urlQ: string }) {
  const seed = (initialQuestion ?? urlQ).trim();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [history, setHistory] = useState<HelpAskMessage[]>([]);
  const seeded = useRef(false);
  const base = helpBasePath(audience);
  const contactHref = helpContactPath(audience);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setThread((t) => [...t, { kind: "user", content: q }]);
    setInput("");
    track(MixpanelEvents.help_ask_submitted, { audience });
    try {
      const res = await askHelpAssistant({
        question: q,
        audience,
        history,
      });
      setHistory((h) => [
        ...h,
        { role: "user", content: q },
        { role: "assistant", content: res.answer_markdown },
      ]);
      setThread((t) => [
        ...t,
        {
          kind: "assistant",
          content: res.answer_markdown,
          related: res.related_article_slugs,
          escalate: res.escalate_to_human,
          escalateReason: res.escalate_reason,
        },
      ]);
      if (res.escalate_to_human) {
        track(MixpanelEvents.help_escalated, {
          audience,
          reason: res.escalate_reason ?? "unknown",
        });
      }
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Assistant unavailable. Try again or contact us.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!seed || seeded.current) return;
    seeded.current = true;
    void send(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, [seed]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div className={embedded ? "flex h-full min-h-0 flex-col" : "mx-auto max-w-2xl space-y-4"}>
      {!embedded ? (
        <div className="flex items-center justify-between gap-3">
          <BackLink href={base} label="Help Center" tone="muted" />
        </div>
      ) : null}

      {!embedded ? (
        <div>
          <h1 className="font-heading text-2xl font-semibold text-neutral-900">
            Ask our assistant
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Answers from Eventtz help articles. For refunds and disputes, we may send you to Contact.
          </p>
        </div>
      ) : null}

      <div
        className={
          embedded
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : `${portalCard} ${portalCardPadding} flex min-h-[28rem] flex-col`
        }
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-0.5 py-1">
          {thread.length === 0 && !busy ? (
            <p className="text-[14px] text-neutral-500">
              Ask how booking, payments, or your portal works.
            </p>
          ) : null}
          {thread.map((item, i) =>
            item.kind === "user" ? (
              <div key={i} className="flex justify-end">
                <p
                  className={
                    embedded
                      ? "max-w-[85%] rounded-2xl bg-neutral-900 px-3.5 py-2 text-[14px] text-white"
                      : "max-w-[85%] rounded-2xl bg-primary px-3.5 py-2 text-sm text-white"
                  }
                >
                  {item.content}
                </p>
              </div>
            ) : (
              <div key={i} className="max-w-[95%] space-y-2">
                <div
                  className="rounded-2xl bg-neutral-100 px-3.5 py-2.5 text-[14px] text-neutral-800"
                  dangerouslySetInnerHTML={{
                    __html: helpMarkdownToHtml(item.content),
                  }}
                />
                {item.related.length > 0 ? (
                  <ul className="space-y-1 pl-1 text-[13px]">
                    {item.related.map((slug) => (
                      <li key={slug}>
                        {onOpenArticle ? (
                          <button
                            type="button"
                            onClick={() => onOpenArticle(slug)}
                            className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                          >
                            {slug.replace(/^(client|vendor)-/, "").replace(/-/g, " ")}
                          </button>
                        ) : (
                          <Link
                            href={`${base}/a/${encodeURIComponent(slug)}`}
                            onClick={onClose}
                            className="font-medium text-primary hover:underline"
                          >
                            {slug.replace(/^(client|vendor)-/, "").replace(/-/g, " ")}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {item.escalate ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-800">
                    <p className="font-medium">
                      {audience === "admin" ? "Ask a super admin" : "Talk to a human"}
                    </p>
                    <p className="mt-1 text-neutral-600">
                      This looks like something our team should handle
                      {item.escalateReason ? ` (${item.escalateReason})` : ""}.
                    </p>
                    {contactHref ? (
                      <Link
                        href={contactHref}
                        onClick={onClose}
                        className="mt-2 inline-block font-semibold text-neutral-900 underline-offset-2 hover:underline"
                      >
                        Open Contact
                      </Link>
                    ) : audience === "admin" ? (
                      <Link
                        href="/admin/team"
                        onClick={onClose}
                        className="mt-2 inline-block font-semibold text-neutral-900 underline-offset-2 hover:underline"
                      >
                        Open Admin team
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ),
          )}
          {busy ? <p className="text-[14px] text-neutral-500">Thinking...</p> : null}
          {error ? <p className="text-[14px] text-red-700">{error}</p> : null}
        </div>

        <form
          onSubmit={onSubmit}
          className={
            embedded
              ? "mt-2 flex gap-2 border-t border-neutral-100 pt-3"
              : "mt-3 flex gap-2 border-t border-neutral-100 pt-3"
          }
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={embedded ? "Search our help center or ask AI" : "Ask a question..."}
            disabled={busy}
            className={
              embedded
                ? "min-w-0 flex-1 rounded-xl bg-neutral-100 px-4 py-3 text-[14px] outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-neutral-300"
                : "min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            }
          />
          <Button type="submit" loading={busy} disabled={!input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Page mode: reads `?q=` via search params. */
function HelpAssistantThreadWithParams(props: Props) {
  const searchParams = useSearchParams();
  const urlQ = (searchParams.get("q") ?? "").trim();
  return <HelpAssistantThreadInner {...props} urlQ={urlQ} />;
}

export function HelpAssistantThread(props: Props) {
  if (props.embedded) {
    return <HelpAssistantThreadInner {...props} urlQ="" />;
  }
  return <HelpAssistantThreadWithParams {...props} />;
}

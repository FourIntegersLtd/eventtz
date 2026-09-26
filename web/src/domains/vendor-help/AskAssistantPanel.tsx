"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/foundation/ui";
import { hasCode } from "@/foundation/platform-client";
import { askHelpAssistant, type HelpAskMessage } from "@/domains/vendor-help/api";
import { slugToLabel } from "@/domains/vendor-help/helpFormatting";

type ThreadTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; relatedSlugs: string[]; escalate: boolean };

/**
 * A short Q&A panel backed by `POST /help/ask`: the vendor types a question,
 * gets an AI answer drawn from the Help Center articles, and — for a
 * question the assistant flags — a prompt to use Contact instead.
 */
export function AskAssistantPanel() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ThreadTurn[]>([]);
  const [history, setHistory] = useState<HelpAskMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    setBusy(true);
    setError(null);
    setTurns((previous) => [...previous, { role: "user", content: question }]);
    setInput("");
    try {
      const response = await askHelpAssistant(question, history);
      setHistory((previous) => [
        ...previous,
        { role: "user", content: question },
        { role: "assistant", content: response.answer_markdown },
      ]);
      setTurns((previous) => [
        ...previous,
        {
          role: "assistant",
          content: response.answer_markdown,
          relatedSlugs: response.related_article_slugs ?? [],
          escalate: response.escalate_to_human,
        },
      ]);
    } catch (cause) {
      setError(hasCode(cause, "help_question_required") ? "Type a question first." : "Our assistant is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Ask our assistant</h2>
      <p className="mt-1 text-sm text-neutral-500">Answers come from the Help Center articles above.</p>

      {turns.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {turns.map((turn, index) => (
            <li key={index} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm ${turn.role === "user" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-800"}`}>
                <p className="whitespace-pre-wrap">{turn.content}</p>
                {turn.role === "assistant" && turn.relatedSlugs.length > 0 ? (
                  <p className="mt-1.5 text-xs text-neutral-500">See also: {turn.relatedSlugs.map(slugToLabel).join(", ")}</p>
                ) : null}
                {turn.role === "assistant" && turn.escalate ? (
                  <p className="mt-1.5 text-xs font-medium text-neutral-700">
                    This may need a person — try the Contact page for a direct reply.
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a question…"
          disabled={busy}
          className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <Button type="submit" loading={busy} disabled={!input.trim()}>
          Ask
        </Button>
      </form>
    </div>
  );
}

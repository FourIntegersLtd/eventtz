"use client";

import { useEffect, useState } from "react";
import { platformErrorDetail, type components } from "@/foundation/platform-client";
import { Button, Card, Spinner } from "@/foundation/ui";
import {
  askCopilot,
  fetchCopilotBrief,
  fetchGrowthScore,
  type CopilotAskMessage,
  type GrowthScoreResponse,
  type VendorCopilotBriefResponse,
} from "@/capabilities/vendor-copilot-panel/api";

/** One lever behind the Growth Score, with its own sub-score and tip. */
type GrowthScoreLever = components["schemas"]["GrowthScoreLever"];
import { growthScoreBand, growthScoreStatusPresentation } from "@/capabilities/vendor-copilot-panel/growthScoreLabel";

const TONE_CLASS: Record<"success" | "warning" | "critical", string> = {
  success: "text-emerald-600",
  warning: "text-amber-600",
  critical: "text-red-600",
};

/** One Growth Score lever row: label, sub-score out of its max, and a status pill. */
function LeverRow({ lever }: { lever: GrowthScoreLever }) {
  const presentation = growthScoreStatusPresentation(lever.status);
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-neutral-800">{lever.label}</p>
        <p className="text-xs text-neutral-500">{lever.tip}</p>
      </div>
      <span className={`shrink-0 font-semibold ${TONE_CLASS[presentation.tone]}`}>
        {lever.score}/{lever.max_score}
      </span>
    </li>
  );
}

/**
 * The vendor growth co-pilot: score, AI daily brief, and a free-text ask box.
 *
 * Shared by the dashboard and analytics pages (see this capability's
 * hand-off note on why it lives under `capabilities/` rather than a domain).
 */
export function CopilotPanel() {
  const [score, setScore] = useState<GrowthScoreResponse | null>(null);
  const [brief, setBrief] = useState<VendorCopilotBriefResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<CopilotAskMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [scoreResult, briefResult] = await Promise.all([fetchGrowthScore(), fetchCopilotBrief()]);
        if (cancelled) return;
        setScore(scoreResult);
        setBrief(briefResult);
      } catch (cause: unknown) {
        if (!cancelled) setLoadError(platformErrorDetail(cause) ?? "Could not load your growth co-pilot.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onAsk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    setAsking(true);
    setAskError(null);
    try {
      const result = await askCopilot({ question: trimmedQuestion, history });
      setHistory((previous) => [
        ...previous,
        { role: "user", content: trimmedQuestion },
        { role: "assistant", content: result.answer_markdown },
      ]);
      setQuestion("");
    } catch (cause: unknown) {
      setAskError(platformErrorDetail(cause) ?? "The co-pilot could not answer that. Try again.");
    } finally {
      setAsking(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <Spinner label="Loading your growth co-pilot…" />
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <p className="text-sm text-red-700">{loadError}</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-lg font-semibold text-neutral-900">Growth co-pilot</h2>
          {score ? (
            <span className={`text-2xl font-bold ${TONE_CLASS[growthScoreBand(score.score)]}`}>{score.score}</span>
          ) : null}
        </div>
        {brief ? <p className="mt-1 text-sm text-neutral-600">{brief.greeting}</p> : null}
      </div>

      {brief ? <p className="whitespace-pre-line text-sm text-neutral-700">{brief.summary_markdown}</p> : null}

      {score?.levers?.length ? (
        <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
          {score.levers.map((lever) => (
            <LeverRow key={lever.metric_key} lever={lever} />
          ))}
        </ul>
      ) : null}

      <form onSubmit={(event) => void onAsk(event)} className="space-y-2 border-t border-neutral-100 pt-4">
        <label htmlFor="copilot-question" className="block text-sm font-medium text-neutral-700">
          Ask the co-pilot
        </label>
        <div className="flex gap-2">
          <input
            id="copilot-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="How do I improve my response time?"
            className="w-full rounded-xl border border-primary-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-border"
          />
          <Button type="submit" loading={asking} disabled={!question.trim()}>
            Ask
          </Button>
        </div>
        {askError ? <p className="text-sm text-red-700">{askError}</p> : null}
      </form>

      {history.length > 0 ? (
        <ul className="space-y-3 border-t border-neutral-100 pt-4 text-sm">
          {history.map((turn, index) => (
            <li key={`${turn.role}-${index}`} className={turn.role === "user" ? "text-neutral-900" : "text-neutral-700"}>
              <span className="font-semibold">{turn.role === "user" ? "You: " : "Co-pilot: "}</span>
              <span className="whitespace-pre-line">{turn.content}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

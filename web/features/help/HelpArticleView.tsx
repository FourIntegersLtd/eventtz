"use client";

import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { LoadingState } from "@/components/ui/LoadingState";
import { getApiErrorDetail } from "@/lib/api-errors";
import { ARTICLE_NOT_FOUND } from "@/lib/help-messages";
import {
  fetchHelpArticle,
  type HelpArticleDetail,
  type HelpAudience,
} from "@/lib/helpApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { HelpArticleBody } from "@/features/help/HelpArticleBody";
import { helpBasePath } from "@/features/help/helpContent";
import { formControlClass } from "@/components/ui/tokens";

type Props = { audience: HelpAudience };

export function HelpArticleView({ audience }: Props) {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [article, setArticle] = useState<HelpArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState("");
  const base = helpBasePath(audience);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    void fetchHelpArticle(slug, audience)
      .then((row) => {
        if (cancelled) return;
        setArticle(row);
        track(MixpanelEvents.help_article_viewed, {
          audience,
          slug: row.slug,
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(getApiErrorDetail(e) ?? ARTICLE_NOT_FOUND);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audience, slug]);

  const onAsk = (e: FormEvent) => {
    e.preventDefault();
    const q = ask.trim();
    if (!q) return;
    router.push(`${base}/ask?q=${encodeURIComponent(q)}`);
  };

  const backHref = article?.category_slug
    ? `${base}/c/${encodeURIComponent(article.category_slug)}`
    : base;

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-24">
      <BackLink href={backHref} label="Back" tone="muted" />
      {loading ? (
        <LoadingState label="Loading article…" variant="centered" className="py-12" />
      ) : error || !article ? (
        <p className="text-sm text-red-700">{error ?? ARTICLE_NOT_FOUND}</p>
      ) : (
        <>
          <article>
            <HelpArticleBody
              article={article}
              relatedHref={(s) => `${base}/a/${encodeURIComponent(s)}`}
            />
          </article>

          <form
            onSubmit={onAsk}
            className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-100 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:rounded-2xl sm:border sm:border-neutral-100 sm:bg-white sm:px-4 sm:py-3"
          >
            <div className="mx-auto flex max-w-2xl gap-2">
              <input
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder="Search our help center or ask AI"
                className={formControlClass("min-w-0 flex-1 rounded-xl border-neutral-200 bg-neutral-50 focus:ring-1 focus:ring-primary")}
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
              >
                Ask
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

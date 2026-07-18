"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { portalCard, portalCardPadding } from "@/components/portal-shell/portalTheme";
import { LoadingState } from "@/components/ui/LoadingState";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  fetchHelpArticle,
  type HelpArticleDetail,
  type HelpAudience,
} from "@/lib/helpApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { helpBasePath, helpMarkdownToHtml } from "@/features/help/helpContent";

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
        if (!cancelled) setError(getApiErrorDetail(e) ?? "Article not found.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audience, slug]);

  const html = useMemo(
    () => (article ? helpMarkdownToHtml(article.body_md) : ""),
    [article],
  );

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
        <p className="text-sm text-red-700">{error ?? "Article not found."}</p>
      ) : (
        <>
          <article className={`${portalCard} ${portalCardPadding}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              {article.category_title}
            </p>
            <h1 className="font-heading mt-2 text-2xl font-semibold text-neutral-900">
              {article.title}
            </h1>
            {article.summary ? (
              <p className="mt-2 text-sm text-neutral-500">{article.summary}</p>
            ) : null}
            <div
              className="help-article-body mt-2"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {article.related_slugs.length > 0 ? (
              <div className="mt-8 border-t border-neutral-100 pt-5">
                <h2 className="text-sm font-semibold text-neutral-900">Related articles</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {article.related_slugs.map((s) => (
                    <li key={s}>
                      <Link
                        href={`${base}/a/${encodeURIComponent(s)}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {s.replace(/^(client|vendor)-/, "").replace(/-/g, " ")}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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

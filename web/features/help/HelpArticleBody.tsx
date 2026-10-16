"use client";

import Link from "next/link";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  helpMarkdownToHtml,
} from "@/features/help/helpContent";
import type { HelpArticleDetail, HelpRelatedArticle } from "@/lib/helpApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";

export const helpArticleBodyClassName =
  "help-article-body font-sans [&_.help-callout-icon]:align-bottom [&_.help-callout_p]:text-[15px] sm:[&_.help-callout_p]:text-[14px] [&_.help-callout_strong]:font-semibold [&_.help-callout--note_strong]:text-sky-950 [&_.help-callout--warning_strong]:text-orange-950 [&_.help-callout--important_strong]:text-red-950 [&_.help-list-label+strong]:font-normal [&_h2]:font-heading [&_h2]:mt-9 [&_h2]:text-[1.125rem] [&_h2]:font-semibold [&_h2]:text-neutral-950 [&_h3]:font-heading [&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:text-neutral-700 sm:[&_li]:text-[14px] [&_ol]:mt-3 [&_p]:mt-3 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-neutral-700 sm:[&_p]:text-[14px] [&_ul]:mt-3";

export function helpRelatedArticles(article: HelpArticleDetail): HelpRelatedArticle[] {
  if (article.related_articles && article.related_articles.length > 0) {
    return article.related_articles;
  }
  return article.related_slugs.map((slug) => ({ slug, title: slug }));
}

type RelatedProps = {
  items: HelpRelatedArticle[];
  onOpenRelated?: (slug: string) => void;
  relatedHref?: (slug: string) => string;
};

function RelatedLinks({ items, onOpenRelated, relatedHref }: RelatedProps) {
  if (items.length === 0) return null;
  return (
    <div className="mt-10 border-t border-neutral-100 pt-6">
      <h2 className="text-[15px] font-semibold text-neutral-900">Related</h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.slug}>
            {onOpenRelated ? (
              <button
                type="button"
                onClick={() => onOpenRelated(item.slug)}
                className="text-left text-[15px] font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary sm:text-[14px]"
              >
                {item.title}
              </button>
            ) : relatedHref ? (
              <Link
                href={relatedHref(item.slug)}
                className="text-[15px] font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary sm:text-[14px]"
              >
                {item.title}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HelpfulPrompt({
  audience,
  slug,
}: {
  audience: string;
  slug: string;
}) {
  const [choice, setChoice] = useState<"up" | "down" | null>(null);
  return (
    <div className="mt-10 flex items-center gap-3 text-[13px] text-neutral-500">
      <span>Was this helpful?</span>
      <button
        type="button"
        aria-label="Yes, this was helpful"
        aria-pressed={choice === "up"}
        disabled={choice !== null}
        onClick={() => {
          setChoice("up");
          track(MixpanelEvents.help_article_feedback, {
            audience,
            slug,
            helpful: true,
          });
        }}
        className={`rounded-md p-1.5 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-100 ${
          choice === "up" ? "text-neutral-900" : ""
        }`}
      >
        <ThumbsUp className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="No, this was not helpful"
        aria-pressed={choice === "down"}
        disabled={choice !== null}
        onClick={() => {
          setChoice("down");
          track(MixpanelEvents.help_article_feedback, {
            audience,
            slug,
            helpful: false,
          });
        }}
        className={`rounded-md p-1.5 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-100 ${
          choice === "down" ? "text-neutral-900" : ""
        }`}
      >
        <ThumbsDown className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

type Props = {
  article: HelpArticleDetail;
  onOpenRelated?: (slug: string) => void;
  relatedHref?: (slug: string) => string;
};

export function HelpArticleBody({ article, onOpenRelated, relatedHref }: Props) {
  const html = useMemo(() => helpMarkdownToHtml(article.body_md), [article.body_md]);
  const related = helpRelatedArticles(article);

  return (
    <>
      <h1 className="font-heading text-[1.5rem] font-semibold leading-snug tracking-tight text-neutral-950 sm:text-[1.375rem]">
        {article.title}
      </h1>
      <div
        className={`${helpArticleBodyClassName} mt-4`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <RelatedLinks
        items={related}
        onOpenRelated={onOpenRelated}
        relatedHref={relatedHref}
      />
      <HelpfulPrompt audience={article.audience} slug={article.slug} />
    </>
  );
}

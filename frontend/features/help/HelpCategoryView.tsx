"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { portalCard } from "@/components/portal-shell/portalTheme";
import { LoadingState } from "@/components/ui/LoadingState";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  fetchHelpArticles,
  fetchHelpCategories,
  type HelpArticleListItem,
  type HelpAudience,
  type HelpCategory,
} from "@/lib/helpApi";
import {
  helpBasePath,
  helpCategoryIcon,
  helpCategoryIconVisual,
} from "@/features/help/helpContent";

type Props = { audience: HelpAudience };

export function HelpCategoryView({ audience }: Props) {
  const params = useParams();
  const categorySlug = typeof params.categorySlug === "string" ? params.categorySlug : "";
  const [category, setCategory] = useState<HelpCategory | null>(null);
  const [articles, setArticles] = useState<HelpArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const base = helpBasePath(audience);

  useEffect(() => {
    if (!categorySlug) return;
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      fetchHelpCategories(audience),
      fetchHelpArticles(audience, categorySlug),
    ])
      .then(([categories, rows]) => {
        if (!cancelled) {
          setCategory(categories.find((c) => c.slug === categorySlug) ?? null);
          setArticles(rows);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(getApiErrorDetail(e) ?? "Could not load articles.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audience, categorySlug]);

  const title = category?.title ?? articles[0]?.category_title ?? "Articles";
  const description = category?.description ?? "";
  const Icon = helpCategoryIcon(category?.icon_key ?? "book");
  const visual = helpCategoryIconVisual(category?.icon_key ?? "book");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <BackLink href={base} label="Help Center" tone="muted" />
      <div className="flex items-start gap-3">
        <span className={visual.shell}>
          <Icon className={`h-4 w-4 ${visual.icon}`} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl font-semibold text-neutral-900">{title}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {description || `Guides for your ${audience} portal`}
          </p>
        </div>
      </div>

      <div className={`${portalCard} overflow-hidden`}>
        {loading ? (
          <LoadingState label="Loading articles…" variant="inline" className="px-5 py-8" />
        ) : error ? (
          <p className="px-5 py-4 text-sm text-red-700">{error}</p>
        ) : articles.length === 0 ? (
          <p className="px-5 py-4 text-sm text-neutral-600">No articles in this topic yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {articles.map((a) => (
              <li key={a.id}>
                <Link
                  href={`${base}/a/${encodeURIComponent(a.slug)}`}
                  className="block px-5 py-3.5 text-sm text-neutral-800 transition hover:bg-primary-soft/40"
                >
                  <span className="font-medium text-neutral-900">{a.title}</span>
                  {a.summary ? (
                    <span className="mt-0.5 block text-neutral-500">{a.summary}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

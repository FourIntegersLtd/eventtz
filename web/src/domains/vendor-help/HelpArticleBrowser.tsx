"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/foundation/ui";
import { fetchHelpArticle, fetchHelpArticles, fetchHelpCategories, type HelpArticleDetail, type HelpArticleListItem, type HelpCategory } from "@/domains/vendor-help/api";
import { AskAssistantPanel } from "@/domains/vendor-help/AskAssistantPanel";
import { slugToLabel } from "@/domains/vendor-help/helpFormatting";

/** Which screen of the browser is showing — held in component state, not the URL, since only two routes were scoped to this domain. */
type BrowserScreen =
  | { kind: "categories" }
  | { kind: "category"; category: HelpCategory | null; slug: string }
  | { kind: "article"; slug: string };

/**
 * The Help Center: category tiles, drilling into an article list, then an
 * article body — plus an "Ask our assistant" panel underneath, all as one
 * page (the baseline gives each step its own route; this rebuild keeps the
 * Help page to the two routes this workstream scoped, `help` and
 * `help/messages/[conversationId]`, so browsing happens in local state).
 */
export function HelpArticleBrowser() {
  const [screen, setScreen] = useState<BrowserScreen>({ kind: "categories" });
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [articles, setArticles] = useState<HelpArticleListItem[]>([]);
  const [article, setArticle] = useState<HelpArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      // The loading/error reset lives inside the async function body (not as
      // a bare statement in the effect) — `react-hooks/set-state-in-effect`
      // flags a literal `setState(...)` call sitting directly in an effect.
      setLoading(true);
      setError(null);
      try {
        if (screen.kind === "categories") {
          const rows = await fetchHelpCategories();
          if (!cancelled) setCategories(rows);
        } else if (screen.kind === "category") {
          const [categoryRows, articleRows] = await Promise.all([
            categories.length > 0 ? Promise.resolve(categories) : fetchHelpCategories(),
            fetchHelpArticles(screen.slug),
          ]);
          if (!cancelled) {
            if (categories.length === 0) setCategories(categoryRows);
            setArticles(articleRows);
          }
        } else {
          const row = await fetchHelpArticle(screen.slug);
          if (!cancelled) setArticle(row);
        }
      } catch {
        if (!cancelled) setError("Could not load that page. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `categories` is a cache read, not a trigger
  }, [screen]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-100 bg-white">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner label="Loading…" />
          </div>
        ) : error ? (
          <p className="px-5 py-4 text-sm text-red-700">{error}</p>
        ) : screen.kind === "categories" ? (
          <CategoryList categories={categories} onSelect={(category) => setScreen({ kind: "category", category, slug: category.slug })} />
        ) : screen.kind === "category" ? (
          <ArticleList
            title={screen.category?.title ?? "Articles"}
            articles={articles}
            onBack={() => setScreen({ kind: "categories" })}
            onSelect={(articleSlug) => setScreen({ kind: "article", slug: articleSlug })}
          />
        ) : article ? (
          <ArticleDetail article={article} onBack={() => setScreen({ kind: "categories" })} onSelectRelated={(slug) => setScreen({ kind: "article", slug })} />
        ) : null}
      </div>

      <AskAssistantPanel />
    </div>
  );
}

function CategoryList({ categories, onSelect }: { categories: HelpCategory[]; onSelect: (category: HelpCategory) => void }) {
  if (categories.length === 0) return <p className="px-5 py-6 text-sm text-neutral-500">No help topics yet.</p>;
  return (
    <ul className="divide-y divide-neutral-100">
      {categories.map((category) => (
        <li key={category.id}>
          <button type="button" onClick={() => onSelect(category)} className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-neutral-50">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-neutral-900">{category.title}</span>
              <span className="mt-0.5 block truncate text-sm text-neutral-500">{category.description}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ArticleList({
  title,
  articles,
  onBack,
  onSelect,
}: {
  title: string;
  articles: HelpArticleListItem[];
  onBack: () => void;
  onSelect: (slug: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
        <button type="button" onClick={onBack} className="text-sm text-primary hover:underline">
          ← Help Center
        </button>
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      </div>
      {articles.length === 0 ? (
        <p className="px-5 py-6 text-sm text-neutral-500">No articles in this topic yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {articles.map((articleRow) => (
            <li key={articleRow.id}>
              <button type="button" onClick={() => onSelect(articleRow.slug)} className="block w-full px-5 py-3.5 text-left text-sm text-neutral-800 transition hover:bg-neutral-50">
                <span className="font-medium text-neutral-900">{articleRow.title}</span>
                {articleRow.summary ? <span className="mt-0.5 block text-neutral-500">{articleRow.summary}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ArticleDetail({
  article,
  onBack,
  onSelectRelated,
}: {
  article: HelpArticleDetail;
  onBack: () => void;
  onSelectRelated: (slug: string) => void;
}) {
  return (
    <div className="px-5 py-5">
      <button type="button" onClick={onBack} className="text-sm text-primary hover:underline">
        ← Help Center
      </button>
      <h1 className="mt-3 text-xl font-semibold text-neutral-900">{article.title}</h1>
      {/* `body_md` is plain-language markdown from the Help Center; rendered as text, not HTML, so this domain
          takes on no markdown-to-HTML rendering dependency for a page this workstream scoped modestly. */}
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{article.body_md}</p>
      {(article.related_slugs ?? []).length > 0 ? (
        <div className="mt-6 border-t border-neutral-100 pt-4">
          <h2 className="text-sm font-semibold text-neutral-900">Related</h2>
          <ul className="mt-2 space-y-1.5">
            {(article.related_slugs ?? []).map((slug) => (
              <li key={slug}>
                <button type="button" onClick={() => onSelectRelated(slug)} className="text-sm font-medium text-primary hover:underline">
                  {slugToLabel(slug)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

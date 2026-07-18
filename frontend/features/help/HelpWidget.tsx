"use client";

import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Mail,
  Maximize2,
  Minimize2,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { LoadingState } from "@/components/ui/LoadingState";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  fetchHelpArticle,
  fetchHelpArticles,
  fetchHelpCategories,
  type HelpArticleDetail,
  type HelpArticleListItem,
  type HelpAudience,
  type HelpCategory,
} from "@/lib/helpApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { HelpAssistantThread } from "@/features/help/HelpAssistantThread";
import {
  helpCategoryIcon,
  helpContactPath,
  helpMarkdownToHtml,
} from "@/features/help/helpContent";

type View =
  | { name: "home" }
  | { name: "browse" }
  | { name: "category"; slug: string; title?: string; description?: string }
  | { name: "article"; slug: string; fromCategory?: string }
  | { name: "ask"; initialQ?: string };

type Props = { audience: HelpAudience };

const iconBtn =
  "rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900";

export function HelpWidget({ audience }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<View>({ name: "home" });
  const [draft, setDraft] = useState("");
  const contactHref = helpContactPath(audience);

  useEffect(() => {
    setOpen(false);
    setExpanded(false);
    setView({ name: "home" });
    setDraft("");
  }, [pathname]);

  const openWidget = (next: View = { name: "home" }) => {
    setView(next);
    setOpen(true);
    track(MixpanelEvents.help_opened, {
      audience,
      source: "widget",
      panel: next.name,
    });
  };

  const closeWidget = () => {
    setOpen(false);
    setExpanded(false);
    setView({ name: "home" });
    setDraft("");
  };

  const minimizeWidget = () => {
    setOpen(false);
  };

  const goBack = () => {
    if (view.name === "article" && view.fromCategory) {
      setView({ name: "category", slug: view.fromCategory });
      return;
    }
    if (view.name === "article" || view.name === "ask") {
      setView({ name: "home" });
      return;
    }
    if (view.name === "category") {
      setView({ name: "browse" });
      return;
    }
    if (view.name === "browse") {
      setView({ name: "home" });
    }
  };

  const onAskHome = (e: FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    setDraft("");
    setView({ name: "ask", initialQ: q || undefined });
  };

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const panelDesktopSize = expanded
    ? "sm:h-[min(92vh,48rem)] sm:w-[min(100vw-1.5rem,36rem)]"
    : "sm:h-[min(88vh,40rem)] sm:w-[min(100vw-1.5rem,24rem)]";

  const showBack = view.name !== "home";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => openWidget({ name: "home" })}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition hover:bg-neutral-800"
        aria-label="Open help"
      >
        <CircleHelp className="h-6 w-6" aria-hidden strokeWidth={2.25} />
      </button>
    );
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 flex flex-col overflow-hidden bg-white font-sans pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:inset-auto sm:bottom-20 sm:right-5 sm:rounded-2xl sm:border sm:border-neutral-200 sm:pt-0 sm:pb-0 sm:shadow-[0_12px_40px_rgba(0,0,0,0.14)] ${panelDesktopSize}`}
        role="dialog"
        aria-label="Help"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-2 py-1.5">
          {showBack ? (
            <button type="button" onClick={goBack} className={iconBtn} aria-label="Back">
              <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
            </button>
          ) : (
            <span className="w-9" aria-hidden />
          )}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={`${iconBtn} hidden sm:inline-flex`}
              aria-label={expanded ? "Shrink help" : "Expand help"}
            >
              {expanded ? (
                <Minimize2 className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Maximize2 className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
            <button type="button" onClick={closeWidget} className={iconBtn} aria-label="Close help">
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-white">
          {view.name === "home" ? (
            <HomePanel
              draft={draft}
              setDraft={setDraft}
              onAskHome={onAskHome}
              contactHref={contactHref}
              onBrowse={() => setView({ name: "browse" })}
              onContact={() => setOpen(false)}
              audience={audience}
            />
          ) : null}
          {view.name === "browse" ? (
            <BrowsePanel
              audience={audience}
              onOpenCategory={(slug, title, description) =>
                setView({ name: "category", slug, title, description })
              }
            />
          ) : null}
          {view.name === "category" ? (
            <CategoryPanel
              audience={audience}
              categorySlug={view.slug}
              title={view.title}
              description={view.description}
              onMeta={(title, description) =>
                setView((v) =>
                  v.name === "category" ? { ...v, title, description } : v,
                )
              }
              onOpenArticle={(slug) =>
                setView({ name: "article", slug, fromCategory: view.slug })
              }
            />
          ) : null}
          {view.name === "article" ? (
            <ArticlePanel
              audience={audience}
              slug={view.slug}
              onOpenArticle={(slug) =>
                setView({
                  name: "article",
                  slug,
                  fromCategory: view.fromCategory,
                })
              }
              onAsk={(q) => setView({ name: "ask", initialQ: q })}
            />
          ) : null}
          {view.name === "ask" ? (
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-2 sm:pb-3">
              <HelpAssistantThread
                key={view.initialQ ?? "__ask__"}
                audience={audience}
                embedded
                initialQuestion={view.initialQ}
                onClose={() => setOpen(false)}
                onOpenArticle={(slug) => setView({ name: "article", slug })}
              />
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={minimizeWidget}
        className="fixed bottom-5 right-5 z-40 hidden h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition hover:bg-neutral-800 sm:flex"
        aria-label="Minimize help"
      >
        <ChevronDown className="h-6 w-6" aria-hidden strokeWidth={2.25} />
      </button>
    </>
  );
}

function HomePanel({
  draft,
  setDraft,
  onAskHome,
  contactHref,
  onBrowse,
  onContact,
  audience,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onAskHome: (e: FormEvent) => void;
  contactHref: string | null;
  onBrowse: () => void;
  onContact: () => void;
  audience: HelpAudience;
}) {
  const heading =
    audience === "admin" ? "How can we help" : "How can we help";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5 sm:pb-5 sm:pt-6">
      <h1 className="font-heading text-[1.375rem] font-semibold tracking-tight text-neutral-950 sm:text-[1.25rem]">
        {heading}{" "}
        <span aria-hidden className="font-normal">
          👋
        </span>
      </h1>

      <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200">
        <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
          <Sparkles className="h-3.5 w-3.5 text-neutral-500" aria-hidden strokeWidth={1.75} />
          <p className="text-[13px] font-medium text-neutral-500">
            Ask our assistant anything
          </p>
        </div>
        <form onSubmit={onAskHome}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question..."
            className="w-full bg-white px-3.5 py-3.5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
          />
        </form>
      </div>

      <ul className="mt-2">
        <li className={contactHref ? "border-b border-neutral-100" : undefined}>
          <button
            type="button"
            onClick={onBrowse}
            className="flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-neutral-50"
          >
            <BookOpen className="h-[18px] w-[18px] shrink-0 text-neutral-500" strokeWidth={1.75} />
            <span className="flex-1 text-[15px] text-neutral-900">Browse our docs</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
          </button>
        </li>
        {contactHref ? (
          <li>
            <Link
              href={contactHref}
              onClick={onContact}
              className="flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-neutral-50"
            >
              <Mail className="h-[18px] w-[18px] shrink-0 text-neutral-500" strokeWidth={1.75} />
              <span className="flex-1 text-[15px] text-neutral-900">Contact us</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
            </Link>
          </li>
        ) : audience === "admin" ? (
          <li>
            <Link
              href="/admin/team"
              onClick={onContact}
              className="flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-neutral-50"
            >
              <Mail className="h-[18px] w-[18px] shrink-0 text-neutral-500" strokeWidth={1.75} />
              <span className="flex-1 text-[15px] text-neutral-900">Admin team</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
            </Link>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function BrowsePanel({
  audience,
  onOpenCategory,
}: {
  audience: HelpAudience;
  onOpenCategory: (slug: string, title: string, description: string) => void;
}) {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchHelpCategories(audience)
      .then((rows) => {
        if (!cancelled) setCategories(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(getApiErrorDetail(e) ?? "Could not load topics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audience]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 sm:pb-5">
      <h1 className="font-heading text-[1.375rem] font-semibold tracking-tight text-neutral-950 sm:text-[1.25rem]">
        Help Center
      </h1>
      <p className="mt-1 text-[14px] text-neutral-500">
        Find answers in our knowledge base
      </p>

      <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-4 py-3">
          <p className="text-[13px] font-medium text-neutral-600">Documentation</p>
        </div>
        {loading ? (
          <LoadingState label="Loading topics…" variant="inline" className="px-4 py-8" />
        ) : error ? (
          <p className="px-4 py-4 text-sm text-red-700">{error}</p>
        ) : (
          <ul>
            {categories.map((cat) => {
              const Icon = helpCategoryIcon(cat.icon_key);
              return (
                <li key={cat.id} className="border-b border-neutral-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onOpenCategory(cat.slug, cat.title, cat.description)}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-neutral-50"
                  >
                    <Icon
                      className="mt-0.5 h-[18px] w-[18px] shrink-0 text-neutral-500"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-neutral-900">
                        {cat.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-neutral-500">
                        {cat.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function CategoryPanel({
  audience,
  categorySlug,
  title,
  description,
  onMeta,
  onOpenArticle,
}: {
  audience: HelpAudience;
  categorySlug: string;
  title?: string;
  description?: string;
  onMeta: (title: string, description: string) => void;
  onOpenArticle: (slug: string) => void;
}) {
  const [category, setCategory] = useState<HelpCategory | null>(null);
  const [articles, setArticles] = useState<HelpArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      fetchHelpCategories(audience),
      fetchHelpArticles(audience, categorySlug),
    ])
      .then(([cats, rows]) => {
        if (cancelled) return;
        const cat = cats.find((c) => c.slug === categorySlug) ?? null;
        setCategory(cat);
        setArticles(rows);
        if (cat) onMeta(cat.title, cat.description);
        else if (rows[0]?.category_title) onMeta(rows[0].category_title, "");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, categorySlug]);

  const heading = title ?? category?.title ?? "Articles";
  const sub = description ?? category?.description ?? "";
  const Icon = helpCategoryIcon(category?.icon_key ?? "book");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 sm:pb-5">
      <h1 className="font-heading text-[1.375rem] font-semibold tracking-tight text-neutral-950 sm:text-[1.25rem]">
        {heading}
      </h1>
      {sub ? <p className="mt-1 text-[14px] text-neutral-500">{sub}</p> : null}

      {loading ? (
        <LoadingState label="Loading articles…" variant="inline" className="mt-6 py-8" />
      ) : error ? (
        <p className="mt-6 text-sm text-red-700">{error}</p>
      ) : articles.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600">No articles in this topic yet.</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200">
          <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
            <Icon className="h-4 w-4 text-neutral-600" strokeWidth={1.75} aria-hidden />
            <p className="text-[14px] font-medium text-neutral-900">{heading}</p>
          </div>
          <ul className="bg-white p-1.5">
            {articles.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onOpenArticle(a.slug)}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-[14px] text-neutral-800 transition hover:bg-neutral-100"
                >
                  <span className="block truncate">{a.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ArticlePanel({
  audience,
  slug,
  onOpenArticle,
  onAsk,
}: {
  audience: HelpAudience;
  slug: string;
  onOpenArticle: (slug: string) => void;
  onAsk: (q: string) => void;
}) {
  const [article, setArticle] = useState<HelpArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchHelpArticle(slug, audience)
      .then((row) => {
        if (cancelled) return;
        setArticle(row);
        track(MixpanelEvents.help_article_viewed, { audience, slug: row.slug });
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

  const submitAsk = (e: FormEvent) => {
    e.preventDefault();
    const q = ask.trim();
    if (!q) return;
    setAsk("");
    onAsk(q);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {loading ? (
          <LoadingState label="Loading…" variant="inline" className="py-8" />
        ) : error || !article ? (
          <p className="text-sm text-red-700">{error ?? "Article not found."}</p>
        ) : (
          <>
            <h1 className="font-heading text-[1.375rem] font-semibold leading-snug tracking-tight text-neutral-950 sm:text-[1.25rem]">
              {article.title}
            </h1>
            <div
              className="help-article-body mt-4 font-sans [&_h2]:font-heading [&_h2]:mt-6 [&_h2]:text-[1.125rem] [&_h2]:font-semibold [&_h2]:text-neutral-950 [&_h3]:font-heading [&_h3]:mt-5 [&_h3]:text-[1rem] [&_h3]:font-semibold [&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:text-neutral-700 sm:[&_li]:text-[14px] [&_ol]:mt-3 [&_p]:mt-3 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-neutral-700 sm:[&_p]:text-[14px] [&_ul]:mt-3"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {article.related_slugs.length > 0 ? (
              <div className="mt-8 border-t border-neutral-100 pt-5">
                <p className="text-[14px] font-semibold text-neutral-900">Related</p>
                <ul className="mt-2 space-y-1">
                  {article.related_slugs.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => onOpenArticle(s)}
                        className="text-left text-[14px] font-medium text-neutral-800 underline-offset-2 hover:underline"
                      >
                        {s.replace(/^(client|vendor)-/, "").replace(/-/g, " ")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>

      <form
        onSubmit={submitAsk}
        className="shrink-0 border-t border-neutral-100 bg-white px-4 py-3"
      >
        <input
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          placeholder="Search our help center or ask AI"
          className="w-full rounded-xl bg-neutral-100 px-4 py-3 text-[14px] text-neutral-900 outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-neutral-300"
        />
      </form>
    </div>
  );
}

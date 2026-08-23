"use client";

import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  FileText,
  LifeBuoy,
  Mail,
  Maximize2,
  Minimize2,
  Newspaper,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LoadingState } from "@/components/ui/LoadingState";
import { getApiErrorDetail } from "@/lib/api-errors";
import { ARTICLE_NOT_FOUND } from "@/lib/help-messages";
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
import { HelpArticleBody } from "@/features/help/HelpArticleBody";
import {
  helpCategoryIcon,
  helpContactPath,
} from "@/features/help/helpContent";
import { useVendorCopilotOptional } from "@/features/vendor/copilot/VendorCopilotContext";

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
  const copilot = useVendorCopilotOptional();
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
    copilot?.closeCopilot();
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
      <div className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-40">
        <button
          type="button"
          onClick={() => openWidget({ name: "home" })}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition hover:bg-neutral-800"
          aria-label="Open help"
        >
          <CircleHelp className="h-6 w-6" aria-hidden strokeWidth={2.25} />
        </button>
      </div>
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
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-40 hidden h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition hover:bg-neutral-800 sm:flex"
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
  const heading = "How can we help 👋";

  const onAskKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onAskHome(e as unknown as FormEvent);
    }
  };

  type HomeLink =
    | { kind: "action"; label: string; icon: typeof BookOpen; onClick: () => void }
    | { kind: "internal"; label: string; icon: typeof BookOpen; href: string }
    | { kind: "external"; label: string; icon: typeof BookOpen; href: string };

  const links: HomeLink[] =
    audience === "admin"
      ? [
          { kind: "action", label: "Browse our docs", icon: BookOpen, onClick: onBrowse },
          ...(contactHref
            ? [{ kind: "internal" as const, label: "Report a bug", icon: LifeBuoy, href: contactHref }]
            : []),
          { kind: "internal", label: "Admin team", icon: Mail, href: "/admin/team" },
          { kind: "internal", label: "Activity log", icon: FileText, href: "/admin/audit" },
          { kind: "internal", label: "Blog CMS", icon: Newspaper, href: "/admin/blog" },
        ]
      : audience === "vendor"
        ? [
            { kind: "action", label: "Browse our docs", icon: BookOpen, onClick: onBrowse },
            ...(contactHref
              ? [{ kind: "internal" as const, label: "Contact us", icon: Mail, href: contactHref }]
              : []),
            { kind: "external", label: "Read our blog", icon: Newspaper, href: "/blog" },
            { kind: "external", label: "How vendors join", icon: Sparkles, href: "/#for-vendors" },
            { kind: "external", label: "Visit FAQ", icon: CircleHelp, href: "/#faq" },
          ]
        : [
            { kind: "action", label: "Browse our docs", icon: BookOpen, onClick: onBrowse },
            ...(contactHref
              ? [{ kind: "internal" as const, label: "Contact us", icon: Mail, href: contactHref }]
              : []),
            { kind: "external", label: "Read our blog", icon: Newspaper, href: "/blog" },
            { kind: "external", label: "How booking works", icon: Sparkles, href: "/#booking-journey" },
            { kind: "external", label: "Visit FAQ", icon: CircleHelp, href: "/#faq" },
          ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5 sm:pb-5 sm:pt-6">
      <h1 className="font-heading text-[1.375rem] font-semibold tracking-tight text-neutral-950 sm:text-[1.25rem]">
        {heading}
      </h1>

      <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200">
        <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
          <Sparkles className="h-3.5 w-3.5 text-neutral-500" aria-hidden strokeWidth={1.75} />
          <p className="text-[13px] font-medium text-neutral-500">
            Ask our assistant anything
          </p>
        </div>
        <form onSubmit={onAskHome}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onAskKeyDown}
            placeholder="Ask a question..."
            rows={4}
            className="min-h-[6.5rem] w-full resize-none bg-white px-3.5 py-3.5 text-base leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400 md:text-[15px]"
          />
        </form>
      </div>

      <ul className="mt-2">
        {links.map((item, index) => {
          const Icon = item.icon;
          const rowClass =
            "flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-neutral-50";
          const isLast = index === links.length - 1;
          const liClass = isLast ? undefined : "border-b border-neutral-100";

          if (item.kind === "action") {
            return (
              <li key={item.label} className={liClass}>
                <button type="button" onClick={item.onClick} className={rowClass}>
                  <Icon className="h-[18px] w-[18px] shrink-0 text-neutral-500" strokeWidth={1.75} />
                  <span className="flex-1 text-[15px] text-neutral-900">{item.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
                </button>
              </li>
            );
          }

          if (item.kind === "external") {
            return (
              <li key={item.label} className={liClass}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={rowClass}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 text-neutral-500" strokeWidth={1.75} />
                  <span className="flex-1 text-[15px] text-neutral-900">{item.label}</span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
                </a>
              </li>
            );
          }

          return (
            <li key={item.label} className={liClass}>
              <Link href={item.href} onClick={onContact} className={rowClass}>
                <Icon className="h-[18px] w-[18px] shrink-0 text-neutral-500" strokeWidth={1.75} />
                <span className="flex-1 text-[15px] text-neutral-900">{item.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
              </Link>
            </li>
          );
        })}
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
        if (!cancelled) setError(getApiErrorDetail(e) ?? ARTICLE_NOT_FOUND);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audience, slug]);

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
          <p className="text-sm text-red-700">{error ?? ARTICLE_NOT_FOUND}</p>
        ) : (
          <HelpArticleBody article={article} onOpenRelated={onOpenArticle} />
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
          className="w-full rounded-xl bg-neutral-100 px-4 py-3 text-base text-neutral-900 outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-neutral-300 md:text-sm"
        />
      </form>
    </div>
  );
}

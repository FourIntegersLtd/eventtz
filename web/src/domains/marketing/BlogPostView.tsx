"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchBlogPost, type BlogPostPublicDetail } from "@/domains/marketing/api";
import { formatPublishedDate } from "@/domains/marketing/formatPublishedDate";
import { platformErrorDetail } from "@/foundation/platform-client";

const POST_NOT_FOUND = "This post could not be found.";

/**
 * The `/blog/[slug]` post page. Ported (simplified) from the baseline's
 * `BlogPostView`. `body_html` is pre-sanitized by the content slice.
 *
 * The route (`app/(marketing)/blog/[slug]/page.tsx`) renders this with
 * `key={slug}`, so a navigation between two posts remounts the component
 * rather than reusing state — `loading`/`error`/`post` start fresh for each
 * slug without an effect resetting them mid-render.
 */
export function BlogPostView({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPostPublicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBlogPost(slug)
      .then((found) => {
        if (!cancelled) setPost(found);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setPost(null);
          setError(platformErrorDetail(cause) ?? POST_NOT_FOUND);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-neutral-500 sm:px-6">Loading…</div>;
  }

  if (!post) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
        <p className="text-neutral-700">{error ?? POST_NOT_FOUND}</p>
        <Link href="/blog" className="text-sm font-medium text-primary hover:underline">
          Back to blog
        </Link>
      </div>
    );
  }

  const showSubtitle = post.subtitle && post.subtitle.trim().toLowerCase() !== post.title.trim().toLowerCase();

  return (
    <article className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <Link href="/blog" className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-primary">
        ← All posts
      </Link>

      <header className="mb-6 space-y-2">
        <p className="text-xs text-neutral-500">{formatPublishedDate(post.published_at)}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
          {post.title}
        </h1>
        {showSubtitle ? <p className="text-lg text-neutral-600">{post.subtitle}</p> : null}
      </header>

      {post.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote vendor/blog media, not a build-time asset
        <img src={post.cover_image_url} alt="" className="mb-8 w-full rounded-2xl bg-neutral-100" />
      ) : null}

      {/* `body_html` is pre-sanitized server side (`api/app/features/content/service_blog.py`); nothing here re-escapes or re-sanitizes it. */}
      <div className="blog-prose" dangerouslySetInnerHTML={{ __html: post.body_html }} />
    </article>
  );
}

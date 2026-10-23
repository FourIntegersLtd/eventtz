"use client";

import { useEffect, useState } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { BlogByline } from "@/features/blog/BlogByline";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { POST_NOT_FOUND } from "@/lib/blog-messages";
import { fetchPublishedBlogPost, type BlogPostPublicDetail } from "@/lib/blogApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { landingSectionClass } from "@/features/landing/landingSectionStyles";
import { LandingSection } from "@/features/landing/LandingSection";
import { formatDate } from "@/lib/dateFormat";

type BlogPostViewProps = {
  slug: string;
};

/** Formats an ISO timestamp as a UK long date, or an empty string when missing or invalid. */
function formatPublished(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDate(d, "dayLongMonthYear");
}

/** One published post: a 3xl reading column with byline, cover and the sanitised body HTML. */
export function BlogPostView({ slug }: BlogPostViewProps) {
  const [post, setPost] = useState<BlogPostPublicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const p = await fetchPublishedBlogPost(slug);
        if (!cancelled) setPost(p);
      } catch (e: unknown) {
        if (!cancelled) {
          setPost(null);
          setError(getApiErrorDetail(e) ?? POST_NOT_FOUND);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className={landingSectionClass("white", { bordered: false, extra: "min-h-[70dvh]" })}>
        <LandingSection width="3xl">
          <p className="text-center text-sm text-ink-3">Loading…</p>
        </LandingSection>
      </div>
    );
  }

  if (!post) {
    return (
      <div className={landingSectionClass("white", { bordered: false, extra: "min-h-[70dvh]" })}>
        <LandingSection width="3xl">
          <div className="flex flex-col items-center space-y-4 text-center">
            <LottieIllustration asset="notFound" className="h-32 w-32" />
            <p className="text-ink-2">{error ?? POST_NOT_FOUND}</p>
            <ButtonLink href="/blog" variant="secondary">
              Back to blog
            </ButtonLink>
          </div>
        </LandingSection>
      </div>
    );
  }

  return (
    <article className={landingSectionClass("white", { bordered: false })}>
      <LandingSection width="3xl">
        <BackLink href="/blog" label="All posts" className="mb-6 sm:mb-8" />

        <header className="mb-6 space-y-3 text-left sm:mb-8 sm:space-y-4">
          <BlogByline
            publishedAt={formatPublished(post.published_at)}
            publishedAtIso={post.published_at}
            authorName={post.author_name}
          />
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>
          {post.subtitle &&
          post.subtitle.trim().toLowerCase() !== post.title.trim().toLowerCase() ? (
            <p className="text-base leading-relaxed text-ink-2 sm:text-lg lg:text-xl">
              {post.subtitle}
            </p>
          ) : null}
        </header>

        {post.cover_image_url ? (
          <div className="mb-8 overflow-hidden rounded-card border border-line bg-surface-3 sm:mb-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.cover_image_url}
              alt=""
              className="block h-auto w-full"
            />
          </div>
        ) : null}

        <div
          className="blog-prose"
          dangerouslySetInnerHTML={{ __html: post.body_html || "" }}
        />
      </LandingSection>
    </article>
  );
}

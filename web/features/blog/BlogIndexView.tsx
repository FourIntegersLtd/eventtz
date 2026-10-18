"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { BlogByline } from "@/features/blog/BlogByline";
import { fetchPublishedBlogPosts } from "@/lib/blogApi";
import type { BlogPostListItem } from "@/lib/adminBlogApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  LANDING_FEATURE_HEADLINE_CLASS,
  LANDING_SECTION_CONTENT_MT,
  landingSectionClass,
} from "@/features/landing/landingSectionStyles";
import { LandingSection } from "@/features/landing/LandingSection";

/** Formats an ISO timestamp as a UK long date, or an empty string when missing or invalid. */
function formatPublished(iso: string | null | undefined): string {
  if (!iso) return "";
  const publishedDate = new Date(iso);
  if (Number.isNaN(publishedDate.getTime())) return "";
  return publishedDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** The short line shown under a post title, or null when it is empty or only repeats the title. */
function postBlurb(post: BlogPostListItem): string | null {
  const blurb = (post.subtitle || post.excerpt || "").trim();
  if (!blurb || blurb.toLowerCase() === post.title.trim().toLowerCase()) return null;
  return blurb;
}

/** Cover image for a post card, or a lilac placeholder when the post has none. */
function PostCover({ post, aspectClass }: { post: BlogPostListItem; aspectClass: string }) {
  if (!post.cover_image_url) {
    return <div className={`${aspectClass} border-b border-primary-border bg-primary-soft`} />;
  }
  return (
    <div className={`${aspectClass} overflow-hidden bg-surface-3`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={post.cover_image_url}
        alt=""
        className="block h-full w-full object-cover transition duration-500 group-hover:opacity-95"
      />
    </div>
  );
}

/** Byline, title and blurb shared by both card kinds; only the type sizes differ. */
function PostText({
  post,
  titleClass,
  blurbClass,
}: {
  post: BlogPostListItem;
  titleClass: string;
  blurbClass: string;
}) {
  const blurb = postBlurb(post);
  return (
    <>
      <BlogByline
        publishedAt={formatPublished(post.published_at)}
        publishedAtIso={post.published_at}
        authorName={post.author_name}
      />
      <h2
        className={`font-heading font-semibold leading-snug text-ink transition group-hover:text-primary ${titleClass}`}
      >
        {post.title}
      </h2>
      {blurb ? <p className={`leading-relaxed text-ink-2 ${blurbClass}`}>{blurb}</p> : null}
    </>
  );
}

/** Full-width card for the most recent post: large image beside title, blurb and byline on desktop. */
function BlogFeaturedCard({ post }: { post: BlogPostListItem }) {
  return (
    <Card as="article" className="overflow-hidden transition hover:shadow-card">
      <Link href={`/blog/${post.slug}`} className="group grid lg:grid-cols-2">
        <PostCover post={post} aspectClass="aspect-[16/10] lg:aspect-auto lg:min-h-[20rem]" />
        <div className="flex flex-col justify-center gap-3 p-6 sm:p-8 lg:p-10">
          <PostText
            post={post}
            titleClass="text-2xl sm:text-3xl"
            blurbClass="line-clamp-4 text-base lg:text-lg"
          />
        </div>
      </Link>
    </Card>
  );
}

/** Standard grid card for a post: cover, byline, title and blurb. */
function BlogPostCard({ post }: { post: BlogPostListItem }) {
  return (
    <Card as="article" className="h-full overflow-hidden transition hover:shadow-card">
      <Link href={`/blog/${post.slug}`} className="group flex h-full flex-col">
        <PostCover post={post} aspectClass="aspect-[16/10]" />
        <div className="flex flex-col gap-2 p-5 sm:gap-1.5">
          <PostText post={post} titleClass="text-xl" blurbClass="line-clamp-3 text-[0.9375rem]" />
        </div>
      </Link>
    </Card>
  );
}

/** Public blog index: landing-style heading band over a grid of post cards. */
export function BlogIndexView() {
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const list = await fetchPublishedBlogPosts();
        if (!cancelled) setPosts(list);
      } catch (e: unknown) {
        if (!cancelled) setError(getApiErrorDetail(e) ?? "Could not load posts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [featuredPost, ...otherPosts] = posts;

  return (
    <div className={landingSectionClass("white", { bordered: false, extra: "min-h-[70dvh]" })}>
      <LandingSection>
        <header className="max-w-2xl space-y-3 text-left">
          <h1 className={LANDING_FEATURE_HEADLINE_CLASS}>Blog</h1>
          <p className="text-base leading-relaxed text-ink-2 lg:text-lg">
            Stories, tips, and updates from the Eventtz team.
          </p>
        </header>

        <div className={LANDING_SECTION_CONTENT_MT}>
          {loading ? (
            <p className="text-left text-sm text-ink-3">Loading…</p>
          ) : error ? (
            <Banner tone="danger">{error}</Banner>
          ) : posts.length === 0 ? (
            <EmptyState
              title="No posts yet"
              description="Check back soon for new writing from the Eventtz team."
              lottie="searchNoResults"
            />
          ) : (
            <div className="space-y-10 lg:space-y-12">
              <BlogFeaturedCard post={featuredPost} />
              {otherPosts.length > 0 ? (
                <ul className="blog-index-grid">
                  {otherPosts.map((post) => (
                    <li key={post.id} className="min-w-0">
                      <BlogPostCard post={post} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      </LandingSection>
    </div>
  );
}

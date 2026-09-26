"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchBlogPosts, type BlogPostListItem } from "@/domains/marketing/api";
import { formatPublishedDate } from "@/domains/marketing/formatPublishedDate";
import { GENERIC_ERROR_MESSAGE, platformErrorDetail } from "@/foundation/platform-client";

/** The `/blog` index: every published post, newest first. Ported (simplified, no cover-image grid styling) from the baseline's `BlogIndexView`. */
export function BlogIndexView() {
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBlogPosts()
      .then((list) => {
        if (!cancelled) setPosts(list);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(platformErrorDetail(cause) ?? GENERIC_ERROR_MESSAGE);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">Blog</h1>
      <p className="mt-2 max-w-2xl text-neutral-600">Stories, tips, and updates from the Eventtz team.</p>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading…</p>
      ) : error ? (
        <p className="mt-8 text-sm text-red-700">{error}</p>
      ) : posts.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">No posts yet. Check back soon.</p>
      ) : (
        <ul className="mt-10 grid gap-8 sm:grid-cols-2">
          {posts.map((post) => {
            const blurb = (post.subtitle || post.excerpt || "").trim();
            const showBlurb = blurb && blurb.toLowerCase() !== post.title.trim().toLowerCase();
            return (
              <li key={post.id}>
                <Link href={`/blog/${post.slug}`} className="group block">
                  {post.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote vendor/blog media, not a build-time asset
                    <img
                      src={post.cover_image_url}
                      alt=""
                      className="aspect-[16/10] w-full rounded-2xl bg-neutral-100 object-cover"
                    />
                  ) : (
                    <div className="aspect-[16/10] rounded-2xl bg-primary-soft/60 ring-1 ring-primary-border/40" />
                  )}
                  <p className="mt-3 text-xs text-neutral-500">{formatPublishedDate(post.published_at)}</p>
                  <h2 className="mt-1 font-heading text-xl font-semibold text-neutral-900 group-hover:text-primary">
                    {post.title}
                  </h2>
                  {showBlurb ? <p className="mt-2 line-clamp-3 text-sm text-neutral-600">{blurb}</p> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

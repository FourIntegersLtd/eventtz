"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { BlogByline } from "@/features/blog/BlogByline";
import { fetchPublishedBlogPosts } from "@/lib/blogApi";
import type { BlogPostListItem } from "@/lib/adminBlogApi";
import { getApiErrorDetail } from "@/lib/api-errors";

function formatPublished(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

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

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <header className="mb-8 space-y-2 text-left sm:mb-12 sm:space-y-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl">
          Blog
        </h1>
        <p className="max-w-2xl text-sm text-neutral-600 sm:text-base lg:text-lg">
          Stories, tips, and updates from the Eventtz team.
        </p>
      </header>

      {loading ? (
        <p className="text-left text-sm text-neutral-500">Loading…</p>
      ) : error ? (
        <p className="text-left text-sm text-red-700">{error}</p>
      ) : posts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description="Check back soon for new writing from the Eventtz team."
          lottie="searchNoResults"
        />
      ) : (
        <ul className="blog-index-grid">
          {posts.map((post) => (
            <li key={post.id} className="min-w-0">
              <article className="h-full">
                <Link href={`/blog/${post.slug}`} className="group flex h-full flex-col">
                  {post.cover_image_url ? (
                    <div className="mb-4 aspect-[16/10] overflow-hidden rounded-2xl bg-neutral-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.cover_image_url}
                        alt=""
                        className="block h-full w-full object-cover transition duration-500 group-hover:opacity-95"
                      />
                    </div>
                  ) : (
                    <div className="mb-4 aspect-[16/10] rounded-2xl bg-primary-soft/60 ring-1 ring-primary-border/40" />
                  )}
                  <BlogByline
                    publishedAt={formatPublished(post.published_at)}
                    publishedAtIso={post.published_at}
                    authorName={post.author_name}
                  />
                  <h2 className="mt-2 font-heading text-lg font-semibold leading-snug text-neutral-900 transition group-hover:text-primary sm:text-xl">
                    {post.title}
                  </h2>
                  {(() => {
                    const blurb = (post.subtitle || post.excerpt || "").trim();
                    if (
                      !blurb ||
                      blurb.toLowerCase() === post.title.trim().toLowerCase()
                    ) {
                      return null;
                    }
                    return (
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-600 sm:text-[0.9375rem]">
                        {blurb}
                      </p>
                    );
                  })()}
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

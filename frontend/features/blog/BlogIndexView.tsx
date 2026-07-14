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
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-8">
      <header className="mb-12 space-y-3 text-left sm:mb-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Eventtz</p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
          Blog
        </h1>
        <p className="max-w-md text-base text-neutral-600 sm:text-lg">
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
        />
      ) : (
        <ul className="space-y-12 sm:space-y-16">
          {posts.map((post) => (
            <li key={post.id}>
              <article>
                <Link href={`/blog/${post.slug}`} className="group block">
                  {post.cover_image_url ? (
                    <div className="mb-5 overflow-hidden rounded-2xl bg-neutral-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.cover_image_url}
                        alt=""
                        className="block h-auto w-full transition duration-500 group-hover:opacity-95"
                      />
                    </div>
                  ) : null}
                  <BlogByline
                    publishedAt={formatPublished(post.published_at)}
                    publishedAtIso={post.published_at}
                    authorName={post.author_name}
                  />
                  <h2 className="mt-2 font-heading text-2xl font-semibold text-neutral-900 transition group-hover:text-primary sm:text-3xl">
                    {post.title}
                  </h2>
                  {post.subtitle || post.excerpt ? (
                    <p className="mt-2 text-base leading-relaxed text-neutral-600">
                      {post.subtitle || post.excerpt}
                    </p>
                  ) : null}
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

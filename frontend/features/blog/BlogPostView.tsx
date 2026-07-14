"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BlogByline } from "@/features/blog/BlogByline";
import { fetchPublishedBlogPost, type BlogPostPublicDetail } from "@/lib/blogApi";
import { getApiErrorDetail } from "@/lib/api-errors";

type BlogPostViewProps = {
  slug: string;
};

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
          setError(getApiErrorDetail(e) ?? "Post not found.");
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
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-center sm:px-6">
        <p className="text-neutral-700">{error ?? "Post not found."}</p>
        <Link href="/blog" className="text-sm font-medium text-primary hover:underline">
          Back to blog
        </Link>
      </div>
    );
  }

  return (
    <article>
      <div className="mx-auto max-w-[42rem] px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-neutral-600 transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All posts
        </Link>

        <header className="mb-8 space-y-4 text-left">
          <BlogByline
            publishedAt={formatPublished(post.published_at)}
            publishedAtIso={post.published_at}
            authorName={post.author_name}
          />
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
            {post.title}
          </h1>
          {post.subtitle &&
          post.subtitle.trim().toLowerCase() !== post.title.trim().toLowerCase() ? (
            <p className="text-lg leading-relaxed text-neutral-600 sm:text-xl">{post.subtitle}</p>
          ) : null}
        </header>

        {post.cover_image_url ? (
          <div className="mb-10 overflow-hidden rounded-2xl bg-neutral-100">
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
      </div>
    </article>
  );
}

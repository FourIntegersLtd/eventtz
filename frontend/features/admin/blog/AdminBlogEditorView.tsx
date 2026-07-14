"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { adminCard } from "@/features/admin/adminTheme";
import { BlogRichTextEditor } from "@/features/admin/blog/BlogRichTextEditor";
import {
  deleteAdminBlogPost,
  fetchAdminBlogPost,
  publishAdminBlogPost,
  unpublishAdminBlogPost,
  updateAdminBlogPost,
  type BlogPostAdminDetail,
} from "@/lib/adminBlogApi";
import { uploadImage } from "@/lib/mediaApi";
import { getApiErrorDetail } from "@/lib/api-errors";

type AdminBlogEditorViewProps = {
  postId: string;
};

export function AdminBlogEditorView({ postId }: AdminBlogEditorViewProps) {
  const router = useRouter();
  const coverRef = useRef<HTMLInputElement>(null);
  const [post, setPost] = useState<BlogPostAdminDetail | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [bodyJson, setBodyJson] = useState<Record<string, unknown> | null>(null);
  const [bodyHtml, setBodyHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const p = await fetchAdminBlogPost(postId);
      setPost(p);
      setTitle(p.title);
      setSubtitle(p.subtitle ?? "");
      setSlug(p.slug);
      setCoverUrl(p.cover_image_url);
      setAuthorName(p.author_name ?? "");
      setBodyJson(p.body_json ?? null);
      setBodyHtml(p.body_html ?? "");
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not load post.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistBody = async () => {
    const updated = await updateAdminBlogPost(postId, {
      title,
      subtitle: subtitle || null,
      slug,
      cover_image_url: coverUrl,
      author_name: authorName.trim() || null,
      body_json: bodyJson ?? undefined,
      body_html: bodyHtml,
      excerpt: subtitle || title.slice(0, 160) || null,
    });
    setPost(updated);
    setSlug(updated.slug);
    return updated;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSavedHint(null);
    try {
      await persistBody();
      setSavedHint("Saved");
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!post) return;
    setPublishing(true);
    setError(null);
    try {
      await persistBody();
      const updated =
        post.status === "published"
          ? await unpublishAdminBlogPost(postId)
          : await publishAdminBlogPost(postId);
      setPost(updated);
      setSavedHint(updated.status === "published" ? "Published" : "Unpublished");
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not update publish state.");
    } finally {
      setPublishing(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this post permanently?")) return;
    try {
      await deleteAdminBlogPost(postId);
      router.push("/admin/blog");
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not delete.");
    }
  };

  const onCover = async (file: File) => {
    try {
      const uploaded = await uploadImage(file);
      setCoverUrl(uploaded.public_url);
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not upload cover.");
    }
  };

  if (loading) return <AdminLoadingState label="Loading editor…" />;
  if (!post) {
    return (
      <div className="space-y-4">
        {error ? <AdminErrorBanner message={error} /> : null}
        <Link href="/admin/blog" className="text-sm text-primary hover:underline">
          Back to blog
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none space-y-5 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/blog"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All posts
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {savedHint ? <span className="text-xs text-neutral-500">{savedHint}</span> : null}
          <Button variant="secondary" size="sm" loading={saving} onClick={() => void save()}>
            Save draft
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={publishing}
            onClick={() => void togglePublish()}
          >
            {post.status === "published" ? "Unpublish" : "Publish"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-4 w-4" aria-hidden />}
            onClick={() => void remove()}
          >
            Delete
          </Button>
        </div>
      </div>

      {error ? <AdminErrorBanner message={error} /> : null}

      <div className={`${adminCard} space-y-4 p-5 text-left sm:p-8`}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full border-0 bg-transparent text-left font-heading text-3xl font-semibold text-neutral-900 placeholder:text-neutral-300 focus:outline-none sm:text-4xl"
        />
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Subtitle"
          className="w-full border-0 bg-transparent text-left text-lg text-neutral-600 placeholder:text-neutral-300 focus:outline-none"
        />
        <label className="block text-sm text-neutral-600">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Author
          </span>
          <input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Shown as “By …” on the public blog"
            maxLength={120}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <label className="block text-sm text-neutral-600">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Slug
          </span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Cover image
          </p>
          {coverUrl ? (
            <div className="mb-3 overflow-hidden rounded-xl bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt=""
                className="mx-auto max-h-80 w-full object-contain object-top"
              />
            </div>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload className="h-4 w-4" aria-hidden />}
            onClick={() => coverRef.current?.click()}
          >
            {coverUrl ? "Replace cover" : "Upload cover"}
          </Button>
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onCover(f);
            }}
          />
        </div>

        {bodyJson !== null || !loading ? (
          <BlogRichTextEditor
            key={post.id}
            initialJson={bodyJson}
            onChange={({ json, html }) => {
              setBodyJson(json);
              setBodyHtml(html);
            }}
          />
        ) : null}

        {post.status === "published" ? (
          <p className="text-sm text-neutral-500">
            Live at{" "}
            <Link href={`/blog/${post.slug}`} className="text-primary hover:underline" target="_blank">
              /blog/{post.slug}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

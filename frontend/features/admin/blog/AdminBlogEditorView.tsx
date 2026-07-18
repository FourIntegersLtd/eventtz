"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
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
import { adminBlogSaveSchema, parseForm } from "@/lib/validation";

type AdminBlogEditorViewProps = {
  postId: string;
};

const inputClass =
  "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

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
    const parsed = parseForm(adminBlogSaveSchema, {
      title,
      subtitle,
      slug,
      authorName,
    });
    if (!parsed.ok) {
      throw new Error(parsed.formError);
    }
    const titleTrim = parsed.data.title;
    const subtitleTrim = (parsed.data.subtitle ?? "").trim();
    // Avoid storing a subtitle that just repeats the title (shows twice on the public post page).
    const subtitleOut =
      subtitleTrim && subtitleTrim.toLowerCase() !== titleTrim.toLowerCase()
        ? subtitleTrim
        : null;
    const updated = await updateAdminBlogPost(postId, {
      title: titleTrim,
      subtitle: subtitleOut,
      slug,
      cover_image_url: coverUrl,
      author_name: authorName.trim() || null,
      body_json: bodyJson ?? undefined,
      body_html: bodyHtml,
      excerpt: subtitleOut,
    });
    setPost(updated);
    setSlug(updated.slug);
    if (!subtitleOut && subtitleTrim) setSubtitle("");
    return updated;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSavedHint(null);
    try {
      await persistBody();
      setSavedHint(post?.status === "published" ? "Changes saved" : "Draft saved");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : getApiErrorDetail(e) ?? "Could not save.");
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
      setSavedHint(updated.status === "published" ? "Published" : "Moved to draft");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : getApiErrorDetail(e) ?? "Could not update publish state.");
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

  const isPublished = post.status === "published";

  return (
    <div className="w-full max-w-none space-y-6 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href="/admin/blog"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All posts
          </Link>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isPublished
                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80"
                : "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200/80"
            }`}
          >
            {isPublished ? "Published" : "Draft"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {savedHint ? <span className="text-xs text-neutral-500">{savedHint}</span> : null}
          <Button
            variant={isPublished ? "primary" : "secondary"}
            size="sm"
            loading={saving}
            onClick={() => void save()}
          >
            {isPublished ? "Save changes" : "Save draft"}
          </Button>
          <Button
            variant={isPublished ? "secondary" : "primary"}
            size="sm"
            loading={publishing}
            onClick={() => void togglePublish()}
          >
            {isPublished ? "Unpublish" : "Publish"}
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

      <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Details</h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">
            {isPublished
              ? "This post is live. Save changes to update it, or unpublish to take it offline."
              : "Draft stays private until you publish."}
            {isPublished ? (
              <>
                {" "}
                Live at{" "}
                <Link
                  href={`/blog/${post.slug}`}
                  className="font-medium text-primary hover:underline"
                  target="_blank"
                >
                  /blog/{post.slug}
                </Link>
                .
              </>
            ) : null}
          </p>
        </div>

        <div className="divide-y divide-neutral-100 border-t border-neutral-100">
          <div className="space-y-3 px-5 py-4 sm:px-6">
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
          </div>

          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 sm:px-6">
            <label className="block text-sm text-neutral-600">
              <span className="mb-1 block text-[13px] text-neutral-500">Author</span>
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Shown as “By …” on the public blog"
                maxLength={120}
                className={inputClass}
              />
            </label>
            <label className="block text-sm text-neutral-600">
              <span className="mb-1 block text-[13px] text-neutral-500">Slug</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Cover image</h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">Shown at the top of the public post.</p>
        </div>
        <div className="border-t border-neutral-100 px-5 py-4 sm:px-6">
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
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Body</h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">Main post content.</p>
        </div>
        <div className="border-t border-neutral-100 px-5 py-4 sm:px-6">
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
        </div>
      </section>
    </div>
  );
}

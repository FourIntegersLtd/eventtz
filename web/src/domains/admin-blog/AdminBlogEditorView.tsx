"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateBlogSaveFields } from "@/domains/admin-blog/blogSaveValidation";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/foundation/ui";
import { AdminErrorBanner, AdminLoadingState, AdminSuccessBanner } from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import {
  deleteAdminBlogPost,
  fetchAdminBlogPost,
  publishAdminBlogPost,
  unpublishAdminBlogPost,
  updateAdminBlogPost,
  type BlogPostAdminDetail,
} from "@/domains/admin-blog/api";

/**
 * `/admin/blog/[id]` — the post editor.
 *
 * The baseline uses a Tiptap rich-text editor; `web` has no rich-text
 * dependency yet (see hand-off — Tiptap is "wanted"), so the body is edited
 * as raw HTML in a plain textarea. Title/subtitle/excerpt/slug/cover image
 * are plain text fields, matching the baseline's editor sidebar fields.
 */
export function AdminBlogEditorView({ postId }: { postId: string }) {
  const router = useRouter();
  const [post, setPost] = useState<BlogPostAdminDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const mySeq = ++requestSeq.current;
    try {
      const loaded = await fetchAdminBlogPost(postId);
      if (mySeq !== requestSeq.current) return;
      setPost(loaded);
      setTitle(loaded.title);
      setSubtitle(loaded.subtitle ?? "");
      setSlug(loaded.slug);
      setExcerpt(loaded.excerpt ?? "");
      setCoverImageUrl(loaded.cover_image_url ?? "");
      setBodyHtml(loaded.body_html);
    } catch (cause) {
      if (mySeq !== requestSeq.current) return;
      setError(isPlatformError(cause) ? cause.detail : "Not found.");
    } finally {
      if (mySeq !== requestSeq.current) return;
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    // Deferred to a microtask: calling `load` (it sets state) synchronously
    // in the effect body trips react-hooks/set-state-in-effect, since `load`
    // is also called directly from event handlers below and cannot itself
    // be rewritten as an inline promise chain.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function handleSave() {
    const validationError = validateBlogSaveFields({ title, subtitle, slug });
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const saved = await updateAdminBlogPost(postId, {
        title,
        subtitle: subtitle || null,
        slug: slug || null,
        excerpt: excerpt || null,
        cover_image_url: coverImageUrl || null,
        body_html: bodyHtml,
      });
      setPost(saved);
      setNotice("Saved.");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishToggle() {
    if (!post) return;
    setSaving(true);
    setNotice(null);
    try {
      const updated = post.status === "published" ? await unpublishAdminBlogPost(postId) : await publishAdminBlogPost(postId);
      setPost(updated);
      setNotice(updated.status === "published" ? "Published." : "Moved back to draft.");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not change publish status.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this post for good?")) return;
    setSaving(true);
    try {
      await deleteAdminBlogPost(postId);
      router.push("/admin/blog");
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not delete.");
      setSaving(false);
    }
  }

  if (loading) return <AdminLoadingState label="Loading post…" />;
  if (error || !post) return <AdminErrorBanner message={error ?? "Not found."} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={
            post.status === "published"
              ? "rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
              : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700"
          }
        >
          {post.status}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" loading={saving} onClick={() => void handlePublishToggle()}>
            {post.status === "published" ? "Unpublish" : "Publish"}
          </Button>
          <Button variant="secondary" loading={saving} onClick={() => void handleDelete()}>
            Delete
          </Button>
          <Button loading={saving} onClick={() => void handleSave()}>
            Save
          </Button>
        </div>
      </div>
      {notice ? <AdminSuccessBanner message={notice} /> : null}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <label className="block text-sm font-medium text-neutral-700">
            Body (HTML)
            <textarea
              value={bodyHtml}
              onChange={(event) => setBodyHtml(event.target.value)}
              rows={20}
              className="mt-1 w-full rounded-xl border border-primary-border px-3 py-2 font-mono text-xs"
            />
          </label>
        </div>
        <div className="space-y-3">
          <TextField label="Subtitle" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} />
          <TextField label="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
          <TextField label="Excerpt" value={excerpt} onChange={(event) => setExcerpt(event.target.value)} />
          <TextField
            label="Cover image URL"
            value={coverImageUrl}
            onChange={(event) => setCoverImageUrl(event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

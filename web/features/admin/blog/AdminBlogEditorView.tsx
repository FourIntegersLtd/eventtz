"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
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

export type AdminBlogEditorPageHead = {
  title?: string;
  description?: string;
  actions?: ReactNode;
};

type AdminBlogEditorViewProps = {
  postId: string;
  onRegisterPageHead?: (head: AdminBlogEditorPageHead) => void;
};

export function AdminBlogEditorView({ postId, onRegisterPageHead }: AdminBlogEditorViewProps) {
  const router = useRouter();
  const { showToast } = useToast();
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
  const [coverError, setCoverError] = useState<string | null>(null);

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
      setSavedHint(post?.status === "published" ? "Saved" : "Saved");
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
      setSavedHint(updated.status === "published" ? "Published" : "Draft");
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
    setCoverError(null);
    try {
      const uploaded = await uploadImage(file);
      setCoverUrl(uploaded.public_url);
      showToast({ title: "Cover image uploaded", tone: "success" });
    } catch (e: unknown) {
      const message = getApiErrorDetail(e) ?? "Could not upload cover.";
      setCoverError(message);
      setError(message);
    }
  };

  const isPublished = post?.status === "published";

  useEffect(() => {
    if (!onRegisterPageHead || !post) return;
    onRegisterPageHead({
      title: "Edit post",
      description: savedHint ?? undefined,
      actions: (
        <Badge tone={isPublished ? "success" : "neutral"}>{isPublished ? "Published" : "Draft"}</Badge>
      ),
    });
    return () => onRegisterPageHead({});
  }, [onRegisterPageHead, post, isPublished, savedHint]);

  if (loading) return <AdminLoadingState label="Loading editor…" />;
  if (!post) {
    return (
      <div className="ez-stack">
        {error ? <AdminErrorBanner message={error} onRetry={() => void load()} /> : null}
        <Link href="/admin/blog" className="ez-back">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All posts
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none ez-stack ez-stack--lg text-left">
      <Link href="/admin/blog" className="ez-back">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All posts
      </Link>

      {error ? <AdminErrorBanner message={error} /> : null}

      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <label className="ez-field">
            <span className="ez-label">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title"
              className="ez-input text-[1.35rem] font-semibold"
            />
          </label>

          {bodyJson !== null ? (
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

        <div className="ez-split__aside ez-stack ez-stack--lg lg:sticky lg:top-4">
          <Card as="section" className="overflow-hidden">
            <Card.Header>
              <h2 className="ez-h3">Publish</h2>
            </Card.Header>
            <Card.Body className="ez-stack ez-stack--sm">
              {savedHint ? <p className="ez-caption">{savedHint}</p> : null}
              <Button
                variant="secondary"
                block
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : isPublished ? "Update" : "Save draft"}
              </Button>
              <Button
                block
                disabled={publishing}
                onClick={() => void togglePublish()}
              >
                {publishing ? "Working…" : isPublished ? "Unpublish" : "Publish"}
              </Button>
              {isPublished ? (
                <ButtonLink
                  href={`/blog/${post.slug}`}
                  variant="secondary"
                  block
                  target="_blank"
                >
                  Preview
                </ButtonLink>
              ) : (
                <Button variant="secondary" block disabled>
                  Preview
                </Button>
              )}
              <Button
                variant="secondary"
                block
                icon={<Trash2 className="h-4 w-4" aria-hidden />}
                onClick={() => void remove()}
              >
                Delete
              </Button>
            </Card.Body>
          </Card>

          <Card as="section" className="overflow-hidden">
            <Card.Header>
              <h2 className="ez-h3">Details</h2>
            </Card.Header>
            <Card.Body className="ez-stack ez-stack--sm">
              <label className="ez-field">
                <span className="ez-label">Author</span>
                <input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="ez-input"
                  maxLength={120}
                />
              </label>
              <label className="ez-field">
                <span className="ez-label">URL slug</span>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} className="ez-input" />
              </label>
              <label className="ez-field">
                <span className="ez-label">Excerpt</span>
                <textarea
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  rows={3}
                  className="ez-input ez-input--area"
                  placeholder="Short summary for listings"
                />
              </label>
            </Card.Body>
          </Card>

          <Card as="section" className="overflow-hidden">
            <Card.Header>
              <h2 className="ez-h3">Cover image</h2>
              <p className="ez-small">JPG or PNG, at least 1600px wide</p>
            </Card.Header>
            <Card.Body className="ez-stack ez-stack--sm">
              {coverUrl ? (
                <div className="overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverUrl} alt="" className="w-full object-cover" />
                </div>
              ) : (
                <div className="ez-upload">
                  <p className="ez-small">Drop an image or choose a file</p>
                </div>
              )}
              <Button variant="secondary" size="sm" onClick={() => coverRef.current?.click()}>
                {coverUrl ? "Replace cover" : "Choose file"}
              </Button>
              {coverError ? <p className="text-sm text-red-700">{coverError}</p> : null}
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void onCover(file);
                }}
              />
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
}

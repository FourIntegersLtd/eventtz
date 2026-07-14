"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableElement,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from "@/features/admin/components/AdminTable";
import {
  createAdminBlogPost,
  fetchAdminBlogPosts,
  type BlogPostListItem,
} from "@/lib/adminBlogApi";
import { formatDateTime } from "@/lib/dateFormat";
import { getApiErrorDetail } from "@/lib/api-errors";

export function AdminBlogListView() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPosts(await fetchAdminBlogPosts());
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not load posts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createPost = async () => {
    setCreating(true);
    setError(null);
    try {
      const post = await createAdminBlogPost({ title: "Untitled" });
      router.push(`/admin/blog/${post.id}`);
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not create post.");
      setCreating(false);
    }
  };

  if (loading) return <AdminLoadingState label="Loading posts…" />;

  return (
    <div className="space-y-4">
      {error ? <AdminErrorBanner message={error} /> : null}
      <AdminPageHeader
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" aria-hidden />}
            loading={creating}
            onClick={() => void createPost()}
          >
            New post
          </Button>
        }
      />

      {posts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description="Write your first draft and publish when you’re ready."
          action={
            <Button variant="primary" size="sm" loading={creating} onClick={() => void createPost()}>
              New post
            </Button>
          }
        />
      ) : (
        <AdminTable>
          <AdminTableElement>
            <AdminTableHead>
              <AdminTableHeaderCell>Title</AdminTableHeaderCell>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Updated</AdminTableHeaderCell>
              <AdminTableHeaderCell className="text-right"> </AdminTableHeaderCell>
            </AdminTableHead>
            <AdminTableBody>
              {posts.map((p) => (
                <AdminTableRow key={p.id}>
                  <AdminTableCell>
                    <p className="font-medium text-neutral-900">{p.title || "Untitled"}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      /{p.slug}
                      {p.author_name?.trim() ? ` · By ${p.author_name.trim()}` : ""}
                    </p>
                  </AdminTableCell>
                  <AdminTableCell>
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                        p.status === "published"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {p.status}
                    </span>
                  </AdminTableCell>
                  <AdminTableCell className="text-sm text-neutral-600">
                    {p.updated_at ? formatDateTime(p.updated_at) : "—"}
                  </AdminTableCell>
                  <AdminTableCell className="text-right">
                    <Link
                      href={`/admin/blog/${p.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Edit
                    </Link>
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminTableElement>
        </AdminTable>
      )}
    </div>
  );
}

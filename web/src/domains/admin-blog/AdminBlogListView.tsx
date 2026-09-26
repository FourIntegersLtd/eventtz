"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/foundation/ui";
import {
  AdminEmptyState,
  AdminErrorBanner,
  AdminLoadingState,
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
  formatDate,
} from "@/capabilities/admin-shell";
import { isPlatformError } from "@/foundation/platform-client";
import { createAdminBlogPost, fetchAdminBlogPosts, type BlogPostListItem } from "@/domains/admin-blog/api";

/** `/admin/blog` — every post, with a button to start a new draft. */
export function AdminBlogListView() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    // Initial loading/error state already covers mount; a later manual
    // refresh (via this same function) just swaps data in place, since
    // synchronous setState in the mount effect trips set-state-in-effect.
    try {
      setPosts(await fetchAdminBlogPosts());
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not load posts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred to a microtask: calling `load` (it sets state) synchronously
    // in the effect body trips react-hooks/set-state-in-effect, since `load`
    // is also called directly from event handlers below and cannot itself
    // be rewritten as an inline promise chain.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function handleNewDraft() {
    setCreating(true);
    try {
      const post = await createAdminBlogPost({ title: "Untitled" });
      router.push(`/admin/blog/${post.id}`);
    } catch (cause) {
      setError(isPlatformError(cause) ? cause.detail : "Could not start a new draft.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button loading={creating} onClick={() => void handleNewDraft()}>
          New draft
        </Button>
      </div>
      {loading ? <AdminLoadingState label="Loading posts…" /> : null}
      {!loading && error ? <AdminErrorBanner message={error} /> : null}
      {!loading && !error && posts.length === 0 ? <AdminEmptyState title="No posts yet" /> : null}
      {!loading && !error && posts.length > 0 ? (
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTableHeaderCell>Title</AdminTableHeaderCell>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Updated</AdminTableHeaderCell>
              <AdminTableHeaderCell>View</AdminTableHeaderCell>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {posts.map((post) => (
              <AdminTableRow key={post.id}>
                <AdminTableCell>
                  {post.title}
                  <div className="text-xs text-neutral-500">{post.subtitle ?? ""}</div>
                </AdminTableCell>
                <AdminTableCell>
                  <span
                    className={
                      post.status === "published"
                        ? "rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
                        : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700"
                    }
                  >
                    {post.status}
                  </span>
                </AdminTableCell>
                <AdminTableCell>{formatDate(post.updated_at)}</AdminTableCell>
                <AdminTableCell>
                  <Link href={`/admin/blog/${post.id}`} className="font-medium text-primary hover:underline">
                    Edit
                  </Link>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminTable>
      ) : null}
    </div>
  );
}

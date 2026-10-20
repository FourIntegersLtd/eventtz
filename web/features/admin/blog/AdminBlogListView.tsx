"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { TablePagination } from "@/components/ui/TablePagination";
import { AdminErrorBanner } from "@/features/admin/components/AdminErrorBanner";
import { EzFilterOptionsModal } from "@/components/ui/EzFilterOptionsModal";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import type { EzFilterOption } from "@/components/ui/ezFilterTypes";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { adminFilterControlClass } from "@/features/admin/components/adminFilterControlClass";
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
  ADMIN_BLOG_PAGE_SIZE,
  createAdminBlogPost,
  fetchAdminBlogPostsPage,
  type BlogPostListItem,
  type BlogPostStatus,
} from "@/lib/adminBlogApi";
import { formatDateTime } from "@/lib/dateFormat";
import { getApiErrorDetail } from "@/lib/api-errors";

export type AdminBlogListPageHead = {
  description?: string;
  actions?: ReactNode;
};

type AdminBlogListViewProps = {
  onRegisterPageHead?: (head: AdminBlogListPageHead) => void;
};

function statusBadge(status: BlogPostStatus) {
  return status === "published" ? (
    <span className="ez-badge ez-badge--success">Published</span>
  ) : (
    <span className="ez-badge ez-badge--neutral">Draft</span>
  );
}

export function AdminBlogListView({ onRegisterPageHead }: AdminBlogListViewProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | BlogPostStatus>("");
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [offset, setOffset] = useState(0);

  const BLOG_STATUS_FILTER_OPTIONS: EzFilterOption<"" | BlogPostStatus>[] = [
    { id: "", title: "All posts" },
    { id: "published", title: "Published" },
    { id: "draft", title: "Draft" },
  ];

  const blogStatusLabel =
    BLOG_STATUS_FILTER_OPTIONS.find((option) => option.id === statusFilter)?.title ?? "Status";
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const page = await fetchAdminBlogPostsPage(offset, ADMIN_BLOG_PAGE_SIZE, {
        search,
        status: statusFilter,
      });
      setPosts(page.posts);
      setTotal(page.total);
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not load posts.");
    } finally {
      setLoading(false);
    }
  }, [offset, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const createPost = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const post = await createAdminBlogPost({ title: "Untitled" });
      router.push(`/admin/blog/${post.id}`);
    } catch (e: unknown) {
      setError(getApiErrorDetail(e) ?? "Could not create post.");
      setCreating(false);
    }
  }, [router]);

  useEffect(() => {
    if (!onRegisterPageHead) return;
    onRegisterPageHead({
      description: total ? `${total} post${total === 1 ? "" : "s"}` : undefined,
      actions: (
        <button
          type="button"
          className="ez-btn ez-btn--primary ez-btn--sm"
          disabled={creating}
          onClick={() => void createPost()}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New post
        </button>
      ),
    });
    return () => onRegisterPageHead({});
  }, [onRegisterPageHead, total, creating, createPost]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setOffset(0);
  };

  if (loading && posts.length === 0) return <AdminLoadingState label="Loading posts…" />;

  return (
    <div className="ez-stack">
      {error ? <AdminErrorBanner message={error} onRetry={() => void load()} /> : null}

      <EzListFilterToolbar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setOffset(0);
        }}
        searchPlaceholder="Search title or slug"
        searchAriaLabel="Search posts"
        inputClassName={adminFilterControlClass}
        onOpenFilter={() => setStatusFilterOpen(true)}
        activeFilterCount={statusFilter ? 1 : 0}
        summary={
          statusFilter
            ? {
                label: blogStatusLabel,
                onClear: () => {
                  setStatusFilter("");
                  setOffset(0);
                },
              }
            : null
        }
      />

      <EzFilterOptionsModal
        isOpen={statusFilterOpen}
        onClose={() => setStatusFilterOpen(false)}
        title="Filter posts"
        description="Show all posts or narrow by publish status."
        options={BLOG_STATUS_FILTER_OPTIONS}
        value={statusFilter}
        onChange={(id) => {
          setStatusFilter(id);
          setOffset(0);
        }}
        listAriaLabel="Post status"
        resetValue=""
        resetLabel="Show all"
      />

      {posts.length === 0 ? (
        <EmptyState
          title={total === 0 && !search && !statusFilter ? "No posts yet" : "No posts match your filters"}
          lottie="searchNoResults"
          action={
            total === 0 && !search && !statusFilter ? (
              <button
                type="button"
                className="ez-btn ez-btn--primary ez-btn--sm"
                disabled={creating}
                onClick={() => void createPost()}
              >
                New post
              </button>
            ) : (
              <button type="button" className="ez-btn ez-btn--secondary ez-btn--sm" onClick={clearFilters}>
                Clear filters
              </button>
            )
          }
        />
      ) : (
        <AdminTable>
          <AdminTableElement className="min-w-[32rem]">
            <AdminTableHead>
              <AdminTableHeaderCell>Title</AdminTableHeaderCell>
              <AdminTableHeaderCell>Author</AdminTableHeaderCell>
              <AdminTableHeaderCell className="ez-td-status">Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Date</AdminTableHeaderCell>
              <AdminTableHeaderCell> </AdminTableHeaderCell>
            </AdminTableHead>
            <AdminTableBody>
              {posts.map((p) => (
                <AdminTableRow key={p.id}>
                  <AdminTableCell>
                    <p className="ez-td-strong">{p.title || "Untitled"}</p>
                    <p className="ez-caption">/{p.slug}</p>
                  </AdminTableCell>
                  <AdminTableCell>{p.author_name?.trim() || "-"}</AdminTableCell>
                  <AdminTableCell className="ez-td-status">{statusBadge(p.status)}</AdminTableCell>
                  <AdminTableCell className="ez-small">
                    {p.updated_at ? formatDateTime(p.updated_at) : "-"}
                  </AdminTableCell>
                  <AdminTableCell>
                    <Link href={`/admin/blog/${p.id}`} className="ez-btn ez-btn--secondary ez-btn--sm">
                      Edit
                    </Link>
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminTableElement>
        </AdminTable>
      )}

      <TablePagination
        offset={offset}
        limit={ADMIN_BLOG_PAGE_SIZE}
        total={total}
        loading={loading}
        onPrevious={() => setOffset((current) => Math.max(0, current - ADMIN_BLOG_PAGE_SIZE))}
        onNext={() => setOffset((current) => current + ADMIN_BLOG_PAGE_SIZE)}
      />
    </div>
  );
}

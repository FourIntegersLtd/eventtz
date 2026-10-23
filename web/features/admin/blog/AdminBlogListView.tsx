"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { TablePagination } from "@/components/ui/TablePagination";
import { AdminErrorBanner } from "@/components/ui/AdminErrorBanner";
import { EzFilterOptionsModal } from "@/components/ui/EzFilterOptionsModal";
import { EzListFilterToolbar } from "@/components/ui/EzListFilterToolbar";
import type { EzFilterOption } from "@/components/ui/ezFilterTypes";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { DataTable } from "@/components/ui/DataTable";
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
        <DataTable
          aria-label="Blog posts"
          tableClassName="min-w-[32rem]"
          rows={posts}
          getRowKey={(post) => post.id}
          columns={[
            {
              key: "title",
              header: "Title",
              cell: (post) => (
                <>
                  <p className="ez-td-strong">{post.title || "Untitled"}</p>
                  <p className="ez-caption">/{post.slug}</p>
                </>
              ),
            },
            { key: "author", header: "Author", cell: (post) => post.author_name?.trim() || "-" },
            { key: "status", header: "Status", kind: "status", cell: (post) => statusBadge(post.status) },
            {
              key: "date",
              header: "Date",
              className: "ez-small",
              cell: (post) => (post.updated_at ? formatDateTime(post.updated_at) : "-"),
            },
            {
              key: "edit",
              header: " ",
              cell: (post) => (
                <Link href={`/admin/blog/${post.id}`} className="ez-btn ez-btn--secondary ez-btn--sm">
                  Edit
                </Link>
              ),
            },
          ]}
        />
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

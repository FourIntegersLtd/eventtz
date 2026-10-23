"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
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
import { useServerList } from "@/lib/useServerList";
import { formatDateTime } from "@/lib/dateFormat";
import { getApiErrorDetail } from "@/lib/api-errors";

export type AdminBlogListPageHead = {
  description?: string;
  actions?: ReactNode;
};

type AdminBlogListViewProps = {
  onRegisterPageHead?: (head: AdminBlogListPageHead) => void;
};

const BLOG_STATUS_FILTER_OPTIONS: EzFilterOption<"" | BlogPostStatus>[] = [
  { id: "", title: "All posts" },
  { id: "published", title: "Published" },
  { id: "draft", title: "Draft" },
];

function statusBadge(status: BlogPostStatus) {
  return status === "published" ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>;
}

export function AdminBlogListView({ onRegisterPageHead }: AdminBlogListViewProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | BlogPostStatus>("");
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);

  const blogStatusLabel =
    BLOG_STATUS_FILTER_OPTIONS.find((option) => option.id === statusFilter)?.title ?? "Status";

  const {
    items: posts,
    total,
    offset,
    limit,
    loading,
    error: loadError,
    goNext,
    goPrevious,
    reload,
  } = useServerList<BlogPostListItem, { status: "" | BlogPostStatus }>({
    fetchPage: async (query) => {
      const page = await fetchAdminBlogPostsPage(query.offset, query.limit, {
        search: query.search,
        status: query.filters.status,
      });
      return { items: page.posts, total: page.total };
    },
    filters: { status: statusFilter },
    search,
    pageSize: ADMIN_BLOG_PAGE_SIZE,
    errorMessage: "Could not load posts.",
  });
  const error = createError ?? loadError;

  const createPost = useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const post = await createAdminBlogPost({ title: "Untitled" });
      router.push(`/admin/blog/${post.id}`);
    } catch (e: unknown) {
      setCreateError(getApiErrorDetail(e) ?? "Could not create post.");
      setCreating(false);
    }
  }, [router]);

  useEffect(() => {
    if (!onRegisterPageHead) return;
    onRegisterPageHead({
      description: total ? `${total} post${total === 1 ? "" : "s"}` : undefined,
      actions: (
        <Button
          size="sm"
          disabled={creating}
          icon={<Plus className="h-4 w-4" aria-hidden />}
          onClick={() => void createPost()}
        >
          New post
        </Button>
      ),
    });
    return () => onRegisterPageHead({});
  }, [onRegisterPageHead, total, creating, createPost]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
  };

  if (loading && posts.length === 0) return <AdminLoadingState label="Loading posts…" />;

  return (
    <div className="ez-stack">
      {error ? <AdminErrorBanner message={error} onRetry={() => {
          setCreateError(null);
          reload();
        }} /> : null}

      <EzListFilterToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title or slug"
        searchAriaLabel="Search posts"
        onOpenFilter={() => setStatusFilterOpen(true)}
        activeFilterCount={statusFilter ? 1 : 0}
        summary={
          statusFilter
            ? {
                label: blogStatusLabel,
                onClear: () => setStatusFilter(""),
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
        onChange={setStatusFilter}
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
              <Button size="sm" disabled={creating} onClick={() => void createPost()}>
                New post
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
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
                <ButtonLink href={`/admin/blog/${post.id}`} variant="secondary" size="sm">
                  Edit
                </ButtonLink>
              ),
            },
          ]}
        />
      )}

      <TablePagination
        offset={offset}
        limit={limit}
        total={total}
        loading={loading}
        onPrevious={goPrevious}
        onNext={goNext}
      />
    </div>
  );
}

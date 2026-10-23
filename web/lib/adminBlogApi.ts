import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export type BlogPostStatus = "draft" | "published";

export type BlogPostListItem = components["schemas"]["BlogPostListItem"];

export type BlogPostAdminDetail = components["schemas"]["BlogPostAdminDetail"];

type BlogPostAdminDetailResponse = components["schemas"]["BlogPostAdminDetailResponse"];

function prefix() {
  return "/api/v1/admin/blog";
}

export const ADMIN_BLOG_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export async function fetchAdminBlogPostsPage(
  offset = 0,
  limit = ADMIN_BLOG_PAGE_SIZE,
  opts?: { search?: string; status?: BlogPostStatus | "" },
): Promise<{
  posts: BlogPostListItem[];
  total: number;
  offset: number;
  limit: number;
}> {
  const params: Record<string, string | number> = { offset, limit };
  const search = opts?.search?.trim();
  if (search) params.search = search;
  if (opts?.status) params.status = opts.status;
  const { data } = await api.get<components["schemas"]["BlogPostsListResponse"]>(
    `${prefix()}/posts`,
    { params },
  );
  return {
    posts: data.posts ?? [],
    total: data.total ?? 0,
    offset: data.offset ?? offset,
    limit: data.limit ?? limit,
  };
}

export async function fetchAdminBlogPosts(): Promise<BlogPostListItem[]> {
  const page = await fetchAdminBlogPostsPage(0, 200);
  return page.posts;
}

export async function fetchAdminBlogPost(postId: string): Promise<BlogPostAdminDetail> {
  const { data } = await api.get<BlogPostAdminDetailResponse>(
    `${prefix()}/posts/${encodeURIComponent(postId)}`,
  );
  return data.post;
}

export async function createAdminBlogPost(body?: components["schemas"]["BlogPostCreateBody"]): Promise<BlogPostAdminDetail> {
  const { data } = await api.post<BlogPostAdminDetailResponse>(`${prefix()}/posts`, body ?? {});
  return data.post;
}

export async function updateAdminBlogPost(
  postId: string,
  body: components["schemas"]["BlogPostUpdateBody"],
): Promise<BlogPostAdminDetail> {
  const { data } = await api.patch<BlogPostAdminDetailResponse>(
    `${prefix()}/posts/${encodeURIComponent(postId)}`,
    body,
  );
  return data.post;
}

export async function publishAdminBlogPost(postId: string): Promise<BlogPostAdminDetail> {
  const { data } = await api.post<BlogPostAdminDetailResponse>(
    `${prefix()}/posts/${encodeURIComponent(postId)}/publish`,
  );
  return data.post;
}

export async function unpublishAdminBlogPost(postId: string): Promise<BlogPostAdminDetail> {
  const { data } = await api.post<BlogPostAdminDetailResponse>(
    `${prefix()}/posts/${encodeURIComponent(postId)}/unpublish`,
  );
  return data.post;
}

export async function deleteAdminBlogPost(postId: string): Promise<void> {
  await api.delete(`${prefix()}/posts/${encodeURIComponent(postId)}`);
}

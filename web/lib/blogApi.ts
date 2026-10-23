import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";
import type { BlogPostListItem } from "@/lib/adminBlogApi";

export type BlogPostPublicDetail = components["schemas"]["BlogPostPublicDetail"];

function prefix() {
  return "/api/v1/blog";
}

export async function fetchPublishedBlogPosts(): Promise<BlogPostListItem[]> {
  const { data } = await api.get<components["schemas"]["BlogPostsListResponse"]>(
    `${prefix()}/posts`,
  );
  return data.posts ?? [];
}

export async function fetchPublishedBlogPost(slug: string): Promise<BlogPostPublicDetail> {
  const { data } = await api.get<components["schemas"]["BlogPostPublicDetailResponse"]>(
    `${prefix()}/posts/${encodeURIComponent(slug)}`,
  );
  return data.post;
}

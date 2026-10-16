import api from "@/lib/axios";
import type { BlogPostListItem } from "@/lib/adminBlogApi";

export type BlogPostPublicDetail = BlogPostListItem & {
  body_html: string;
};

function prefix() {
  return "/api/v1/blog";
}

export async function fetchPublishedBlogPosts(): Promise<BlogPostListItem[]> {
  const { data } = await api.get<{ posts: BlogPostListItem[] }>(`${prefix()}/posts`);
  return data.posts ?? [];
}

export async function fetchPublishedBlogPost(slug: string): Promise<BlogPostPublicDetail> {
  const { data } = await api.get<{ post: BlogPostPublicDetail }>(
    `${prefix()}/posts/${encodeURIComponent(slug)}`,
  );
  return data.post;
}

/**
 * The marketing domain's requests. Components never call `platformRequest`
 * directly (enforced by `eslint.config.mjs`'s `no-restricted-imports`) — they
 * call the named functions here.
 */
import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

export type BlogPostListItem = components["schemas"]["BlogPostListItem"];
export type BlogPostPublicDetail = components["schemas"]["BlogPostPublicDetail"];

/** The public blog index, newest first. Matches `GET /api/v1/blog/posts`. */
export async function fetchBlogPosts(): Promise<BlogPostListItem[]> {
  const response = await platformRequest<components["schemas"]["BlogPostsListResponse"]>("/api/v1/blog/posts", {
    method: "GET",
  });
  return response.posts;
}

/** One published post by slug. Matches `GET /api/v1/blog/posts/{slug}`. */
export async function fetchBlogPost(slug: string): Promise<BlogPostPublicDetail> {
  const response = await platformRequest<components["schemas"]["BlogPostPublicDetailResponse"]>(
    `/api/v1/blog/posts/${encodeURIComponent(slug)}`,
    { method: "GET" },
  );
  return response.post;
}

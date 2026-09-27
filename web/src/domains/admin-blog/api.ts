import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

export type BlogPostListItem = components["schemas"]["BlogPostListItem"];
export type BlogPostAdminDetail = components["schemas"]["BlogPostAdminDetail"];

/** Every post, draft or published, most recently edited first. */
export async function fetchAdminBlogPosts(): Promise<BlogPostListItem[]> {
  const response = await platformRequest<components["schemas"]["BlogPostsListResponse"]>("/api/v1/admin/blog/posts");
  return response.posts;
}

/** One post as the CMS editor needs it: HTML body plus the editor document. */
export async function fetchAdminBlogPost(postId: string): Promise<BlogPostAdminDetail> {
  const response = await platformRequest<components["schemas"]["BlogPostAdminDetailResponse"]>(
    `/api/v1/admin/blog/posts/${encodeURIComponent(postId)}`,
  );
  return response.post;
}

/** Starts a new draft with a title (and optionally a slug/subtitle/author). */
export async function createAdminBlogPost(
  body: components["schemas"]["BlogPostCreateBody"],
): Promise<BlogPostAdminDetail> {
  const response = await platformRequest<components["schemas"]["BlogPostAdminDetailResponse"]>(
    "/api/v1/admin/blog/posts",
    { method: "POST", body },
  );
  return response.post;
}

/** Saves an edit; only the fields sent change. */
export async function updateAdminBlogPost(
  postId: string,
  body: components["schemas"]["BlogPostUpdateBody"],
): Promise<BlogPostAdminDetail> {
  const response = await platformRequest<components["schemas"]["BlogPostAdminDetailResponse"]>(
    `/api/v1/admin/blog/posts/${encodeURIComponent(postId)}`,
    { method: "PATCH", body },
  );
  return response.post;
}

/** Deletes a post for good. */
export async function deleteAdminBlogPost(postId: string): Promise<void> {
  await platformRequest<components["schemas"]["BlogPostDeleteResponse"]>(
    `/api/v1/admin/blog/posts/${encodeURIComponent(postId)}`,
    { method: "DELETE" },
  );
}

/** Makes a post public. */
export async function publishAdminBlogPost(postId: string): Promise<BlogPostAdminDetail> {
  const response = await platformRequest<components["schemas"]["BlogPostAdminDetailResponse"]>(
    `/api/v1/admin/blog/posts/${encodeURIComponent(postId)}/publish`,
    { method: "POST" },
  );
  return response.post;
}

/** Takes a post back to draft. */
export async function unpublishAdminBlogPost(postId: string): Promise<BlogPostAdminDetail> {
  const response = await platformRequest<components["schemas"]["BlogPostAdminDetailResponse"]>(
    `/api/v1/admin/blog/posts/${encodeURIComponent(postId)}/unpublish`,
    { method: "POST" },
  );
  return response.post;
}

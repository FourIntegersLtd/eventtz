import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

export type HelpAudience = "client" | "vendor" | "admin";

export type HelpCategory = components["schemas"]["HelpCategoryOut"];

export type HelpArticleListItem = components["schemas"]["HelpArticleListItem"];

export type HelpRelatedArticle = components["schemas"]["HelpRelatedArticle"];

export type HelpArticleDetail = components["schemas"]["HelpArticleDetail"];

/**
 * Sent as the field's own name `message_role`, which the API accepts through `populate_by_name`.
 * The generated schema only lists the wire alias `role`, so this stays hand-written.
 */
export type HelpAskMessage = { message_role: "user" | "assistant"; content: string };

export type HelpAskResponse = components["schemas"]["HelpAskResponse"];

export async function fetchHelpCategories(
  audience: HelpAudience,
): Promise<HelpCategory[]> {
  const { data } = await api.get<components["schemas"]["HelpCategoriesResponse"]>(
    "/api/v1/help/categories",
    { params: { audience } },
  );
  return data.categories;
}

export async function fetchHelpArticles(
  audience: HelpAudience,
  categorySlug?: string,
): Promise<HelpArticleListItem[]> {
  const { data } = await api.get<components["schemas"]["HelpArticlesResponse"]>(
    "/api/v1/help/articles",
    { params: { audience, category: categorySlug || undefined } },
  );
  return data.articles;
}

export async function fetchHelpArticle(
  slug: string,
  audience: HelpAudience,
): Promise<HelpArticleDetail> {
  const { data } = await api.get<components["schemas"]["HelpArticleResponse"]>(
    `/api/v1/help/articles/${encodeURIComponent(slug)}`,
    { params: { audience } },
  );
  return data.article;
}

export async function askHelpAssistant(body: {
  question: string;
  audience: HelpAudience;
  history?: HelpAskMessage[];
}): Promise<HelpAskResponse> {
  const { data } = await api.post<HelpAskResponse>("/api/v1/help/ask", body);
  return data;
}

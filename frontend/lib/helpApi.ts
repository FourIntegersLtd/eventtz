import api from "@/lib/axios";

export type HelpAudience = "client" | "vendor" | "admin";

export type HelpCategory = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon_key: string;
  sort_order: number;
  audience: string;
  article_count: number;
};

export type HelpArticleListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  audience: string;
  category_id: string;
  category_slug?: string | null;
  category_title?: string | null;
  sort_order: number;
};

export type HelpArticleDetail = HelpArticleListItem & {
  body_md: string;
  related_slugs: string[];
};

export type HelpAskMessage = { role: "user" | "assistant"; content: string };

export type HelpAskResponse = {
  answer_markdown: string;
  related_article_slugs: string[];
  escalate_to_human: boolean;
  escalate_reason: string | null;
};

export async function fetchHelpCategories(
  audience: HelpAudience,
): Promise<HelpCategory[]> {
  const { data } = await api.get<{ categories: HelpCategory[] }>(
    "/api/v1/help/categories",
    { params: { audience } },
  );
  return data.categories;
}

export async function fetchHelpArticles(
  audience: HelpAudience,
  categorySlug?: string,
): Promise<HelpArticleListItem[]> {
  const { data } = await api.get<{ articles: HelpArticleListItem[] }>(
    "/api/v1/help/articles",
    { params: { audience, category: categorySlug || undefined } },
  );
  return data.articles;
}

export async function fetchHelpArticle(
  slug: string,
  audience: HelpAudience,
): Promise<HelpArticleDetail> {
  const { data } = await api.get<{ article: HelpArticleDetail }>(
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

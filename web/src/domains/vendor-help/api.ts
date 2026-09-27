/**
 * The vendor-help domain's requests: the Help Center (`/api/v1/help/*`) and
 * the shared chat endpoints (`/api/v1/chat/*`), scoped here to the support
 * thread the Help page embeds. Chat's request shapes are intentionally
 * re-declared rather than imported from `domains/vendor-messages` — a domain
 * may import only itself, `capabilities` and `foundation` (`web/eslint.config.mjs`).
 */
import { platformRequest, type components } from "@/foundation/platform-client";

export type HelpCategory = components["schemas"]["HelpCategoryOut"];
export type HelpArticleListItem = components["schemas"]["HelpArticleListItem"];
export type HelpArticleDetail = components["schemas"]["HelpArticleDetail"];
export type HelpAskMessage = components["schemas"]["HelpAskMessage"];
export type HelpAskResponse = components["schemas"]["HelpAskResponse"];
export type ConversationRow = components["schemas"]["ConversationRow"];
export type MessageRow = components["schemas"]["MessageRow"];

const VENDOR_AUDIENCE = "vendor";

/** The Help Center categories for the vendor portal. */
export function fetchHelpCategories(): Promise<HelpCategory[]> {
  return platformRequest<components["schemas"]["HelpCategoriesResponse"]>("/api/v1/help/categories", {
    query: { audience: VENDOR_AUDIENCE },
  }).then((response) => response.categories);
}

/** The vendor portal's articles, optionally within one category. */
export function fetchHelpArticles(categorySlug?: string): Promise<HelpArticleListItem[]> {
  return platformRequest<components["schemas"]["HelpArticlesResponse"]>("/api/v1/help/articles", {
    query: { audience: VENDOR_AUDIENCE, category: categorySlug },
  }).then((response) => response.articles);
}

/** One article's full body. */
export function fetchHelpArticle(slug: string): Promise<HelpArticleDetail> {
  return platformRequest<components["schemas"]["HelpArticleResponse"]>(
    `/api/v1/help/articles/${encodeURIComponent(slug)}`,
    { query: { audience: VENDOR_AUDIENCE } },
  ).then((response) => response.article);
}

/** Ask the AI help assistant, with up to 12 earlier turns of context. */
export function askHelpAssistant(question: string, history: HelpAskMessage[]): Promise<HelpAskResponse> {
  return platformRequest<HelpAskResponse>("/api/v1/help/ask", {
    method: "POST",
    body: { question, audience: VENDOR_AUDIENCE, history },
  });
}

/** The caller's chat threads — the Help page's Messages tab shows all of them, support included. */
export function fetchConversations(): Promise<ConversationRow[]> {
  return platformRequest<components["schemas"]["ConversationsListResponse"]>("/api/v1/chat/conversations").then(
    (response) => response.conversations,
  );
}

export function fetchConversation(conversationId: string): Promise<ConversationRow> {
  return platformRequest<components["schemas"]["ConversationDetailResponse"]>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}`,
  ).then((response) => response.conversation);
}

export function fetchMessages(conversationId: string): Promise<MessageRow[]> {
  return platformRequest<components["schemas"]["MessagesListResponse"]>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
  ).then((response) => response.messages);
}

export function sendMessage(conversationId: string, body: string): Promise<MessageRow> {
  return platformRequest<components["schemas"]["MessageCreateResponse"]>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "POST", body: { body } },
  ).then((response) => response.message);
}

export function markConversationRead(conversationId: string): Promise<void> {
  return platformRequest<void>(`/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: "POST",
  });
}

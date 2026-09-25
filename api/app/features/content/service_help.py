"""Help Center use cases: browse categories and articles for your portal, and ask the AI assistant.

Clients and vendors see their own portal's articles plus shared (`both`) ones.
Staff see admin articles, and may preview a client or vendor portal for QA.
"""

from __future__ import annotations

from app.core.auth import Principal
from app.core.errors import AppError
from app.core.logging import get_logger
from app.core.ports import LanguageModel
from app.features.content import repository
from app.features.content.domain_help import (
    HELP_MODEL,
    AssistantReply,
    ConversationTurn,
    assistant_messages,
    audience_values,
    finish_reply,
    resolve_audience,
    retrieve_articles,
)
from app.features.content.errors import ArticleNotFound, AssistantUnavailable, QuestionRequired
from app.features.content.models import HelpCategoryName
from app.features.content.schemas import (
    HelpArticleDetail,
    HelpArticleListItem,
    HelpAskRequest,
    HelpAskResponse,
    HelpCategoryOut,
    HelpRelatedArticle,
)

log = get_logger(__name__)


def list_categories(principal: Principal, requested_audience: str | None) -> list[HelpCategoryOut]:
    """The published categories for the caller's portal, each with its article count."""
    audiences = audience_values(resolve_audience(principal.user_type, requested_audience))
    categories = repository.list_published_categories(audiences)
    article_counts: dict[str, int] = {}
    for category_id in repository.published_article_category_ids(audiences):
        article_counts[category_id] = article_counts.get(category_id, 0) + 1
    return [
        HelpCategoryOut(**category.model_dump(), article_count=article_counts.get(category.id, 0))
        for category in categories
    ]


def list_articles(
    principal: Principal, requested_audience: str | None, category_slug: str | None
) -> list[HelpArticleListItem]:
    """The published articles for the caller's portal, optionally only one category's.

    An unknown (or unpublished) category slug gives an empty list, not an error.
    """
    audiences = audience_values(resolve_audience(principal.user_type, requested_audience))
    chosen_category: HelpCategoryName | None = None
    if category_slug:
        chosen_category = repository.find_published_category(category_slug)
        if chosen_category is None:
            return []
    articles = repository.list_published_articles(audiences, chosen_category.id if chosen_category else None)
    categories_by_id = (
        {chosen_category.id: chosen_category}
        if chosen_category
        else {category.id: category for category in repository.list_published_category_names()}
    )
    items: list[HelpArticleListItem] = []
    for article in articles:
        category = categories_by_id.get(article.category_id)
        items.append(
            HelpArticleListItem(
                id=article.id,
                slug=article.slug,
                title=article.title,
                summary=article.summary,
                audience=article.audience,
                category_id=article.category_id,
                category_slug=category.slug if category else None,
                category_title=category.title if category else None,
                sort_order=article.sort_order,
            )
        )
    return items


def get_article(principal: Principal, requested_audience: str | None, slug: str) -> HelpArticleDetail:
    """One published article for the caller's portal, with its category and "see also" links."""
    audiences = audience_values(resolve_audience(principal.user_type, requested_audience))
    article = repository.find_published_article(slug, audiences)
    if article is None:
        raise ArticleNotFound()
    category = repository.find_category_name(article.category_id)
    related_slugs = [related_slug for related_slug in article.related_slugs if related_slug]
    titles = repository.published_titles_by_slug(related_slugs) if related_slugs else {}
    return HelpArticleDetail(
        id=article.id,
        slug=article.slug,
        title=article.title,
        summary=article.summary,
        audience=article.audience,
        category_id=article.category_id,
        category_slug=category.slug if category else None,
        category_title=category.title if category else None,
        sort_order=article.sort_order,
        body_md=article.body_md,
        related_slugs=related_slugs,
        related_articles=[
            HelpRelatedArticle(slug=related_slug, title=titles.get(related_slug) or related_slug)
            for related_slug in related_slugs
        ],
    )


def ask_assistant(
    principal: Principal, request: HelpAskRequest, language_model: LanguageModel
) -> HelpAskResponse:
    """Answer a question from the caller's portal's articles only.

    The best-matching articles are sent with the question; the reply may only
    link articles the caller can read. Model outages raise their own port errors;
    anything else unexpected becomes `AssistantUnavailable`.
    """
    audience = resolve_audience(principal.user_type, request.audience)
    if not request.question.strip():
        raise QuestionRequired()
    try:
        pool = repository.list_article_texts(audience_values(audience))
        history = [ConversationTurn(role=turn.message_role, content=turn.content) for turn in request.history]
        messages = assistant_messages(
            question=request.question,
            audience=audience,
            history=history,
            articles=retrieve_articles(request.question, pool),
        )
        reply = language_model.parse(
            model=HELP_MODEL, messages=messages, reply_model=AssistantReply, purpose="help_assistant"
        )
        finished = finish_reply(reply, {article.slug for article in pool})
    except AppError as error:
        log.warning("help_ask: %s audience=%s detail=%s", error.status, audience, error.message)
        raise
    except Exception as error:
        log.exception("help_ask: unexpected failure audience=%s", audience)
        raise AssistantUnavailable() from error
    return HelpAskResponse(**finished.model_dump())

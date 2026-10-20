"""Public blog, Help Center and client/vendor contact routes: parse, call one service, return a schema."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import AUTH_ERRORS, ROLE_ERRORS, CurrentClient, CurrentUser, CurrentVendor
from app.core.db import SessionDep
from app.core.errors import AppError, error_responses
from app.core.pagination import DEFAULT_LIST_LIMIT
from app.core.ports import (
    LanguageModelDependency,
    LanguageModelEmptyReply,
    LanguageModelFailed,
    LanguageModelRefused,
    LanguageModelUnavailable,
    MailerDependency,
    WebhooksDependency,
)
from app.features.content import service_blog, service_contact, service_help
from app.features.content.errors import (
    ArticleNotFound,
    AssistantUnavailable,
    AudienceMismatch,
    BookingNotFound,
    BookingNotOnAccount,
    InvalidBookingReference,
    MessageTooShort,
    PostNotFound,
    QuestionRequired,
)
from app.features.content.schemas import (
    BlogPostPublicDetailResponse,
    BlogPostsListResponse,
    ContactSubmitBody,
    ContactSubmitResponse,
    HelpArticleResponse,
    HelpArticlesResponse,
    HelpAskRequest,
    HelpAskResponse,
    HelpCategoriesResponse,
)

router = APIRouter()


# Errors every Help Center route can return: not signed in, or another portal's audience.
_HELP_ERRORS = (*AUTH_ERRORS, AudienceMismatch)
# Errors both contact forms can return besides auth.
_CONTACT_ERRORS = (
    *ROLE_ERRORS,
    MessageTooShort,
    InvalidBookingReference,
    BookingNotFound,
    BookingNotOnAccount,
)


# --- public blog ------------------------------------------------------------------------------------


@router.get(
    "/blog/posts", tags=["blog"], response_model=BlogPostsListResponse, responses=error_responses(AppError)
)
async def list_blog_posts(
    session: SessionDep, limit: int = Query(DEFAULT_LIST_LIMIT, ge=1, le=100)
) -> BlogPostsListResponse:
    """The public blog index, newest first."""
    return BlogPostsListResponse(posts=await service_blog.list_published_posts(session, limit))


@router.get(
    "/blog/posts/{slug}",
    tags=["blog"],
    response_model=BlogPostPublicDetailResponse,
    responses=error_responses(PostNotFound),
)
async def get_blog_post(session: SessionDep, slug: str) -> BlogPostPublicDetailResponse:
    """One published post by slug."""
    return BlogPostPublicDetailResponse(post=await service_blog.get_published_post(session, slug))


# --- help center -------------------------------------------------------------------------------------


@router.get(
    "/help/categories",
    tags=["help"],
    response_model=HelpCategoriesResponse,
    responses=error_responses(*_HELP_ERRORS),
)
async def list_help_categories(
    session: SessionDep, principal: CurrentUser, audience: str | None = Query(None)
) -> HelpCategoriesResponse:
    """The Help Center categories for the caller's portal."""
    return HelpCategoriesResponse(categories=await service_help.list_categories(session, principal, audience))


@router.get(
    "/help/articles",
    tags=["help"],
    response_model=HelpArticlesResponse,
    responses=error_responses(*_HELP_ERRORS),
)
async def list_help_articles(
    session: SessionDep,
    principal: CurrentUser,
    audience: str | None = Query(None),
    category: str | None = Query(None, description="Category slug"),
) -> HelpArticlesResponse:
    """The Help Center articles for the caller's portal, optionally one category's."""
    return HelpArticlesResponse(
        articles=await service_help.list_articles(session, principal, audience, category)
    )


@router.get(
    "/help/articles/{slug}",
    tags=["help"],
    response_model=HelpArticleResponse,
    responses=error_responses(*_HELP_ERRORS, ArticleNotFound),
)
async def get_help_article(
    session: SessionDep, principal: CurrentUser, slug: str, audience: str | None = Query(None)
) -> HelpArticleResponse:
    """One Help Center article."""
    return HelpArticleResponse(article=await service_help.get_article(session, principal, audience, slug))


@router.post(
    "/help/ask",
    tags=["help"],
    response_model=HelpAskResponse,
    responses=error_responses(
        *_HELP_ERRORS,
        QuestionRequired,
        AssistantUnavailable,
        LanguageModelUnavailable,
        LanguageModelFailed,
        LanguageModelEmptyReply,
        LanguageModelRefused,
    ),
)
async def ask_help_assistant(
    session: SessionDep, principal: CurrentUser, body: HelpAskRequest, language_model: LanguageModelDependency
) -> HelpAskResponse:
    """Ask the AI help assistant a question, answered from the caller's portal's articles."""
    return await service_help.ask_assistant(session, principal, body, language_model)


# --- contact ---------------------------------------------------------------------------------------------


@router.post(
    "/client/contact",
    tags=["client"],
    response_model=ContactSubmitResponse,
    responses=error_responses(*_CONTACT_ERRORS),
)
async def submit_client_contact(
    session: SessionDep,
    principal: CurrentClient,
    body: ContactSubmitBody,
    language_model: LanguageModelDependency,
    mailer: MailerDependency,
    webhooks: WebhooksDependency,
) -> ContactSubmitResponse:
    """A client's message to the Eventtz team."""
    await service_contact.submit_portal_message(
        session,
        principal,
        portal="client",
        message=body.message,
        raw_booking_id=body.booking_id,
        language_model=language_model,
        mailer=mailer,
        webhooks=webhooks,
    )
    return ContactSubmitResponse()


@router.post(
    "/vendor/contact",
    tags=["vendor"],
    response_model=ContactSubmitResponse,
    responses=error_responses(*_CONTACT_ERRORS),
)
async def submit_vendor_contact(
    session: SessionDep,
    principal: CurrentVendor,
    body: ContactSubmitBody,
    language_model: LanguageModelDependency,
    mailer: MailerDependency,
    webhooks: WebhooksDependency,
) -> ContactSubmitResponse:
    """A vendor's message to the Eventtz team."""
    await service_contact.submit_portal_message(
        session,
        principal,
        portal="vendor",
        message=body.message,
        raw_booking_id=body.booking_id,
        language_model=language_model,
        mailer=mailer,
        webhooks=webhooks,
    )
    return ContactSubmitResponse()

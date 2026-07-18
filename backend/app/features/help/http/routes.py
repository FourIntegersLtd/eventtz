"""Help Center HTTP API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.contracts.help import (
    HelpArticleDetail,
    HelpArticleListItem,
    HelpArticleResponse,
    HelpArticlesResponse,
    HelpAskRequest,
    HelpAskResponse,
    HelpCategoriesResponse,
    HelpCategoryOut,
)
from app.core.logging import get_logger
from app.features.auth.http.guards import require_user
from app.features.help import queries
from app.features.help.assistant import ask_help

logger = get_logger(__name__)
router = APIRouter(prefix="/help", tags=["help"])


def _resolve_audience(user: dict, requested: str | None) -> str:
    ut = str(user.get("user_type") or "")
    if ut == "admin":
        # Admins default to admin docs; may also preview client/vendor for QA.
        if requested in ("client", "vendor", "admin"):
            return requested
        return "admin"
    if ut not in ("client", "vendor"):
        raise HTTPException(status_code=403, detail="Help Center is for signed-in portal users.")
    if requested and requested != ut:
        raise HTTPException(status_code=403, detail="Audience must match your account type.")
    return ut


@router.get("/categories", response_model=HelpCategoriesResponse)
def get_help_categories(
    request: Request,
    response: Response,
    audience: str | None = Query(None),
) -> HelpCategoriesResponse:
    user = require_user(request, response)
    aud = _resolve_audience(user, audience)
    rows = queries.list_categories(audience=aud)
    return HelpCategoriesResponse(
        categories=[HelpCategoryOut.model_validate(r) for r in rows],
    )


@router.get("/articles", response_model=HelpArticlesResponse)
def get_help_articles(
    request: Request,
    response: Response,
    audience: str | None = Query(None),
    category: str | None = Query(None, description="Category slug"),
) -> HelpArticlesResponse:
    user = require_user(request, response)
    aud = _resolve_audience(user, audience)
    rows = queries.list_articles(audience=aud, category_slug=category)
    return HelpArticlesResponse(
        articles=[HelpArticleListItem.model_validate(r) for r in rows],
    )


@router.get("/articles/{slug}", response_model=HelpArticleResponse)
def get_help_article(
    slug: str,
    request: Request,
    response: Response,
    audience: str | None = Query(None),
) -> HelpArticleResponse:
    user = require_user(request, response)
    aud = _resolve_audience(user, audience)
    row = queries.get_article_by_slug(slug=slug, audience=aud)
    if not row:
        raise HTTPException(status_code=404, detail="Article not found.")
    return HelpArticleResponse(article=HelpArticleDetail.model_validate(row))


@router.post("/ask", response_model=HelpAskResponse)
def post_help_ask(
    body: HelpAskRequest,
    request: Request,
    response: Response,
) -> HelpAskResponse:
    user = require_user(request, response)
    aud = _resolve_audience(user, body.audience)
    q = (body.question or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="Question is required.")
    try:
        return ask_help(question=q, audience=aud, history=body.history)
    except HTTPException as e:
        logger.warning(
            "help_ask: HTTP %s audience=%s detail=%s",
            e.status_code,
            aud,
            e.detail,
        )
        raise
    except Exception as e:
        logger.exception(
            "help_ask: unexpected failure audience=%s q_len=%s history=%s",
            aud,
            len(q),
            len(body.history or []),
        )
        raise HTTPException(
            status_code=503,
            detail="The help assistant is unavailable right now. Please try again later.",
        ) from e

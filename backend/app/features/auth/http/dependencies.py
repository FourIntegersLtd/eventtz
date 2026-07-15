"""
Per-request wiring for auth routes.

`SupabaseAuthServiceDep` builds a `SupabaseAuthService` using a dedicated
auth-only Supabase client (not the full-access client used for storage).

Add a separate `get_supabase_client` helper only when a route needs the raw
Supabase `Client` without going through a service.
"""

from typing import Annotated, Any

from fastapi import Depends, Request, Response

from app.features.auth.http.guards import require_user, require_vendor
from app.features.auth.supabase import SupabaseAuthService
from app.core.db import get_supabase_auth_client


def get_supabase_auth_service() -> SupabaseAuthService:
    """Auth service for this request, using the auth-only Supabase client."""
    return SupabaseAuthService(get_supabase_auth_client())


SupabaseAuthServiceDep = Annotated[
    SupabaseAuthService,
    Depends(get_supabase_auth_service),
]


def get_current_user_dep(request: Request, response: Response) -> dict[str, Any]:
    return require_user(request, response)


def require_vendor_dep(request: Request, response: Response) -> dict[str, Any]:
    return require_vendor(request, response)

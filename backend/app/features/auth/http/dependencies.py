"""
FastAPI dependency injection ("Depends").

`SupabaseAuthServiceDep` → one dependency: build `SupabaseAuthService` using a
dedicated auth Supabase client (not the service-role singleton used for Storage).

You only need a separate `get_supabase_client` dependency if a route must use
the raw Supabase `Client` without going through a service.
"""

from typing import Annotated, Any

from fastapi import Depends, Request, Response

from app.features.auth.http.guards import require_user, require_vendor
from app.features.auth.supabase import SupabaseAuthService
from app.core.db import get_supabase_auth_client


def get_supabase_auth_service() -> SupabaseAuthService:
    """Auth service for this request, backed by the auth-only Supabase client."""
    return SupabaseAuthService(get_supabase_auth_client())


SupabaseAuthServiceDep = Annotated[
    SupabaseAuthService,
    Depends(get_supabase_auth_service),
]


def get_current_user_dep(request: Request, response: Response) -> dict[str, Any]:
    return require_user(request, response)


def require_vendor_dep(request: Request, response: Response) -> dict[str, Any]:
    return require_vendor(request, response)

"""Admin console: financials summary and CSV export."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.features.auth.http.guards import require_admin, require_super_admin
from app.contracts.admin import AdminFinancialsSummary
from app.features.admin.audit import insert_admin_audit_log
from app.features.admin import financials_export_csv_bytes, get_financials_summary

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/financials/summary", response_model=AdminFinancialsSummary)
def admin_financials_summary(
    request: Request,
    response: Response,
    date_from: str | None = None,
    date_to: str | None = None,
) -> AdminFinancialsSummary:
    require_admin(request, response)
    data = get_financials_summary(date_from, date_to)
    return AdminFinancialsSummary(**data)


@router.get("/financials/export.csv")
def admin_financials_export(
    request: Request,
    response: Response,
    date_from: str | None = None,
    date_to: str | None = None,
) -> Response:
    user = require_super_admin(request, response)
    insert_admin_audit_log(
        admin_user_id=str(user.get("id") or ""),
        action="financials.export_csv",
        entity_type="financials",
        entity_id=None,
        payload={"date_from": date_from, "date_to": date_to},
    )
    raw = financials_export_csv_bytes(date_from, date_to)
    return Response(
        content=raw,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="eventtz-financials.csv"',
        },
    )

"""Use cases for the admin financials screen: the summary and the CSV export.

Both read the same page of paid bookings (`repository_admin.paid_bookings_for_financials`),
price each one with the pricing slice, and total them with the pure maths in
`domain_financials.py`. The CSV export additionally writes an audit row, since it lets
a super admin pull raw figures off the platform.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.time import uk_day_key, uk_today
from app.features.bookings import repository_admin, service_pricing
from app.features.bookings.domain_financials import (
    CSV_HEADER,
    PaidBookingFinancials,
    gbp_from_pence,
    pence_from_gbp,
    summarize,
)
from app.features.bookings.rows import BookingRow
from app.features.bookings.schemas_admin import (
    AdminFinancialsDailyBucket,
    AdminFinancialsDailyListResponse,
    AdminFinancialsSummary,
)
from app.features.pricing.service import BOOKING_SERVICE_FEE_PERCENT
from app.features.staff import service as staff_service

# Re-exported so `router_admin.py` can import this schema from this one module: the
# router-thin guard only lets a router reach a sibling module named `schemas`/`errors` or one
# starting with `service`, and `schemas_admin` matches neither (see `vendors/service_ai.py`
# for the same pattern).
__all__ = [
    "AdminFinancialsDailyListResponse",
    "AdminFinancialsSummary",
    "CSV_CONTENT_TYPE",
    "CSV_FILENAME",
    "financials_daily_page",
    "financials_export_csv",
    "financials_summary",
]

# Financials CSV attachment, verbatim from the baseline.
CSV_CONTENT_TYPE = "text/csv; charset=utf-8"
CSV_FILENAME = 'attachment; filename="eventtz-financials.csv"'


def _paid_at_iso(booking: BookingRow) -> str | None:
    """`paid_at` as the ISO string the baseline's CSV and audit copy show."""
    return booking.paid_at


async def _financials_rows(
    session: AsyncSession,
    *,
    date_from: str | None,
    date_to: str | None,
    only_days: tuple[date, date] | None = None,
) -> list[tuple[BookingRow, PaidBookingFinancials]]:
    """Every paid booking in range, paired with its priced financials (breakdown recomputed fresh).

    `only_days` (first day, last day) narrows the read to those London days, so the daily table
    prices one page of days rather than every paid booking.
    """
    bookings = await repository_admin.paid_bookings_for_financials(
        session,
        date_from=date_from,
        date_to=date_to,
        paid_on_or_after=only_days[0] if only_days else None,
        paid_on_or_before=only_days[1] if only_days else None,
    )
    if not bookings:
        return []
    owners = await service_pricing.code_owners_for(session, bookings)
    paired: list[tuple[BookingRow, PaidBookingFinancials]] = []
    for booking in bookings:
        breakdown = service_pricing.breakdown_for(booking, owners)
        paired.append(
            (
                booking,
                PaidBookingFinancials(
                    booking_id=booking.id,
                    status=booking.status,
                    payment_status=booking.payment_status,
                    breakdown_client_total_pence=pence_from_gbp(breakdown.client_total_gbp),
                    breakdown_vendor_portion_pence=pence_from_gbp(breakdown.vendor_portion_gbp),
                    breakdown_service_fee_pence=pence_from_gbp(breakdown.service_fee_gbp),
                    payment_amount_snapshot_pence=(
                        pence_from_gbp(booking.payment_amount_gbp)
                        if booking.payment_amount_gbp is not None
                        else None
                    ),
                    vendor_amount_snapshot_pence=(
                        pence_from_gbp(booking.vendor_amount_gbp)
                        if booking.vendor_amount_gbp is not None
                        else None
                    ),
                    platform_fee_snapshot_pence=(
                        pence_from_gbp(booking.platform_fee_gbp)
                        if booking.platform_fee_gbp is not None
                        else None
                    ),
                    cancellation_share_pence=pence_from_gbp(booking.cancellation_vendor_share_gbp),
                    cancellation_share_sent=booking.cancellation_payout_at is not None,
                ),
            )
        )
    return paired


@dataclass
class _DailyPenceTotals:
    """One day's running totals while `_daily_buckets` walks the paid bookings, in pence."""

    date: str
    count: int = field(default=0)
    gmv_pence: int = field(default=0)
    fee_pence: int = field(default=0)
    vendor_pence: int = field(default=0)


def _daily_window(
    date_from: str | None, date_to: str | None, now: datetime | None = None
) -> tuple[date, date]:
    """First and last day of the daily table (default: the 30 days up to today, capped at 366 days).

    Mirrors the baseline's `_financials_chart_range`.
    """
    today = uk_today(now)
    start = date_from and date_from[:10]
    end = date_to and date_to[:10]
    # Default window is the 30 days up to today (29 days back), baseline parity.
    start_date = datetime.fromisoformat(start).date() if start else today - timedelta(days=29)
    end_date = datetime.fromisoformat(end).date() if end else today
    if start_date > end_date:
        start_date, end_date = end_date, start_date
    if (end_date - start_date).days > 366:
        start_date = end_date - timedelta(days=366)
    return start_date, end_date


def _daily_buckets(
    rows: list[tuple[BookingRow, PaidBookingFinancials]], *, first_day: date, last_day: date
) -> list[AdminFinancialsDailyBucket]:
    """Every day from `first_day` to `last_day`, zero-filled, with the paid bookings of each day."""
    buckets: dict[str, _DailyPenceTotals] = {}
    day = first_day
    while day <= last_day:
        buckets[day.isoformat()] = _DailyPenceTotals(date=day.isoformat())
        day += timedelta(days=1)

    for booking, financials in rows:
        paid_at = _paid_at_iso(booking)
        bucket_day = uk_day_key(paid_at)
        if bucket_day is None or bucket_day not in buckets:
            continue
        bucket = buckets[bucket_day]
        bucket.count += 1
        bucket.gmv_pence += financials.gmv_pence
        bucket.fee_pence += financials.platform_fee_pence
        bucket.vendor_pence += financials.breakdown_vendor_portion_pence

    return [
        AdminFinancialsDailyBucket(
            date=bucket.date,
            count=bucket.count,
            gmv_gbp=gbp_from_pence(bucket.gmv_pence),
            platform_fee_gbp=gbp_from_pence(bucket.fee_pence),
            vendor_portion_gbp=gbp_from_pence(bucket.vendor_pence),
        )
        for bucket in (buckets[key] for key in sorted(buckets))
    ]


async def financials_daily_page(
    session: AsyncSession,
    *,
    date_from: str | None,
    date_to: str | None,
    offset: int,
    limit: int,
) -> AdminFinancialsDailyListResponse:
    """One page of daily financial buckets for the admin table (charts use the full summary).

    The days are a fixed calendar window, so the page's days are picked first and only the paid
    bookings of those days are read and priced.
    """
    first_day, last_day = _daily_window(date_from, date_to)
    total = (last_day - first_day).days + 1
    if offset >= total:
        return AdminFinancialsDailyListResponse(daily=[], total=total, offset=offset, limit=limit)
    page_first = first_day + timedelta(days=offset)
    page_last = min(last_day, page_first + timedelta(days=limit - 1))
    rows = await _financials_rows(
        session, date_from=date_from, date_to=date_to, only_days=(page_first, page_last)
    )
    page = _daily_buckets(rows, first_day=page_first, last_day=page_last)
    return AdminFinancialsDailyListResponse(daily=page, total=total, offset=offset, limit=limit)


async def financials_summary(
    session: AsyncSession, *, date_from: str | None, date_to: str | None
) -> AdminFinancialsSummary:
    """Totals for the admin financials screen, over an optional `paid_at` date range."""
    rows = await _financials_rows(session, date_from=date_from, date_to=date_to)
    summary = summarize([financials for _booking, financials in rows])
    summary_first_day, summary_last_day = _daily_window(date_from, date_to)
    return AdminFinancialsSummary(
        period_from=date_from,
        period_to=date_to,
        paid_booking_count=summary.paid_booking_count,
        gmv_gbp=gbp_from_pence(summary.gmv_pence),
        platform_fee_gbp=gbp_from_pence(summary.platform_fee_pence),
        vendor_portion_gbp=gbp_from_pence(summary.vendor_portion_pence),
        service_fee_percent=BOOKING_SERVICE_FEE_PERCENT,
        payout_released_gbp=gbp_from_pence(summary.payout_released_pence),
        held_in_platform_balance_gbp=gbp_from_pence(summary.held_in_platform_balance_pence),
        daily=_daily_buckets(rows, first_day=summary_first_day, last_day=summary_last_day),
    )


async def financials_export_csv(
    session: AsyncSession, staff: Principal, *, date_from: str | None, date_to: str | None
) -> bytes:
    """The financials CSV, encoded as UTF-8 bytes; writes a `financials.export_csv` audit row.

    Columns and ordering are `domain_financials.CSV_HEADER`, verbatim from the baseline.
    """
    rows = await _financials_rows(session, date_from=date_from, date_to=date_to)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(CSV_HEADER)
    for booking, financials in rows:
        writer.writerow(
            [
                financials.booking_id,
                financials.status,
                financials.payment_status,
                booking.event_name,
                _paid_at_iso(booking) or "",
                gbp_from_pence(financials.breakdown_client_total_pence),
                gbp_from_pence(financials.breakdown_vendor_portion_pence),
                gbp_from_pence(financials.platform_fee_pence),
                gbp_from_pence(financials.payment_amount_snapshot_pence)
                if financials.payment_amount_snapshot_pence is not None
                else "",
                booking.payout_released_at or "",
            ]
        )
    await staff_service.record_admin_action(
        session,
        admin_user_id=staff.id,
        action="financials.export_csv",
        entity_type="financials",
        entity_id=None,
        details={"date_from": date_from, "date_to": date_to},
    )
    return buffer.getvalue().encode("utf-8")

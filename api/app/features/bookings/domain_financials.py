"""Pure money maths for the admin financials summary and CSV export: pence, no I/O.

Mirrors the baseline's `dashboard_queries.get_financials_summary`: the response's
`vendor_portion_gbp` is always the price breakdown's vendor portion (recomputed
from stored line items and adjustments, never the stored snapshot), while the
held/released split uses the stored `vendor_amount_gbp` snapshot when present
(falling back to the breakdown) because that is the amount an actual Stripe
transfer would pay.
"""

from __future__ import annotations

from dataclasses import dataclass

# Payment statuses the financials screen counts as "paid" (matches the baseline's
# `_PAID_PAYMENT_STATUSES`).
PAID_PAYMENT_STATUSES = ("paid", "payout_released", "partially_refunded")

# Exact disclaimer text the admin financials summary carries, verbatim from the baseline.
DISCLAIMER = (
    "Figures derive from stored line items and adjustments plus the configured service fee. "
    "Stripe settlement may differ until payment webhooks persist amounts."
)

# Header row of the financials CSV export, verbatim from the baseline.
CSV_HEADER = (
    "booking_id",
    "status",
    "payment_status",
    "event_name",
    "paid_at",
    "client_total_gbp",
    "vendor_portion_gbp",
    "service_fee_gbp",
    "payment_amount_gbp",
    "payout_released_at",
)


def pence_from_gbp(amount: float | None) -> int:
    """Round a GBP float to the nearest penny; `None` counts as zero."""
    return round((amount or 0.0) * 100)


def gbp_from_pence(amount_pence: int) -> float:
    """Pence back to a GBP float, rounded to the penny for display."""
    return round(amount_pence / 100.0, 2)


@dataclass(frozen=True)
class PaidBookingFinancials:
    """One paid booking's numbers for the financials summary, everything in pence."""

    booking_id: str
    status: str
    payment_status: str
    breakdown_client_total_pence: int
    breakdown_vendor_portion_pence: int
    breakdown_service_fee_pence: int
    payment_amount_snapshot_pence: int | None
    vendor_amount_snapshot_pence: int | None
    platform_fee_snapshot_pence: int | None

    @property
    def gmv_pence(self) -> int:
        """Gross merchandise value: the stored payment amount if we have it, else the priced breakdown."""
        if self.payment_amount_snapshot_pence is not None:
            return self.payment_amount_snapshot_pence
        return self.breakdown_client_total_pence

    @property
    def platform_fee_pence(self) -> int:
        """Eventtz's service fee: the stored snapshot if we have it, else the priced breakdown."""
        if self.platform_fee_snapshot_pence is not None:
            return self.platform_fee_snapshot_pence
        return self.breakdown_service_fee_pence

    @property
    def vendor_amount_pence(self) -> int:
        """What Stripe would pay (or has paid) the vendor: the stored snapshot, else the breakdown."""
        if self.vendor_amount_snapshot_pence is not None:
            return self.vendor_amount_snapshot_pence
        return self.breakdown_vendor_portion_pence

    @property
    def held_pence(self) -> int:
        """Still sitting in the platform's Stripe balance: paid, but payout not yet released."""
        return self.vendor_amount_pence if self.payment_status == "paid" else 0

    @property
    def released_pence(self) -> int:
        """Already transferred to the vendor."""
        return self.vendor_amount_pence if self.payment_status == "payout_released" else 0


@dataclass(frozen=True)
class FinancialsSummary:
    """The totals the admin financials screen shows, in pence."""

    paid_booking_count: int
    gmv_pence: int
    platform_fee_pence: int
    vendor_portion_pence: int
    payout_released_pence: int
    held_in_platform_balance_pence: int


def summarize(rows: list[PaidBookingFinancials]) -> FinancialsSummary:
    """Total a page of paid bookings into the summary the admin screen shows."""
    return FinancialsSummary(
        paid_booking_count=len(rows),
        gmv_pence=sum(row.gmv_pence for row in rows),
        platform_fee_pence=sum(row.platform_fee_pence for row in rows),
        vendor_portion_pence=sum(row.breakdown_vendor_portion_pence for row in rows),
        payout_released_pence=sum(row.released_pence for row in rows),
        held_in_platform_balance_pence=sum(row.held_pence for row in rows),
    )

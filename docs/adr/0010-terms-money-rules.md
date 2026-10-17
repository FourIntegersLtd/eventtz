# 0010 — Booking terms are snapshotted at checkout; payouts split, deposits ride in the same charge

Status: accepted (2026-10-17).
Source: `docs/plans/terms-remediation-2026-10-17.md` (Phases 2 and 3), Terms of Service 2026-11-01.

## Decision
- **Snapshot at checkout.** `start_checkout` copies the vendor's terms onto the booking with
  `domain_policy.checkout_terms_columns`: `report_window_hours`, `payout_upfront_percent`,
  `delivery_deadline_days`, `damage_deposit_gbp` (and, from 0006, `cancellation_policy`). The client
  is held to what they saw when they paid, whatever the vendor edits later. A NULL column means the
  booking predates the rule and follows the old behaviour.
- **Payment deadline (2.1).** An accepted, unpaid booking must be paid by the earlier of
  `booking_payment_deadline_hours` after acceptance and 48 hours before the event (the event start if
  accepted inside those 48 hours). The hourly job cancels it (`cancelled_by = system`,
  `failure_reason = PAYMENT_DEADLINE`) rather than declining it: `declined` means the vendor said no.
  Bookings accepted before `terms_version` have no deadline.
- **Reporting window by category (3.2).** Rentals and decor get 96 hours; everyone else keeps
  `booking_payout_auto_release_hours_after_event` (48). The longest window among the vendor's
  categories wins.
- **Split payout for photography (3.1).** No new `payment_status`. The first Transfer (part
  `upfront`, idempotency key `{id}-upfront`) moves `status` to `completed` and stamps
  `upfront_payout_at`; `payment_status` stays `paid`, so disputes and refunds keep working. The
  second Transfer pays the remainder and sets `payout_released` when the client confirms delivery or
  `delivery_deadline_days` pass with no dispute. `payout_stage` is derived, never stored. Staff
  release pays everything left in one go. A full refund after the first part returns only what is
  still held.
- **Damage deposit (3.5), deviation from the plan.** The plan proposed a separate manual-capture
  PaymentIntent. Manual-capture authorisations expire after 7 days, which is shorter than the gap
  between paying and most events, so the deposit is added to the same Checkout charge instead and
  held like the rest of the money. It is returned by a Refund (key `refund-{id}-deposit`) once
  `DEPOSIT_CLAIM_DAYS` after the event pass with no claim. A vendor claim pauses that; a super admin
  decides the award, paid as a Transfer (part `deposit`) with the remainder refunded
  (`refund-{id}-deposit-remainder`).
- **Rescheduling (3.3).** Either side proposes new dates on an accepted booking; the other accepts or
  declines. Accepting moves the dates only: price, payment and every snapshot stay. The capacity
  trigger has the last word.
- **Vendor record (2.3, 3.4).** Vendor cancellations of paid bookings are counted; two in 180 days
  flag the vendor for staff review. Staff can warn or pause a listing (the pause is applied in the
  visibility helpers). No fines, as the plan advised.

## Consequences
- Every number that the Terms quote lives once in `web/lib/policyConstants.json` and once in the
  api (`domain_policy`, `domain_profile_form`, settings); `tests/unit/test_policy_constants.py`
  fails if they drift. Help Centre articles (0008) copy the numbers by hand.
- A two-sided notice needs a separate kind per side (`vendor_*`): `booking_notifications` is unique
  on `(booking_id, kind)`.

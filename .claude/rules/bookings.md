---
paths:
  - "api/app/features/{bookings,disputes,reviews}/**"
  - "api/tests/**/test_{bookings_,disputes_,review_,reviews_,booking_}*.py"
  - "acceptance/test_{bookings_,disputes,reviews}*.py"
  - "web/app/{client,vendor}/(portal)/{bookings,disputes}/**"
  - "web/app/admin/(portal)/{bookings,trust}/**"
  - "web/features/{bookings,disputes,reviews}/**"
  - "web/features/{client,vendor}/bookings/**"
  - "web/features/vendor/quotes/**"
  - "web/features/admin/{bookings,disputes,reviews}/**"
---
# Bookings: what to know

Owner: `bookings-owner` (the money files of `bookings/` are `money-owner`'s: see `.claude/OWNERS.md`).
Proof: `verify-bookings`. Reviews: `quality-reviewer` always; `reviewer` (opus) when a change touches
cancellation, disputes blocking payouts, deletion or visibility.

- **Two lifecycles.** `booking_requests.status` is the request; `payment_status` is money. Bookings
  never writes `payment_status`: only the payments slice does, with conditional `.eq("payment_status", expected)` writes.
- **Status machine.** `pending -> accepted|declined|cancelled`, `accepted -> cancelled|completed`.
  On a vendor-initiated quote the client accepts or declines and the vendor may only cancel; client-initiated is the reverse. Someone else's booking is 404, never 403.
- **Every state change is a conditional update** on the status the caller read; the race loser gets `booking_not_found`.
- **Prices never come from the client.** They come from `vendors.payload` or the vendor's own quote lines;
  `total_label` is re-derived whenever the price changes. Quote and adjustment bounds are in `docs/domain-rules.md`.
- **Daily capacity is a Postgres trigger** (migration 033, kept in Alembic `0002`) mapped to
  `vendor_full_on_date`. The Python check in `calendar.py` only gives the friendly error.
- **Vendor accept gate.** Needs a payout route (or `listing_override = visible`) and no unconfirmed
  client price adjustment. Declining an adjusted client booking returns it to `pending` and clears adjustments.
- **One notice per (booking, kind)** across users: a notice for both sides needs a `vendor_*` kind
  (migration 0007 check constraint plus `domain_booking_copy.py`), or the second insert is silently dropped.
- **Cancel is blocked** once completed, paid out, partly refunded, while a problem report is open, or on
  `support_hold`. `cancelled` + `partially_refunded` + `cancellation_refund_percent` is a finished tiered cancel (money-owner's split).
- **Terms are snapshotted at checkout** (ADR 0010): later profile edits never change a paid booking.
  Accepted + unpaid bookings expire by the payment deadline (`cancelled` by `system`, `PAYMENT_DEADLINE`).
- **Contact details** show only once the booking is paid and accepted or completed, following each party's
  sharing settings; a closed account's email is never shown.
- **Disputes block payouts.** One `open`/`under_review` dispute per booking (partial unique index; `has_active_dispute` is the friendly 409).
  Only a super admin sets `resolution_action`/`refund_amount_gbp`; money moves only when `status == "resolved"` exactly.
  Opening on another's booking is 403, listing it is empty: a kept baseline quirk.
- **Reviews:** one per booking (`booking_request_id` UNIQUE), only when `status = completed` (never checks
  `payment_status`), body 10+ chars after stripping, at most 5 image URLs, hidden reviews only in the admin list, every hide/unhide audited.
- **Web:** `web/` is the copied old frontend: change a screen only to fix it (`web/UI-CONVENTIONS.md`). Branch on error `code`, never message text.
- No em dashes in user-facing copy; no emails to real users without explicit OK.

## What a failure looks like here
- A booking write that skips the "status I read" condition, so two clicks both succeed or one overwrites a cancel.
- A price decline that restores the old total but leaves the vendor's booking looking unchanged.
- A declined date change that clears the proposal and leaves the requester's booking looking unchanged.
- Bookings code writing `payment_status`, or treating `status = completed` as proof the vendor was paid.
- A new notice kind for the second party that reuses the first party's kind (insert silently dropped).
- A price, total or discount taken from the request body instead of the stored price list or quote lines.
- A cancel, decline or dispute path that releases or keeps money while a dispute or `support_hold` is open.
- Capacity checked only in Python, or a baseline quirk (404/400/403 shape, 200 on a missing review) "fixed" and the freeze test edited to match.

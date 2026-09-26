# bookings

## Purpose

A booking is one client hiring one vendor for an event. It starts as a client's
request for some of the vendor's packages, or as a vendor's quote, and moves
`pending → accepted | declined | cancelled → completed`. This slice owns that
request lifecycle (`status`); the money lifecycle (`payment_status`) belongs to
payments, which is the only writer of it.

## Use cases

- As a **client**, I **request some of a vendor's packages for a date**, with
  notes that open a chat thread, so that the vendor can accept.
- As a **vendor**, I **send a client a priced quote**, from a chat thread or not,
  so that they can accept it and pay.
- As a **vendor**, I **accept or decline a request**, re-accept one I declined,
  **cancel an accepted booking**, or **withdraw my own quote**.
- As a **vendor**, I **add extras or discounts to a pending request**; the client
  then **accepts or declines the new price** (declining restores the original).
- As a **client**, I **accept or decline a vendor's quote** (giving the venue),
  and **cancel** a pending or accepted booking.
- As a **client**, I **set the venue of an accepted booking** before paying.
- As a **client or vendor**, I **list my bookings by bucket** (active, completed,
  closed, all) and **open one** with its price breakdown, the other party's
  contact details once paid, and the review.
- As a **client or vendor**, I **confirm the event went ahead** after its last
  day; the vendor is paid once both have confirmed.

## Invariants

- Prices come from the vendor's stored price list (`vendors.payload`) or the
  vendor's own quote lines, never from the client. Money maths is the pricing
  slice's; the stored `total_label` is re-derived whenever the price changes.
- Every state change is a conditional update on the status the caller read; the
  loser of a race gets `booking_not_found`, as the baseline answered.
- Daily capacity: the Python check gives the friendly message; the Postgres
  trigger from migration 033 (kept in Alembic `0002`) is the last word, mapped to
  `vendor_full_on_date`.
- Contact details (email, phone) show only once the booking is paid and accepted
  or completed, and follow each party's sharing settings. A closed account's
  email is never shown.
- A vendor must be able to receive payouts (or have a staff override) to accept.
- A booking cannot be cancelled once completed, paid out, partly refunded, or
  while a problem report is open.
- Every change notifies the other party (`notifications.service_booking`) and
  publishes `booking_changed` to both parties after commit.

## Routes

Client (`/client`): `GET /booking-requests`, `POST /booking-requests`,
`GET /booking-requests/{id}`, `PATCH /booking-requests/{id}/status`,
`POST /booking-requests/{id}/cancel`, `PATCH /booking-requests/{id}/venue`,
`POST /booking-requests/{id}/confirm-completion`.

Vendor (`/vendor`): `POST /booking-requests/vendor-quote`, `GET /booking-requests`,
`GET /booking-requests/{id}`, `PUT /booking-requests/{id}/adjustments`,
`PATCH /booking-requests/{id}/status`, `POST /booking-requests/{id}/confirm-completion`.

Admin (`/admin`): `GET /bookings`, `GET /bookings/{id}` (any staff member);
`PATCH /bookings/{id}/payment-fields`, `POST /bookings/{id}/reset-checkout`,
`PATCH /bookings/{id}/support-hold` (super admin only). `GET /financials/summary`
(any staff member) and `GET /financials/export.csv` (super admin only) total every
paid booking in an optional `paid_at` range; the export additionally writes a
`financials.export_csv` audit row. See `service_admin.py` and
`service_admin_financials.py`.

Differences from the baseline:
- Each rule has its own error `code`; statuses and messages are unchanged.
- An unexpected failure is a plain 500, not the baseline's "Could not save" text.
- The first response time and `vendor_notified_at` use the database clock.

## Deferred

These wait for the slices that own them; until then the api answers as noted.

- **Payments:** cancelling a booking that is mid-checkout or paid (close the
  Checkout Session, refund in full) is refused with `booking_cancel_needs_payments`
  (503). Releasing the payout once both parties confirm raises
  `booking_payout_release_unavailable` (503) after the confirmation is stored.
  Checkout, checkout sync, receipts, payout statements and payment records.
- **Admin recovery routes** (also payments): `POST /admin/bookings/{id}/sync-payment`,
  `POST /admin/bookings/{id}/release-payout`, `POST /admin/bookings/{id}/retry-payout`,
  `POST /admin/bookings/{id}/cancel-on-behalf`,
  `POST /admin/bookings/{id}/complete-cancellation`,
  `POST /admin/bookings/{id}/confirm-completion`, `POST /admin/run-maintenance`. The
  admin bookings console (list/detail/payment-fields/reset-checkout/support-hold) and
  the financials summary/export above are built; these seven are not yet.
- **Maintenance jobs** (procrastinate periodic tasks): automatic payout release
  after the event, completion and enquiry reminders, stale-enquiry marking, and
  the reminders the baseline also ran when the active list was opened.
- **Reviews and disputes:** their routes; this slice reads `booking_reviews` and
  `dispute_cases` through table handles in `repository.py` until then.

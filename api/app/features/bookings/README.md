# bookings

## Purpose

A booking is one client hiring one vendor for an event. It starts as a client's
request for some of the vendor's packages, or as a vendor's quote, and moves
`pending → accepted | declined | cancelled → completed`. This slice owns that
request lifecycle (`status`) and, in the `service_payments*.py` modules only, the
money lifecycle (`payment_status`): checkout, refunds and payouts. The payments
slice owns Stripe's side (webhooks, Connect) and calls these, never the reverse.

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
- As a **client or vendor**, I **cancel a paid booking**; the client is refunded
  in full first, and a checkout still open is closed so it cannot be paid.
- As a **client**, I **set the venue of an accepted booking** before paying.
- As a **client or vendor**, I **list my bookings by bucket** (active, completed,
  closed, all) and **open one** with its price breakdown, the other party's
  contact details once paid, and the review.
- As a **client or vendor**, I **confirm the event went ahead** after its last
  day; the vendor is paid once both have confirmed.
- As a **client**, I **pay an accepted booking** through Stripe Checkout; the
  booking is re-priced from the vendor's list first. After Stripe's redirect the
  page **syncs the payment** in case the webhook has not arrived.
- As **staff** (a dispute resolution or recovery), I **refund a paid booking** in
  full or in part, or **release the vendor's payout** without both confirmations.
- As **Stripe**, I **report a completed Checkout** (webhook); the booking is marked
  paid once, or the payment is refunded when the booking can no longer take it.

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
- `payment_status` (`unpaid → pending → paid → payout_released`, or `refunded` /
  `partially_refunded`) is written only by the `service_payments*.py` modules, and
  only with a condition on the payment status they expect.
- Checkout charges the server's own re-priced total (automatic discounts
  re-applied for the event date) into Eventtz's balance; the vendor is paid later
  by a Transfer. A completed session is marked paid only when the charged pence
  equal the total the server priced; a session for a booking no longer accepted,
  or one a newer checkout replaced, is refunded in full.
- Every Stripe refund carries an idempotency key `refund-{booking id}-{reason}`
  (`full`, `partial`, `cancel-client`, `cancel-vendor`, or a checkout reason), so a
  redelivered webhook or a retry never refunds twice.
- Money moves first, then the booking is written: a refund Stripe refuses stops
  the cancel (400 `refund_failed`, staff emailed). The vendor is paid only by a
  Transfer in group `booking_{id}`, funded from the client's charge; one already in
  that group is reused, and the key `transfer-{id}-{pence}-{account}[-src-{charge}]`
  guards a retry. A vendor Stripe cannot pay yet is told the payout is held and the
  booking stays paid. `completed` + `payout_released` is written only from
  `accepted` + `paid`.

## Routes

Client (`/client`): `GET /booking-requests`, `POST /booking-requests`,
`GET /booking-requests/{id}`, `PATCH /booking-requests/{id}/status`,
`POST /booking-requests/{id}/cancel`, `PATCH /booking-requests/{id}/venue`,
`POST /booking-requests/{id}/checkout`, `POST /booking-requests/{id}/checkout/sync`,
`POST /booking-requests/{id}/confirm-completion`.

Vendor (`/vendor`): `POST /booking-requests/vendor-quote`, `GET /booking-requests`,
`GET /booking-requests/{id}`, `PUT /booking-requests/{id}/adjustments`,
`PATCH /booking-requests/{id}/status`, `POST /booking-requests/{id}/confirm-completion`.

Differences from the baseline:
- Each rule has its own error `code`; statuses and messages are unchanged.
- An unexpected failure is a plain 500, not the baseline's "Could not save" text.
- The first response time and `vendor_notified_at` use the database clock.
- Checkout refusals keep the baseline's 400 (even "Booking not found."), each with
  its own `checkout_*` code. With no Stripe key, or when Stripe fails, checkout and
  its sync answer 503 (`payments_unavailable` / `payment_provider_error`) instead of
  the baseline's 500 "Could not start checkout" / "Could not confirm payment".
- A refusal after re-pricing (no event address) rolls back the refreshed line
  items; the baseline had already saved them. The next checkout re-prices anyway.
- A refund or payout refusal has its own code (`refund_only_paid`,
  `refund_no_payment_on_record`, `refund_failed`, `payout_only_paid`,
  `payout_amount_missing`, `payout_release_failed`), still 400 as the baseline's
  ValueErrors were. A vendor share under one penny is `payout_amount_missing`.
- A cancel that loses a race after its refund went through answers 404 as before,
  but keeps the refund recorded (the baseline did too, by never rolling back).

## Deferred

These wait for the slices that own them; until then the api answers as noted.

- **Payments:** receipts (the snapshot stored when a payment completes, and the
  receipt emails), payout statements and payment records. Checkout and its sync
  (`service_payments_checkout.py`), refunds and payouts (`service_payments.py`) are
  built.
- The vendor payout ledger (`service_payout_ledger.py`, `repository_payments.py`)
  is built; the payments slice serves it at `GET /vendor/payments/history`.
- **Maintenance jobs** (procrastinate periodic tasks): automatic payout release
  after the event, completion and enquiry reminders, stale-enquiry marking, and
  the reminders the baseline also ran when the active list was opened.
- **Reviews and disputes:** their routes; this slice reads `booking_reviews` and
  `dispute_cases` through table handles in `repository.py` until then.

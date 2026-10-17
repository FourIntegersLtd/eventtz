# disputes

## Purpose
A client or vendor opens a dispute on a booking when something goes wrong; staff triage,
assign, and resolve it, with the resolution optionally moving money (releasing the held
payout, refunding the client in full, or a partial refund).

## Use cases
- As a **client or vendor**, I **open a dispute on my own booking**, and it links my existing
  support/DM thread with the other party so staff can read the history.
- As a **client or vendor**, I **list and view my own disputes**; a dispute on someone else's
  booking simply isn't there.
- As **staff**, I **list disputes by status** ("open" also surfaces `under_review`).
- As **staff**, I **triage a dispute**: change its status, add internal notes, a resolution
  note, or assign it to another active admin.
- As a **super admin**, I **resolve a dispute with a financial outcome**
  (`release_to_vendor` / `refund_client` / `partial_refund`); a plain admin may not.
- As **staff**, I **get an ops alert email when a dispute is opened** (booking, dispute, who opened
  it, their summary); a send failure is only logged.

## Realtime
Opening a dispute publishes `dispute_changed` to both booking parties; a staff patch publishes it
to the baseline's recipients (a note-only patch wakes only the party whose note was set, every
other patch wakes both). Sent after commit via `publish_after_commit`, so a rejected request
sends nothing. The frontend listener is `web-new/lib/useRealtimeSse.ts`.

## Invariants
- Only one dispute may be `open` or `under_review` on a booking at a time (the database's
  own partial unique index enforces this; `has_active_dispute` checks it first for a
  friendly 409).
- A booking must be `pending`, `accepted`, or `completed` to have a new dispute opened on it.
- **BASELINE QUIRK**: opening a dispute on someone else's (existing) booking leaks its
  existence via 403 (`CannotOpenDispute`); listing or fetching a dispute detail instead
  hides it (an empty list, or a plain 404) — kept exactly as the baseline behaves.
- **BASELINE QUIRK**: the admin patch's own "not found" has two different shapes: a missing
  dispute id on a plain triage patch is a 404 ("Dispute not found"), but a missing id when
  the patch also carries a `resolution_action` is a 400 ("Dispute not found.", with a
  period) — the money branch looks the dispute up itself, before the general update.
- `resolved_at` is stamped whenever `status` moves to `resolved` **or** `closed`, but the
  money branch itself only runs when `status == "resolved"` exactly (a `resolution_action`
  sent alongside `status: "closed"` moves no money — this is the baseline's own behaviour).
- Only a super admin may set `resolution_action` or `refund_amount_gbp`, even without
  changing `status` in the same request.
- A partial refund is validated before any money moves: an amount must be given, the
  booking must be `paid`, it must have a recorded `payment_amount_gbp`, and the requested
  amount must fit within 0..that amount.
- `assigned_admin_id` must name an active (non-suspended) admin account.
- Opening a dispute never creates a conversation — it looks up the booking's own thread, or
  failing that an existing client/vendor DM, and links whichever it finds (or neither).

## Routes
`GET/POST /client/booking-requests/{booking_id}/disputes`, `GET /client/disputes`,
`GET /client/disputes/{dispute_id}`, the same three under `/vendor/...`,
`GET /admin/disputes`, `PATCH /admin/disputes/{dispute_id}`.

## The money branch
`service_admin._perform_money_action` calls the bookings slice, which owns `payment_status`:
`release_to_vendor` → `service_payments.release_payout_for_staff`, `refund_client` →
`refund_booking_for_staff(amount_pence=None)`, `partial_refund` → the same with the amount in
pence. `vendor_no_show` refunds in full like `refund_client` and counts on the vendor's
record. Money moves before the dispute is written, so a refusal (`payout_only_paid`,
`refund_only_paid`, `refund_no_payment_on_record`, `refund_failed`, …, all 400 as in the
baseline) leaves the dispute unresolved. A vendor Stripe cannot pay yet gets a "payout held"
notice and the booking stays paid, yet the dispute is still resolved — the baseline's own
behaviour.

Note: the task brief that named this slice paraphrased the resolution literal as
"release_payout"; the baseline's actual value (kept here) is `"release_to_vendor"`.

## Deliberately not touched
- `bookings/` internals (its `has_active_dispute` / `_dispute_cases` handle already exists);
  only its public `service_payments` and `errors` are used.
- `messaging/` and `staff/`: this slice reads `conversations` and `users` through its own
  lightweight table handles in `repository.py` (the same sanctioned pattern
  `bookings/repository.py` uses for tables it doesn't own), rather than adding new
  cross-slice functions with only one caller.

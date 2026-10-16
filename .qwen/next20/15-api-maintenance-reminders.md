# Piece 15 — api: the four missing maintenance reminders

First read `.qwen/next20/rules-api.md` and follow it in full. There are no dependencies. It must not run at the same time as another piece that edits `bookings/`: pieces 07, 08 and 12.

## Facts
- Maintenance lives in `api/app/features/bookings/service_maintenance.py`. The existing steps are `send_completion_reminder`, `auto_release_payout`, `mark_stale_enquiries` and `send_enquiry_reminders`.
- The hourly job is in `bookings/jobs.py:52-94`: `run_booking_maintenance_once(mailer, gateway)`, which builds the real ports inside the task.
- `bookings/README.md` "Deferred" (~line 143-159) lists these reminders as not built.
- **All the marker columns already exist**; there's no migration:
  - `booking_requests.client_no_response_nudge_at`
  - `booking_requests.pay_to_confirm_reminded_at`
  - `booking_requests.event_tomorrow_reminded_at`
  - `vendors.payouts_setup_nudge_at`

  Check each with `grep -n <column> api/alembic/sql/0002_baseline_schema.sql`.
- Idempotency pattern: claim the marker with a conditional UPDATE (`... SET x_at = now() WHERE id = :id AND x_at IS NULL RETURNING id`) **before** sending, as the existing `remind_completion` does. Read it first and copy its shape.

## The four reminders (baseline, read each fully)
1. **Client no-response nudge.** `backend/app/features/bookings/enquiry_reminders.py:258`.
   - Target: a pending enquiry the vendor hasn't answered 24h after creation, where `client_no_response_nudge_at` is null.
   - Notification kind `client_vendor_no_response`.
   - Email `send_client_vendor_no_response`, listing **up to 5 alternative vendors**. Read how the baseline picks them: same category and visible (use the marketplace service; never filter `approval_status` by hand, see `docs/domain-rules.md`).
2. **Pay to confirm.** `backend/app/features/bookings/lifecycle_reminders.py:187`.
   - Target: `status=accepted`, unpaid, 24h after `accepted_at`, event not over, `pay_to_confirm_reminded_at` null.
   - Kind `pay_to_confirm`, subject or headline "Pay to confirm your date" (exact baseline text).
3. **Event tomorrow.** `lifecycle_reminders.py:122`.
   - Target: paid bookings whose event date is tomorrow, in the baseline's timezone logic (read it: UTC or Europe/London), with `event_tomorrow_reminded_at` null.
   - Sends kind `event_tomorrow` to the client and `vendor_event_tomorrow` to the vendor.
4. **Payouts-setup nudge.** `process_payouts_setup_nudges`; grep it in `backend/app/features/`.
   - Target: vendors with bookings but no payouts-enabled Connect account, where `vendors.payouts_setup_nudge_at` is null.
   - Read the baseline's exact conditions and email.

For each reminder, port:
- the query conditions, exactly (as a repository function in `bookings/repository_maintenance.py` or wherever the existing due-queries live; use `vendors` service functions for the vendor-side data);
- the in-app notification row, if the baseline writes one (`booking_notifications`; follow how `remind_completion` does it);
- the email template (html + txt) into `notifications/templates/` plus a sender in `notifications/service.py`;
- a golden of each email body.

## Wiring
- Add each step to the hourly maintenance run in the same order as the baseline's loop. Read `backend/app/features/bookings/maintenance*.py` or the loop that calls them.
- Each step catches and logs its own exceptions, as the existing steps do, so one failing reminder doesn't stop the others.

## Tests (FakeMailer, real db)
For each reminder:
- due gives one email plus the marker set;
- run twice gives no second email;
- not due (23h, already paid, event over, etc.) gives nothing.

Plus one test that the job function runs all steps. Use the fixed-clock helper the existing maintenance tests use (grep `now=` or `clock` in `tests/**/test_*maintenance*`).

## README
Update `bookings/README.md`: move these out of Deferred and into Use cases, and add the invariant "each reminder is claimed by its marker column before sending".

## Allowed paths
- `api/app/features/bookings/**` and `api/app/features/notifications/**`
- `api/app/features/vendors/**` (a service read function only) and `api/app/features/marketplace/**` (a service read function only, for the alternatives)
- `api/tests/**`

## Commit
`api: client no-response, pay-to-confirm, event-tomorrow and payouts-setup reminders (ws18)`

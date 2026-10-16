# notifications

## Purpose

Turns "something happened" into a message a person receives: the emails other
slices send through `service.py`, and the in-app booking notices and dashboard
feed clients and vendors see (`service_feed.py`). Booking and receipt emails
move here as their slices are rebuilt.

## Use cases

- As **staff**, I **get an alert email when someone submits the contact form**
  so that I can reply the same day.
- As **staff**, I **get an alert email when a vendor submits their profile for
  review** so that I can moderate it.
- As a **client**, I **get an "Account suspended" email when an admin suspends me** (not when
  restored); a send failure never blocks the suspension.
- As a **vendor**, I **get an email when an admin changes my approval status**
  (live, payouts pending, listing paused, suspended or still under review) so
  that I know what to do next.
- As a **vendor**, I **get an email when my profile is returned for edits**,
  with or without an admin note, so that I know it is unlocked and what to fix.
- As a **vendor**, I **get a nudge email to finish my draft profile**, and
  **another to finish Stripe payout setup once approved**, so that I do not
  stall partway through onboarding.
- As a **client or vendor**, I **see a badge counting unread booking notices**
  and **mark them read**, one at a time or all at once.
- As a **client or vendor**, I **see a dashboard feed** of my latest booking
  notices (titled by the event's name), disputes on my bookings, and a line for
  unread chat messages, newest first.

## Invariants

- Templates in `templates/` are copied verbatim from the baseline; the golden
  `tests/golden/notifications/admin_contact_alert.json` and
  `tests/golden/notifications/vendor_emails.json` pin the rendered output byte
  for byte.
- Email links always point at the public site (`https://www.eventtz.com`), never
  at `FRONTEND_URL` or localhost, so an email sent from staging still works.
- Alert recipients come from the `ADMIN_ALERT_EMAILS` setting, never from code.
- Sending never raises into the caller: a failed or skipped email is logged and
  reported as `False`.
- A booking notice's wording comes from `domain_booking_copy`, copied verbatim;
  the golden `tests/golden/notifications/booking_copy.json` pins every kind and
  portal. The stored body is shown only for kinds that carry booking-specific text.
- There is at most one notice per (booking, kind) (a unique constraint).
- Marking read only touches the caller's own notices; any other id is
  `success: false` with status 200, never an error.
- The feed shows at most 20 booking notices, 10 disputes and 25 items in all.

## Routes

For each of `/client` and `/vendor` (each portal only for its own account type):
`GET /notifications/bookings/unread-count`, `POST /notifications/bookings/mark-all-read`,
`POST /notifications/bookings/{notification_id}/mark-read`, `GET /notifications/feed`.

Differences from the baseline:
- The feed reads disputes with one join over the user's bookings, not the
  baseline's two queries capped at 2000 bookings and 500 ids.
- Read times use the database clock.
- A database failure is a 500, not an empty feed or a zero count.
- `booking_requests` and `dispute_cases` are read through table handles in
  `repository_bookings.py` until bookings and disputes are rebuilt.

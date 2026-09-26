# notifications

## Purpose

Turns "something happened" into a message a person receives. Today that is the
ops alert email staff get when a contact form is submitted. Booking, receipt,
auth and in-app notifications move here as their slices are rebuilt.

## Use cases

- As **staff**, I **get an alert email when someone submits the contact form**
  so that I can reply the same day.
- As **staff**, I **get an alert email when a vendor submits their profile for
  review** so that I can moderate it.
- As a **vendor**, I **get an email when an admin changes my approval status**
  (live, payouts pending, listing paused, suspended or still under review) so
  that I know what to do next.
- As a **vendor**, I **get an email when my profile is returned for edits**,
  with or without an admin note, so that I know it is unlocked and what to fix.
- As a **vendor**, I **get a nudge email to finish my draft profile**, and
  **another to finish Stripe payout setup once approved**, so that I do not
  stall partway through onboarding.

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

## Routes

None. Other slices call `service.py`.

# Reviews

## Purpose

A client's one-time rating and comment on a booking, once it has completed.
Owns `booking_reviews` and the routes that submit, list and moderate reviews.
Bookings, marketplace and explore still read `booking_reviews` through their
own `sqlalchemy.table()` handles for now; the integration workstream will
point them at this slice's service instead (see `README`'s Invariants).

## Use cases

- A client submits one review per completed booking of their own.
- A client lists every review they have submitted, with the vendor's display
  name and the booking's event context.
- A vendor lists their own reviews - the same visible ones their public
  profile shows.
- Staff list every review (hidden included), optionally filtered to one
  vendor, inspect one review's booking context, and hide or unhide a review.

## Invariants

- One review per booking: `booking_reviews.booking_request_id` is `UNIQUE`.
  Submitting a second review for the same booking is a 400
  `review_already_submitted`.
- A booking can only be reviewed once `booking_requests.status ==
  "completed"` - `payment_status` is not checked (baseline quirk, kept on
  purpose: a booking can be reviewed even if it was never paid through the
  platform).
- **BASELINE QUIRK:** a booking that does not exist, or belongs to a
  different client, answers 400 `"Booking not found."` (not 404) -
  `create_booking_review` raised a plain `ValueError` the baseline route
  always mapped to 400.
- A review body must be at least 10 characters *after* stripping
  surrounding whitespace. Pydantic's `min_length=10` on the request field
  counts raw characters, so a body of ten spaces passes request validation;
  the service re-checks the stripped text and rejects it as
  `review_too_short`.
- A review may carry at most 5 image URLs. More than 5 in the request body
  fails Pydantic validation (422); a URL that is not `http://` or `https://`
  is dropped silently rather than rejected (baseline quirk, kept on
  purpose).
- Hidden reviews (`hidden_at` set by an admin) never appear in the public,
  client-owner or vendor-owner lists - only the admin list sees them.
- **BASELINE QUIRK:** setting a review's visibility always returns success,
  even for a review id that does not exist - an `UPDATE` matching zero rows
  is not an error. `COULD_NOT_UPDATE_REVIEW_VISIBILITY` is unreachable dead
  code in the baseline and is deliberately not implemented as an error here.
- Every visibility change is written to the admin audit log
  (`action="review.hide"` or `"review.unhide"`, `entity_type="booking_review"`).
- Reviewer display names never show a real name: they are derived from the
  client's email local part (capitalised, clipped to 18 characters), or
  `"Verified client"` when there is none to derive from
  (`domain.reviewer_display_from_email`).

## Routes

- `POST /api/v1/client/booking-requests/{booking_id}/review` - submit a
  review for one of the caller's own completed bookings.
- `GET /api/v1/client/reviews` - the caller's own submitted reviews.
- `GET /api/v1/vendor/reviews` - the caller's own visible reviews.
- `GET /api/v1/admin/reviews` - every review for staff, hidden included,
  optionally filtered by `vendor_user_id`.
- `GET /api/v1/admin/reviews/{review_id}` - one review with its booking's
  event name, date and status.
- `PATCH /api/v1/admin/reviews/{review_id}/visibility` - hide or unhide a
  review.

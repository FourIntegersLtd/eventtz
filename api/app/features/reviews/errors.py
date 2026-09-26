"""Errors the reviews slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.errors import InvalidInput, NotFound


class ReviewBookingNotFound(InvalidInput):
    """No booking with that id that this client is the client of.

    BASELINE QUIRK: `create_booking_review` raises a plain `ValueError` the
    route always maps to 400, so a booking that does not exist or belongs to
    someone else answers 400 "Booking not found.", not 404 like other booking
    routes.
    """

    code = "review_booking_not_found"
    default_message = "Booking not found."


class ReviewOnlyAfterComplete(InvalidInput):
    """A booking can be reviewed only once its status is `completed`."""

    code = "review_only_after_complete"
    default_message = "You can only review a booking after it is marked complete."


class ReviewAlreadySubmitted(InvalidInput):
    """A booking may carry only one review (`booking_reviews.booking_request_id` is `UNIQUE`)."""

    code = "review_already_submitted"
    default_message = "You have already submitted a review for this booking."


class ReviewTooShort(InvalidInput):
    """The review body, once stripped of surrounding whitespace, is under 10 characters.

    BASELINE QUIRK: Pydantic's `min_length=10` counts raw characters, so a body
    of ten spaces passes request validation; this check runs on the stripped
    text and catches it.
    """

    code = "review_too_short"
    default_message = "Review must be at least 10 characters."


class ReviewNotFound(NotFound):
    """No review with that id (admin detail lookup)."""

    code = "review_not_found"
    default_message = "Review not found"

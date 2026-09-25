"""Errors the content slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.errors import Forbidden, InvalidInput, NotFound, Unavailable

# --- blog ---------------------------------------------------------------------------------


class PostNotFound(NotFound):
    """No blog post with that id (admin) or no *published* post with that slug (public)."""

    code = "post_not_found"
    default_message = "Post not found."


class PostWriteFailed(Unavailable):
    """The database refused a blog write; the message names the action ("Could not publish post.")."""

    code = "post_write_failed"
    default_message = "Could not update post."


# --- help -----------------------------------------------------------------------------------


class AudienceMismatch(Forbidden):
    """A client or vendor asked for another portal's help articles."""

    code = "help_audience_mismatch"
    default_message = "Audience must match your account type."


class ArticleNotFound(NotFound):
    """No published help article with that slug for the caller's audience."""

    code = "help_article_not_found"
    default_message = "Article not found."


class QuestionRequired(InvalidInput):
    """The assistant was asked a question that is only whitespace."""

    code = "help_question_required"
    default_message = "Question is required."


class AssistantUnavailable(Unavailable):
    """Something unexpected broke while answering (not a model outage, which has its own error)."""

    code = "help_assistant_unavailable"
    default_message = "The help assistant is unavailable right now. Please try again later."


# --- contact ----------------------------------------------------------------------------------


class MessageTooShort(InvalidInput):
    """The contact message is under 10 characters once surrounding spaces are removed."""

    code = "contact_message_too_short"
    default_message = "Please enter at least 10 characters."


class InvalidBookingReference(InvalidInput):
    """The booking reference is not a booking id (UUID) at all."""

    code = "contact_invalid_booking_reference"
    default_message = "That booking reference doesn't look right."


class BookingNotFound(InvalidInput):
    """The booking reference is well formed but no booking has it (400, as in the baseline)."""

    code = "contact_booking_not_found"
    default_message = "Booking not found."


class BookingNotOnAccount(InvalidInput):
    """The booking exists but the caller is not its client (or vendor, on the vendor form)."""

    code = "contact_booking_not_on_account"
    default_message = "That booking is not on your account."

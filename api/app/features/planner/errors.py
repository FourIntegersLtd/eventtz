"""Errors the planner slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.errors import InvalidInput, NotFound


class EventNotFound(InvalidInput):
    """A booking names an event the client does not own (400, as the baseline answered)."""

    code = "client_event_not_found"
    default_message = "Event not found."


class EventArchived(InvalidInput):
    """A booking names an event the client has archived."""

    code = "client_event_archived"
    default_message = "That event is archived. Start a new event or choose another."


class DescribeCelebration(InvalidInput):
    """The create-plan prompt was empty."""

    code = "describe_celebration"
    default_message = "Describe your celebration in a few words."


class InvalidPrompt(InvalidInput):
    """The prompt looked like nonsense (empty of letters, mostly emoji, mostly noise)."""

    code = "invalid_prompt"
    default_message = (
        "Describe your celebration in a few words - for example a birthday in London for 80 guests."
    )


class SimpleIntent(InvalidInput):
    """The prompt reads as a single vendor search, not a multi-vendor celebration plan."""

    code = "simple_intent"
    default_message = "This looks like a simple vendor search. Try Browse instead."


class PlanNotFound(NotFound):
    """The client asked for a plan that does not exist, or is not theirs."""

    code = "plan_not_found"
    default_message = "Plan not found."


class PlanArchived(InvalidInput):
    """An action was attempted on a plan the client has archived."""

    code = "plan_archived"
    default_message = "That plan is archived."


class PlanItemNotFound(NotFound):
    """The client named a need id that is not one of the plan's items."""

    code = "plan_item_not_found"
    default_message = "That plan item was not found."


class NoMoreAlternatives(InvalidInput):
    """Every candidate vendor for this need has already been shown."""

    code = "no_more_alternatives"
    default_message = "No more alternatives for this category."


class InvalidStatusFilter(InvalidInput):
    """The `status` query parameter on the client-events list was not one of the allowed values."""

    code = "invalid_status_filter"
    default_message = "status must be active, archived, or all."


class InvalidEventId(InvalidInput):
    """The `event_id` path parameter was not a well-formed id."""

    code = "invalid_event_id"
    default_message = "Invalid event id."


class ClientEventNotFound(NotFound):
    """The client asked for an event that does not exist, or is not theirs.

    Named distinctly from `EventNotFound` (code `client_event_not_found`), which the
    bookings slice already uses through `service_bookings.resolve_event_for_booking`.
    """

    code = "event_not_found"
    default_message = "Event not found."

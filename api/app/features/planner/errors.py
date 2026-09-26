"""Errors the planner slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.errors import InvalidInput


class EventNotFound(InvalidInput):
    """A booking names an event the client does not own (400, as the baseline answered)."""

    code = "client_event_not_found"
    default_message = "Event not found."


class EventArchived(InvalidInput):
    """A booking names an event the client has archived."""

    code = "client_event_archived"
    default_message = "That event is archived. Start a new event or choose another."

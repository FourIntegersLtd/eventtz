"""Errors the staff slice raises. Messages are the baseline's user-facing copy, verbatim.

`SuperAdminOnly` (raised by `core.auth.require_super_admin`) already covers the
route-level "you are not a super admin" refusal; the errors below are the
slice's own business-rule refusals once a caller has cleared that gate.
"""

from __future__ import annotations

from app.core.errors import Conflict, InvalidInput, NotFound


class NoFieldsToUpdate(InvalidInput):
    """A PATCH body with every field left out; there is nothing to change."""

    code = "no_fields_to_update"
    default_message = "No fields to update"


class InvalidEmailAddress(InvalidInput):
    """An email address that does not look like one (invite, client search, email test-send)."""

    code = "invalid_email_address"
    default_message = "Enter a valid email address."


class AdminUserNotFound(InvalidInput):
    """BASELINE QUIRK: an unknown `user_id` on the team PATCH/DELETE/send-reset-link routes answers
    400, not 404 — the baseline treats it as a bad request body, not a missing resource."""

    code = "admin_user_not_found"
    default_message = "Admin user not found."


class CannotDeleteSelf(InvalidInput):
    """A super admin may not delete their own account through the team console."""

    code = "cannot_delete_self"
    default_message = "You cannot delete yourself."


class CannotDemoteSelf(InvalidInput):
    """A super admin may not demote their own account to plain admin."""

    code = "cannot_demote_self"
    default_message = "You cannot demote yourself."


class CannotSuspendSelf(InvalidInput):
    """A super admin may not suspend their own account."""

    code = "cannot_suspend_self"
    default_message = "You cannot suspend yourself."


class CannotDeleteLastSuperAdmin(Conflict):
    """The team must always keep at least one super admin able to run it.

    Not exercised by the frozen acceptance suite (see that file's module
    docstring), kept for correctness against a database that only ever has
    one super admin left.
    """

    code = "cannot_delete_last_super_admin"
    default_message = "You cannot delete the last super admin."


class CannotDemoteLastSuperAdmin(Conflict):
    """As `CannotDeleteLastSuperAdmin`, for the demote-via-PATCH path."""

    code = "cannot_demote_last_super_admin"
    default_message = "You cannot demote the last super admin."


class AdminNotFound(NotFound):
    """No admin account with that id (unused by the current routes; kept for parity with the
    baseline's `ADMIN_NOT_FOUND` message, in case a future route needs a 404 instead of the
    400 `AdminUserNotFound` the team routes use)."""

    code = "admin_not_found"
    default_message = "Admin not found"


class UnknownEmailTemplate(InvalidInput):
    """The email test-send route was given a `template_id` outside the fixed set."""

    code = "unknown_email_template"
    default_message = "Unknown email template."


class AuditEntryNotFound(NotFound):
    """No `admin_audit_log` row with that id."""

    code = "audit_entry_not_found"
    default_message = "Audit entry not found"

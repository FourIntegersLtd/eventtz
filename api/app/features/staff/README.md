# staff

## Purpose

Everything about the people who run Eventtz: the admin team, what each staff
member may do, and the audit trail of what they did. Today only the audit trail
is rebuilt; team management, permissions and the dashboards arrive with the
full staff slice.

## Use cases

- As **another slice**, I **record a staff action** (a blog post published, a
  vendor approved) so that super admins can see who changed what, and when.

## Invariants

- Recording an audit event never fails the action it records: a failed insert is
  logged and swallowed, exactly as the baseline does.
- Audit rows are append-only; nothing in the API edits or deletes them.

## Routes

None yet. The admin audit-log and team routes move here with the full slice.
